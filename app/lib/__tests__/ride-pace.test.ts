import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RIDE_PACE,
  demoPace,
  leadCapSec,
  nextLead,
} from "../ride-pace";

/**
 * ride-pace is where the two pacing guarantees the whole design rests on are
 * either provable or broken: a rider can never be truncated (the route reaches
 * 100 exactly when the class clock does) and can never run backwards. Both are
 * properties of the numbers below under repeated application, so the heart of
 * this file is a loop that applies `nextLead` for a whole ride and checks the
 * bound at every single tick.
 */

/** One tick of the coordinator's class-ride branch, in route-seconds. */
interface PaceState {
  elapsed: number;
  lead: number;
  route: number;
}

function applyTick(
  state: PaceState,
  intensity: number,
  duration: number,
  clockScale = 1,
): PaceState {
  const elapsed = Math.min(state.elapsed + clockScale, duration);
  const lead = nextLead(state.lead, intensity, {
    clockScale,
    remainingSec: duration - elapsed,
  });
  return { elapsed, lead, route: elapsed + lead };
}

const START: PaceState = { elapsed: 0, lead: 0, route: 0 };

describe("ride-pace constants", () => {
  it("are set up so the route can only ever move forward", () => {
    // The algebra behind invariant 2: per tick the clock advances clockScale,
    // the lead can fall by MAX_DRAIN_RATIO × clockScale and the cap can tighten
    // by LEAD_CAP_FRACTION × clockScale. If those two together stayed under one
    // tick of clock, the route net-advances no matter what the rider does.
    expect(RIDE_PACE.MAX_DRAIN_RATIO + RIDE_PACE.LEAD_CAP_FRACTION).toBeLessThan(1);
    // And the gain must be reachable: onset below full-gain, both positive.
    expect(RIDE_PACE.ONSET_INTENSITY).toBeGreaterThan(0);
    expect(RIDE_PACE.FULL_GAIN_AT_INTENSITY).toBeGreaterThan(RIDE_PACE.ONSET_INTENSITY);
  });
});

describe("leadCapSec", () => {
  it("is five percent of the route that is left", () => {
    expect(leadCapSec(600)).toBeCloseTo(30);
    expect(leadCapSec(20)).toBeCloseTo(1);
    // Not a fraction of the class: a held lead shrinks as the finish approaches,
    // which is what makes the route arrive *with* the clock instead of being
    // cancelled against it.
    expect(leadCapSec(600)).toBeLessThan(0.05 * 2700);
  });

  it("never goes negative past the finish", () => {
    expect(leadCapSec(0)).toBe(0);
    expect(leadCapSec(-120)).toBe(0);
  });
});

describe("nextLead", () => {
  it("leaves a rider at class pace where they were", () => {
    // Holding threshold pace keeps you with the class; it does not put you in
    // the next interval.
    const held = nextLead(10, RIDE_PACE.ONSET_INTENSITY, { clockScale: 1, remainingSec: 1000 });
    expect(held).toBeCloseTo(10);
  });

  it("buys lead at full rate once a rider is over threshold", () => {
    const gained = nextLead(0, RIDE_PACE.FULL_GAIN_AT_INTENSITY, {
      clockScale: 1,
      remainingSec: 1000,
    });
    expect(gained).toBeCloseTo(RIDE_PACE.MAX_GAIN_SEC_PER_TICK);
    // A compressed clock buys proportionally more, so a demo surge and a real
    // one move the world the same share of the route.
    expect(
      nextLead(0, RIDE_PACE.FULL_GAIN_AT_INTENSITY, { clockScale: 4, remainingSec: 1000 }),
    ).toBeCloseTo(RIDE_PACE.MAX_GAIN_SEC_PER_TICK * 4);
  });

  it("ramps gain between onset and full", () => {
    const midpoint = (RIDE_PACE.ONSET_INTENSITY + RIDE_PACE.FULL_GAIN_AT_INTENSITY) / 2;
    expect(
      nextLead(0, midpoint, { clockScale: 1, remainingSec: 1000 }),
    ).toBeCloseTo(RIDE_PACE.MAX_GAIN_SEC_PER_TICK / 2);
  });

  it("gives the lead back over the following minutes, not in one tick", () => {
    const eased = nextLead(10, 0, { clockScale: 1, remainingSec: 1000 });
    expect(eased).toBeCloseTo(10 - RIDE_PACE.MAX_DRAIN_RATIO);
    // A sprint is spent, not banked: it cannot be saved up and cashed at the end.
    expect(eased).toBeGreaterThan(0);
  });

  it("refuses to pay out more than the cap", () => {
    const capped = nextLead(0, 2, { clockScale: 1, remainingSec: 10 });
    expect(capped).toBe(leadCapSec(10));
  });

  it("cannot go below zero when a stopped rider has nothing left to give", () => {
    expect(nextLead(0, 0, { clockScale: 1, remainingSec: 1000 })).toBe(0);
    expect(nextLead(0.2, 0, { clockScale: 10, remainingSec: 1000 })).toBe(0);
  });

  it("treats a number it cannot trust as no effort at all", () => {
    // intensity reaches here from a device, and a NaN would poison rideProgress
    // and with it every marker, story beat and completion check downstream.
    for (const junk of [NaN, -1, Infinity, undefined, null]) {
      const lead = nextLead(5, junk as number, { clockScale: 1, remainingSec: 600 });
      expect(Number.isFinite(lead)).toBe(true);
      expect(lead).toBeLessThanOrEqual(5);
    }
  });
});

