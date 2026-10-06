import { describe, expect, it } from "vitest";
import {
  PowerObservation,
  RIDE_EFFORT,
  resolveAnchors,
  ridingIntensity,
  visualEffort,
  type ChannelCapability,
} from "@/app/lib/ride-effort";

/**
 * The rider-relative effort model. Everything here is pure arithmetic on a
 * rider's own thresholds — no store, no device, no scene — because this is the
 * layer that decides whether the world moves, and it has to be answerable
 * without booting a ride.
 */

const POWER_ONLY: ChannelCapability = { power: true, heartRate: false, cadence: false };
const HR_ONLY: ChannelCapability = { power: false, heartRate: true, cadence: false };
const CADENCE_ONLY: ChannelCapability = { power: false, heartRate: false, cadence: true };
const ALL: ChannelCapability = { power: true, heartRate: true, cadence: true };
const NONE: ChannelCapability = { power: false, heartRate: false, cadence: false };

const ATHLETE = resolveAnchors({
  profile: { ftp: 250, maxHr: 190, restingHr: 50 },
});

describe("resolveAnchors", () => {
  it("trusts a stated profile", () => {
    const anchors = resolveAnchors({ profile: { ftp: 250, maxHr: 190, restingHr: 50 } });
    expect(anchors).toEqual({ ftp: 250, maxHr: 190, restingHr: 50, source: "profile" });
  });

  it("clamps a profile that cannot be believed rather than rejecting the ride", () => {
    // A typo should degrade the numbers, not remove them: the alternative is a
    // rider who entered 900 max HR getting a stranger's calibration.
    const anchors = resolveAnchors({ profile: { ftp: 900, maxHr: 900, restingHr: 5 } });
    expect(anchors.ftp).toBe(RIDE_EFFORT.FTP_MAX_W);
    expect(anchors.maxHr).toBe(RIDE_EFFORT.MAX_HR_MAX);
    expect(anchors.restingHr).toBe(RIDE_EFFORT.RESTING_HR_MIN);
  });

  it("falls back to a stated default for a rider who gave us nothing", () => {
    // A ride has to complete with no wallet and no signup, so there is no
    // onboarding step that could supply a real number. The answer is a
    // deliberately ordinary guess, not a stall.
    expect(resolveAnchors().source).toBe("fallback");
    expect(resolveAnchors({ profile: null })).toMatchObject({
      ftp: 180,
      maxHr: 190,
      restingHr: 60,
    });
    expect(resolveAnchors({ profile: { ftp: null, maxHr: 0, restingHr: undefined } }).source).toBe(
      "fallback",
    );
  });

  it("ignores its own ride until the ride is long enough to judge", () => {
    const observed = new PowerObservation();
    observed.sample(240, 60);
    expect(observed.ready).toBe(false);
    // Two minutes of warm-up is not a threshold. Believing it would peg a
    // fresh rider's ceiling to their easiest effort of the day.
    expect(resolveAnchors({ observed }).source).toBe("fallback");
  });

  it("lets a ride calibrate an anonymous rider in whichever direction the watts point", () => {
    const observed = new PowerObservation();
    observed.sample(200, 400);
    const anchors = resolveAnchors({ observed });
    expect(anchors.source).toBe("observed");
    // 200 W average / 0.75 = 267 W threshold, at full confidence.
    expect(anchors.ftp).toBeCloseTo(267);
  });

  it("only ever moves a stated FTP down", () => {
    const profile = { profile: { ftp: 250, maxHr: 190, restingHr: 50 } };

    const easy = new PowerObservation();
    easy.sample(150, 400); // → 200 W, below the stated 250
    expect(resolveAnchors({ ...profile, observed: easy }).ftp).toBeCloseTo(200);

    const hard = new PowerObservation();
    hard.sample(280, 400); // → 373 W, above the stated 250
    // A rider who told us 250 does not get their number rewritten upward
    // because they had a good class: that would quietly make every later ride
    // harder to light up, on the strength of one afternoon.
    expect(resolveAnchors({ ...profile, observed: hard }).ftp).toBe(250);
  });

  it("ramps the anchor instead of snapping it mid-ride", () => {
    const profile = { profile: { ftp: 250, maxHr: 190, restingHr: 50 } };
    let previous = 250;
    const observed = new PowerObservation();
    for (let second = 1; second <= 400; second++) {
      observed.sample(150, 1);
      const next = resolveAnchors({ ...profile, observed }).ftp;
      // The world reads this number every frame. A step is a visible pop.
      expect(previous - next).toBeLessThan(2);
      previous = next;
    }
  });
});

