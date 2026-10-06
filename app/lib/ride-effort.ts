/**
 * Rider-relative intensity: how hard this rider is working measured against
 * this rider's own thresholds.
 *
 * `intensity` is 1.0 at threshold — the pace a class is built around — so a
 * beginner and a Cat 1 racer both see a world that responds to their effort
 * rather than to a stranger's wattage. It is NOT the 0–1000 `effort` score in
 * app/lib/rewards/calculator. That one is absolute, it backs the reward
 * ledger and the Noir circuit, and nothing here may read or write it.
 */

export const RIDE_EFFORT = {
  /** Profile values are clamped, not rejected: a typo should degrade gently. */
  FTP_MIN_W: 80,
  FTP_MAX_W: 450,
  MAX_HR_MIN: 140,
  MAX_HR_MAX: 210,
  RESTING_HR_MIN: 30,
  RESTING_HR_MAX: 100,
  /**
   * What an anonymous rider gets on second zero. Ride without a wallet,
   * without the quiz, without signup — so the alternative to a wrong guess is
   * no guess at all, which would freeze the world for everyone new.
   */
  FALLBACK_FTP_W: 180,
  FALLBACK_MAX_HR: 190,
  FALLBACK_RESTING_HR: 60,
  /** A ride must run this long before its own power is trusted at all. */
  CALIBRATION_MIN_SEC: 120,
  /** ...and it reaches full weight here, so the anchor never snaps. */
  CALIBRATION_RAMP_SEC: 300,
  /** Heart rate's share when a power channel also exists. Watts are the truth. */
  HR_MIX: 0.15,
  /** A class ride averages this share of threshold, so the mean inverts to it. */
  CLASS_AVG_POWER_FRACTION: 0.75,
  /** A cadence-only bike tops out here, so it can never out-pace a watt-metered one. */
  CADENCE_MAX_RPM: 95,
  CADENCE_ONLY_CAP: 0.8,
  INTENSITY_MAX: 2,
} as const;

export type AnchorSource = "profile" | "observed" | "fallback";

export interface RiderAnchors {
  /** Functional threshold power, watts. */
  ftp: number;
  maxHr: number;
  restingHr: number;
  source: AnchorSource;
}

/**
 * Which telemetry channels this rider's equipment actually delivers. Absent
 * and present-but-zero are different facts: an FTMS bike with no heart-rate
 * strap reports `heartRate: 0` forever, and a stationary rider reports
 * `power: 0`. Only the channel set distinguishes the two.
 */
export interface ChannelCapability {
  power: boolean;
  heartRate: boolean;
  cadence: boolean;
}

export const NO_CHANNELS: ChannelCapability = { power: false, heartRate: false, cadence: false };

export interface AnchorProfile {
  ftp?: number | null;
  maxHr?: number | null;
  restingHr?: number | null;
}

export interface AnchorInput {
  profile?: AnchorProfile | null;
  /** In-ride power observation, or null before it has anything to say. */
  observed?: PowerObservation | null;
}

// ─── Physiology ───────────────────────────────────────────────────

/**
 * Heart-rate reserve at the top of each training zone. The one place this
 * ladder is written; the persisted `TrainingZones` shape in
 * app/stores/rider-profile-store is these percentages applied to a bpm range.
 */
export const ZONE_HRR = [0.55, 0.65, 0.75, 0.85, 0.95] as const;

// ─── In-ride self-calibration ─────────────────────────────────────

/**
 * Running mean of a ride's power, used to calibrate anchors for riders who
 * gave us no profile — which is every first ride and every rider who declines
 * signup. Mean-of-ride (rather than an EMA) because a class ride averages a
 * stable share of threshold, it holds steady across a cool-down instead of
 * wandering with the last few minutes, and it is continuous, so the anchor it
 * feeds never pops the world mid-ride.
 */
export class PowerObservation {
  private sum = 0;
  private seconds = 0;