describe("pacing invariants over a whole ride", () => {
  const duration = 2700; // 45 minutes

  it("keeps a hard rider between the clock and the finish, and never shortens their class", () => {
    let state = START;
    let firstFinishTick = -1;
    for (let tick = 1; tick <= duration + 60; tick++) {
      state = applyTick(state, 2, duration); // above every threshold all ride
      const { elapsed, route } = state;
      // Never behind the class clock…
      expect(route).toBeGreaterThanOrEqual(elapsed - 1e-9);
      // …never further ahead than the cap allows…
      expect(route).toBeLessThanOrEqual(elapsed + leadCapSec(duration - elapsed) + 1e-9);
      // …which means never past the finish line.
      if (route >= duration - 1e-9 && firstFinishTick < 0) firstFinishTick = tick;
    }
    expect(state.route).toBeCloseTo(duration);
    // The route reached 100% on the very tick the clock ended, and on no
    // earlier one — so `rideProgress >= 100` is still a correct finish test.
    expect(firstFinishTick).toBe(duration);
    expect(state.elapsed).toBe(duration);
  });

  it("still finishes a coasting rider at the class clock", () => {
    let state = START;
    for (let tick = 1; tick <= duration; tick++) {
      state = applyTick(state, 0, duration);
      expect(state.route).toBeCloseTo(state.elapsed);
    }
    // Pedaling never *required* to finish: a rider who cannot hold class pace is
    // carried by the class, which is the behaviour every real bike has today.
    expect(state.route).toBeCloseTo(duration);
  });

  it("moves only forwards through a surge, a rest, and a second surge", () => {
    let state = START;
    let previous = 0;
    const profile = [
      ...Array.from({ length: 600 }, () => 1.6), // 10 min surge
      ...Array.from({ length: 600 }, () => 0.2), // 10 min easy spin
      ...Array.from({ length: 600 }, () => 1.9), // 10 min surge
      ...Array.from({ length: 900 }, () => 0.0), // coast to the end
    ];
    for (const intensity of profile) {
      state = applyTick(state, intensity, duration);
      expect(state.route).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = state.route;
    }
    // The lead earned in the first surge was spent during the rest rather than
    // held as a debt, and the second surge earned more.
    expect(state.lead).toBeGreaterThanOrEqual(0);
    expect(state.route).toBeLessThanOrEqual(duration);
  });

  it("holds both invariants on a compressed clock", () => {
    // Practice/demo runs the class at several times wall speed; the bounds are
    // per-tick, so they have to survive a clockScale that outruns them.
    const clockScale = 6.75;
    let state = START;
    let previous = 0;
    for (let tick = 1; tick <= Math.ceil(duration / clockScale) + 1; tick++) {
      const intensity = tick % 7 === 0 ? 0 : 2;
      state = applyTick(state, intensity, duration, clockScale);
      expect(state.route).toBeGreaterThanOrEqual(state.elapsed - 1e-9);
      expect(state.route).toBeLessThanOrEqual(state.elapsed + leadCapSec(duration - state.elapsed) + 1e-9);
      expect(state.route).toBeLessThanOrEqual(duration + 1e-9);
      expect(state.route).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = state.route;
    }
  });
});

describe("demoPace", () => {
  it("is the keyboard demo's own curve, unchanged", () => {
    // PedalSimulator idle-settles at effort ~100, so anything under 150 is the
    // rider having stopped: the world halts instead of drifting.
    expect(demoPace(0)).toBe(0);
    expect(demoPace(100)).toBe(0);
    expect(demoPace(149)).toBe(0);
    expect(demoPace(150)).toBe(0);
    expect(demoPace(350)).toBe(1);
    expect(demoPace(450)).toBe(1.5);
    // Hard pedaling is capped, which is what keeps a ~45s demo finish.
    expect(demoPace(550)).toBe(1.6);
    expect(demoPace(1000)).toBe(1.6);
    expect(demoPace(5000)).toBe(1.6);
  });
});

describe("the pace layer stays off the reward ledger", () => {
  // `calculateEffortScore` is the absolute 0–1000 score: it backs the reward
  // stream, the Noir witness, the persisted ride, journey tiers and badges. The
  // first attempt at rider-relative pacing pulled it into the ride loop, which
  // silently rewrote a progression ledger from a visual change. That boundary
  // is one import wide, so it is checked as a source fact rather than trusted.
  const PACE_LAYER = [
    "app/lib/ride-pace.ts",
    "app/lib/ride-effort.ts",
    "app/engines/telemetry-engine.ts",
    "app/engines/coordinator.ts",
  ];

  it.each(PACE_LAYER)("pulls no absolute effort score into %s", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    expect(specifiers.filter((s) => /rewards\/calculator/.test(s))).toEqual([]);
    expect(source).not.toMatch(/\bcalculateEffortScore\b/);
  });
});
