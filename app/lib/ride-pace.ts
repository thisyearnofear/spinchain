/**
 * How hard a rider is working, turned into where they are on the route.
 *
 * Two clocks run during a class ride and they are not the same thing. The
 * class clock is the lesson: intervals, cues, the cooldown, and the moment the
 * ride ends. The route is the world: the marker on the road, the skyline, the
 * story beat at 60%. Effort moves the route and never the class, which is what
 * keeps a hard-pedaling rider from skipping the cooldown and a slow one from
 * being left inside an interval that has already ended.
 *
 * Two invariants hold by construction, and everything else in here exists to
 * keep them true:
 *
 *   1. `elapsed ≤ elapsed + lead ≤ elapsed + LEAD_CAP_FRACTION × (duration −
 *      elapsed)`
 *      The route is never behind the class clock, and never more than 5% of
 *      whatever route is *left* ahead of it — so it reaches 100 if and only if
 *      the clock does. Nobody is truncated: a rider who surged all ride still
 *      crosses the line with the class, having heard the cooldown. Nobody is
 *      frozen: a lead is spent gradually, never called in as a debt at the end.
 *   2. The route only ever moves forward. Per tick the clock advances by
 *      `clockScale`, while the lead can fall by at most `MAX_DRAIN_RATIO ×
 *      clockScale` and the shrinking cap shaves a further
 *      `LEAD_CAP_FRACTION × clockScale`. Those two sum to under one tick of
 *      clock, so even a rider who stops dead still advances; once their lead is
 *      gone they track the class one second per second. An interpolating
 *      renderer, or a story beat latched on a crossing, cannot un-see a step
 *      backwards — which is why this is an invariant rather than a preference.
 *
 * `intensity` comes from app/lib/ride-effort (rider-relative, 1.0 = threshold).
 * `demoPace` below is the one place that still reads the absolute 0–1000 effort
 * score, and only for the keyboard demo, which authors that score itself.
 */

export const RIDE_PACE = {
  /** Intensity at which a rider starts buying lead at all — class pace. */
  ONSET_INTENSITY: 0.95,
  /** ...and by here they are buying it as fast as lead can be bought. */
  FULL_GAIN_AT_INTENSITY: 1.15,
  /** Route-seconds of lead per tick at full surge: the world runs at double
   *  the clock while a rider is above threshold, which is what a sprint is
   *  supposed to look like. The cap below, not this rate, is what keeps the
   *  route from outrunning the finish. */
  MAX_GAIN_SEC_PER_TICK: 1,
  /** Lead given back per tick when the rider eases off, as a share of one tick
   *  of clock. Under 1 is what makes the route unable to move backwards. */
  MAX_DRAIN_RATIO: 0.5,
  /** The whole point: effort buys a head start, not a shorter class. Expressed
   *  against the route that is *left* rather than the whole class, which is what
   *  makes the lead converge on the clock at the finish instead of being
   *  cancelled there. 5% is visible — a hairpin on a 45-minute ride — and
   *  nothing more, so a Cat 1 rider and a first-timer finish together. */
  LEAD_CAP_FRACTION: 0.05,
} as const;

export interface LeadContext {
  /** Class-seconds advanced by one tick (1 in real time, >1 in a demo). */
  clockScale: number;
  /** Route seconds still available before the finish: `duration - elapsed`. */
  remainingSec: number;
}

/** Ceiling on the lead right now: the smaller of the cap and what it takes to
 *  stay inside invariant 1. */
export function leadCapSec(remainingSec: number): number {
  return Math.max(0, RIDE_PACE.LEAD_CAP_FRACTION * remainingSec);
}

/**
 * The lead a rider holds after one more tick of pedaling.
 *
 * Gain onset is deliberately above a class's steady demand rather than at it:
 * holding class pace should keep you with the class, not put you in the next
 * interval. Below the onset the lead drains in proportion to how far the rider
 * has backed off, so easing off after a sprint gives the head start back over
 * the following minutes rather than all in one tick — a surge is spent, not
 * banked.
 */
export function nextLead(
  surplusSec: number,
  intensity: number,
  { clockScale, remainingSec }: LeadContext,
): number {
  const { ONSET_INTENSITY, FULL_GAIN_AT_INTENSITY, MAX_GAIN_SEC_PER_TICK, MAX_DRAIN_RATIO } =
    RIDE_PACE;
  const safeIntensity = Number.isFinite(intensity) && intensity > 0 ? intensity : 0;

  const gainSpan = FULL_GAIN_AT_INTENSITY - ONSET_INTENSITY;
  const over = Math.min(1, Math.max(0, (safeIntensity - ONSET_INTENSITY) / gainSpan));
  const under = Math.min(1, Math.max(0, (ONSET_INTENSITY - safeIntensity) / ONSET_INTENSITY));

  const gain = MAX_GAIN_SEC_PER_TICK * clockScale * over;
  const drain = MAX_DRAIN_RATIO * clockScale * under;

  return Math.min(Math.max(surplusSec + gain - drain, 0), leadCapSec(remainingSec));
}

/**
 * Keyboard-demo route pace, moved out of the coordinator verbatim so it can be
 * tested without one. The simulator's effort floor is ~100 and its coasting
 * decay heads there, so anything under 150 is "not pedaling": the world stops
 * rather than drifting, which is what makes the keys feel connected to the bike.
 */
export function demoPace(effort: number): number {
  return effort < 150 ? 0 : Math.min((effort - 150) / 200, 1.6);
}