  /** One 1 Hz sample. Zero-power coasting counts: it is part of the ride. */
  sample(powerW: number, deltaSeconds = 1): void {
    if (!Number.isFinite(powerW) || powerW < 0 || deltaSeconds <= 0) return;
    this.sum += powerW * deltaSeconds;
    this.seconds += deltaSeconds;
  }

  get elapsedSeconds(): number {
    return this.seconds;
  }

  get avgPowerW(): number {
    return this.seconds > 0 ? this.sum / this.seconds : 0;
  }

  get estimatedFtpW(): number {
    if (!this.ready) return 0;
    return Math.round(this.avgPowerW / RIDE_EFFORT.CLASS_AVG_POWER_FRACTION);
  }

  get ready(): boolean {
    return this.seconds >= RIDE_EFFORT.CALIBRATION_MIN_SEC;
  }

  /** 0 until the ride is long enough to judge, then ramps to 1 without a jump. */
  get confidence(): number {
    const { CALIBRATION_MIN_SEC: min, CALIBRATION_RAMP_SEC: ramp } = RIDE_EFFORT;
    if (this.seconds < min) return 0;
    // Starts at zero *at* the min: ramping from `seconds / ramp` would hand the
    // anchor a step the moment the ride became judgeable, and the world reads
    // that number every frame.
    return Math.min(1, (this.seconds - min) / Math.max(1, ramp - min));
  }
}

// ─── Anchors ──────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function positiveOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

const FALLBACK_ANCHORS: Omit<RiderAnchors, "source"> = {
  ftp: RIDE_EFFORT.FALLBACK_FTP_W,
  maxHr: RIDE_EFFORT.FALLBACK_MAX_HR,
  restingHr: RIDE_EFFORT.FALLBACK_RESTING_HR,
};

/**
 * Resolve what to measure this rider against.
 *
 * Profile first, because a rider who told us their FTP earned the number.
 * Then this ride's own power: it may only ever pull a stated FTP *down*, since
 * two minutes of sampling is evidence of a ceiling but weak evidence of one —
 * and the direction it is allowed to move is the direction that makes the
 * world easier to light up, not harder. For the no-profile rider the same
 * observation is the only signal there is, so it replaces the fallback in
 * whichever direction it points.
 *
 * A rider's recent rides would sit between those two, but the only history we
 * keep is a Supabase round-trip and this has to be answerable at second zero,
 * offline, on a ride that never asked for a signup.
 */
export function resolveAnchors({ profile, observed }: AnchorInput = {}): RiderAnchors {
  const profileFtp = positiveOrNull(profile?.ftp);
  const profileMaxHr = positiveOrNull(profile?.maxHr);
  const profileRestingHr = positiveOrNull(profile?.restingHr);

  // A missing value must stay missing: clamping `0` up to FTP_MIN would read as
  // a stated 80 W and take the profile branch, which is the opposite of a
  // fallback and would make an anonymous rider's world nearly unmoved.
  const ftp = profileFtp === null ? null : clamp(profileFtp, RIDE_EFFORT.FTP_MIN_W, RIDE_EFFORT.FTP_MAX_W);
  const maxHr = profileMaxHr
    ? clamp(profileMaxHr, RIDE_EFFORT.MAX_HR_MIN, RIDE_EFFORT.MAX_HR_MAX)
    : FALLBACK_ANCHORS.maxHr;
  const restingHr = profileRestingHr
    ? clamp(profileRestingHr, RIDE_EFFORT.RESTING_HR_MIN, RIDE_EFFORT.RESTING_HR_MAX)
    : FALLBACK_ANCHORS.restingHr;

  const observedFtp = observed?.estimatedFtpW ?? 0;
  const weight = observed?.confidence ?? 0;

  if (ftp === null) {
    if (observedFtp > 0 && weight > 0) {
      const blended =
        FALLBACK_ANCHORS.ftp + (clamp(observedFtp, RIDE_EFFORT.FTP_MIN_W, RIDE_EFFORT.FTP_MAX_W) - FALLBACK_ANCHORS.ftp) * weight;
      return { ftp: blended, maxHr, restingHr, source: "observed" };
    }
    return { ftp: FALLBACK_ANCHORS.ftp, maxHr, restingHr, source: "fallback" };
  }

  if (observedFtp > 0 && observedFtp < ftp && weight > 0) {
    const lowered = ftp - (ftp - clamp(observedFtp, RIDE_EFFORT.FTP_MIN_W, ftp)) * weight;
    return { ftp: lowered, maxHr, restingHr, source: "profile" };
  }
  return { ftp, maxHr, restingHr, source: "profile" };
}