describe("PowerObservation", () => {
  it("counts coasting as part of the ride", () => {
    const observed = new PowerObservation();
    observed.sample(200, 60);
    observed.sample(0, 60);
    expect(observed.avgPowerW).toBe(100);
    // Stopped pedaling is data. Skipping it would inflate the estimate every
    // time a rider took a rest, and rest is half of interval training.
    expect(observed.elapsedSeconds).toBe(120);
    expect(observed.ready).toBe(true);
  });

  it("refuses to estimate before it is ready", () => {
    const observed = new PowerObservation();
    observed.sample(300, 30);
    expect(observed.estimatedFtpW).toBe(0);
    expect(observed.confidence).toBe(0);
  });

  it("ignores samples that are not numbers", () => {
    const observed = new PowerObservation();
    observed.sample(NaN, 1);
    observed.sample(-5, 1);
    observed.sample(200, 0);
    expect(observed.elapsedSeconds).toBe(0);
    expect(observed.avgPowerW).toBe(0);
  });

  it("inverts the ride average to a threshold", () => {
    const observed = new PowerObservation();
    for (let second = 0; second < 300; second++) observed.sample(150, 1);
    expect(observed.avgPowerW).toBe(150);
    expect(observed.estimatedFtpW).toBe(200);
  });

  it("gives no estimate for a ride with no watts in it", () => {
    const observed = new PowerObservation();
    for (let second = 0; second < 300; second++) observed.sample(0, 1);
    // Zero here means "nothing to infer", not "this rider's threshold is zero",
    // so the fallback survives a watt-less bike instead of being replaced by an
    // invented floor.
    expect(observed.ready).toBe(true);
    expect(observed.estimatedFtpW).toBe(0);
  });
});

describe("ridingIntensity", () => {
  it("measures watts against this rider's threshold", () => {
    expect(ridingIntensity(250, 0, 0, ATHLETE, POWER_ONLY)).toBeCloseTo(1);
    expect(ridingIntensity(125, 0, 0, ATHLETE, POWER_ONLY)).toBeCloseTo(0.5);
    expect(ridingIntensity(500, 0, 0, ATHLETE, POWER_ONLY)).toBeCloseTo(2);
  });

  it("does not read a watt-less bike's zero as zero effort", () => {
    // This is the whole reason the channel set exists: `power: 0` from a bike
    // that cannot measure watts must not freeze the world.
    const hrRider = ridingIntensity(0, 170, 0, ATHLETE, HR_ONLY);
    expect(hrRider).toBeGreaterThan(0.5);

    const noChannels = ridingIntensity(0, 170, 90, ATHLETE, NONE);
    expect(noChannels).toBe(0);
  });

  it("keeps the heart-rate ladder consistent with the zone ladder", () => {
    // Top of zone 4 is threshold, and threshold is 1.0 for watts too — the two
    // channels have to agree or a combo bike's reading depends on which
    // characteristic notified last.
    const zoneTop = ATHLETE.restingHr + (ATHLETE.maxHr - ATHLETE.restingHr) * 0.85;
    expect(ridingIntensity(0, zoneTop, 0, ATHLETE, HR_ONLY)).toBeCloseTo(1, 1);
    // A live strap at rest is still a rider on the bike.
    expect(ridingIntensity(0, ATHLETE.restingHr, 0, ATHLETE, HR_ONLY)).toBeGreaterThan(0);
  });

  it("lets watts lead and heart rate nudge", () => {
    const easyHeart = ridingIntensity(250, ATHLETE.restingHr, 0, ATHLETE, ALL);
    const hardHeart = ridingIntensity(250, ATHLETE.maxHr, 0, ATHLETE, ALL);
    expect(easyHeart).toBeLessThan(1);
    expect(hardHeart).toBeGreaterThan(1);
    // A readout that let HR dominate would let a hot room out-pedal the bike.
    expect(hardHeart - easyHeart).toBeLessThan(0.2);
  });

  it("values a cadence-only sensor below a metered one", () => {
    expect(ridingIntensity(0, 0, 95, ATHLETE, CADENCE_ONLY)).toBeCloseTo(0.8);
    expect(ridingIntensity(0, 0, 900, ATHLETE, CADENCE_ONLY)).toBeCloseTo(0.8);
    expect(ridingIntensity(0, 0, 0, ATHLETE, CADENCE_ONLY)).toBe(0);
  });

  it("stays inside its declared range for any input", () => {
    for (const [power, hr, cadence] of [[9999, 300, 999], [-50, -10, -5], [0, 0, 0]] as const) {
      const intensity = ridingIntensity(power, hr, cadence, ATHLETE, ALL);
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThanOrEqual(RIDE_EFFORT.INTENSITY_MAX);
    }
    expect(ridingIntensity(200, 150, 80, { ...ATHLETE, ftp: 0 }, ALL)).toBe(0);
  });
});

describe("visualEffort", () => {
  it("keeps the keyboard demo looking the way it does today", () => {
    // The demo's pedal simulator sweeps 80–1400 W and world-reactivity has
    // always read `(power / 400) ** 0.6`. Rider-relative numbers must not
    // restyle the one experience everyone has already agreed looks right, so
    // against the anonymous fallback anchor the two curves stay in step. The
    // new one runs a few points hotter through the middle — deliberate, and
    // small enough to be invisible on one channel of a multi-factor scene.
    const fallback = resolveAnchors();
    for (const power of [80, 150, 200, 300, 400, 800, 1400]) {
      const legacy = Math.min(1, (power / 400) ** 0.6);
      const now = visualEffort(ridingIntensity(power, 0, 0, fallback, POWER_ONLY));
      expect(Math.abs(now - legacy)).toBeLessThan(0.07);
    }
  });

  it("is monotonic in effort", () => {
    let previous = -1;
    for (let intensity = 0; intensity <= 2.5; intensity += 0.1) {
      const value = visualEffort(intensity);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
  });
});