// ─── Intensity ────────────────────────────────────────────────────

/**
 * %HRR → intensity. The breakpoints are `ZONE_HRR` verbatim, so zone 4 —
 * threshold — is intensity 1.0, which is the same point FTP sets for power.
 * The bottom rung sits above zero on purpose: a live heart-rate channel means a
 * rider on the bike, and HR-only equipment must never be why the world stopped.
 */
const HRR_TO_INTENSITY: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.2],
  [ZONE_HRR[0], 0.55],
  [ZONE_HRR[1], 0.7],
  [ZONE_HRR[2], 0.86],
  [ZONE_HRR[3], 1.0],
  [ZONE_HRR[4], 1.15],
  [1.0, 1.3],
];

function fitToIntensity(ratio: number): number {
  const points = HRR_TO_INTENSITY;
  if (ratio <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (ratio <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      return y0 + ((ratio - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

/** Heart-rate reserve as intensity, or null when there is no usable HR signal. */
export function hrIntensity(heartRate: number, anchors: RiderAnchors): number | null {
  if (!Number.isFinite(heartRate) || heartRate <= 0) return null;
  const reserve = anchors.maxHr - anchors.restingHr;
  if (reserve <= 0) return null;
  return fitToIntensity(clamp((heartRate - anchors.restingHr) / reserve, 0, 1));
}

/**
 * How hard this rider is working right now, 0–2 where 1.0 is threshold.
 *
 * Power is the only channel that measures work, so it leads wherever it
 * exists and heart rate merely nudges it — HR drifts with heat, caffeine and
 * mood. With no power channel, heart rate *is* the effort signal. With neither,
 * a cadence sensor on a freewheel still says something, so it is worth less.
 */
export function ridingIntensity(
  power: number,
  heartRate: number,
  cadence: number,
  anchors: RiderAnchors,
  capability: ChannelCapability,
): number {
  if (!Number.isFinite(anchors.ftp) || anchors.ftp <= 0) return 0;

  let intensity: number;
  if (capability.power) {
    intensity = Math.max(0, power) / anchors.ftp;
    const hr = capability.heartRate ? hrIntensity(heartRate, anchors) : null;
    if (hr !== null) intensity = intensity * (1 - RIDE_EFFORT.HR_MIX) + hr * RIDE_EFFORT.HR_MIX;
  } else if (capability.heartRate) {
    // A live strap with no watts is still a live rider: hrIntensity bottoms out
    // above zero, so this path cannot freeze the world.
    intensity = hrIntensity(heartRate, anchors) ?? 0;
  } else if (capability.cadence) {
    intensity =
      Math.min(1, Math.max(0, cadence) / RIDE_EFFORT.CADENCE_MAX_RPM) * RIDE_EFFORT.CADENCE_ONLY_CAP;
  } else {
    intensity = 0;
  }

  return Math.min(intensity, RIDE_EFFORT.INTENSITY_MAX);
}

/**
 * The 0–1 the visual world reads. Compressed with the same exponent
 * world-reactivity always used, and scaled so the top of the range is the
 * intensity cap rather than a magic wattage. Against the fallback anchor this
 * tracks `(power / 400) ** 0.6` across the keyboard demo's 80–1400 W sweep to
 * within a few points, which is what keeps the demo looking the way it looks
 * today while a real rider's world stops being calibrated to a stranger's legs.
 */
export function visualEffort(intensity: number): number {
  return Math.pow(clamp(intensity, 0, RIDE_EFFORT.INTENSITY_MAX) / RIDE_EFFORT.INTENSITY_MAX, 0.6);
}
