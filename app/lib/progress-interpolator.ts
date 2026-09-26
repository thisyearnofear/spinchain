/**
 * ProgressInterpolator — turns the coordinator's ~1 Hz rideProgress ticks
 * into a steady-speed, per-frame display value.
 *
 * The old approach eased toward each new tick with a fixed per-frame lerp
 * (0.08). Because the target only moves once a second, that produced a
 * visible surge-then-coast every tick, and its feel changed with frame
 * rate. Here each tick starts a linear segment from wherever the display
 * currently is to the new target, spread over the measured tick interval.
 * At constant effort the rider therefore moves at constant speed; the cost
 * is roughly one tick of visual latency, which is imperceptible for a
 * progress marker.
 *
 * Pure and framework-free: sample() is called from useFrame (3D) or a rAF
 * loop (2D) and never touches React state.
 */

const DEFAULT_INTERVAL_MS = 1000;
const MIN_INTERVAL_MS = 150;
const MAX_INTERVAL_MS = 2000;

export class ProgressInterpolator {
  private from: number;
  private to: number;
  private startMs: number;
  private durationMs = DEFAULT_INTERVAL_MS;
  private lastPushMs: number | null = null;
  private intervalMs = DEFAULT_INTERVAL_MS;

  constructor(initial = 0, nowMs = 0) {
    this.from = initial;
    this.to = initial;
    this.startMs = nowMs;
  }

  /** Register a new authoritative progress value. */
  push(target: number, nowMs: number): void {
    if (!Number.isFinite(target)) return;
    if (target === this.to) return;

    // Backwards moves (reset / restart) and large jumps snap — interpolating
    // across them would show the rider sliding back along the route.
    if (target < this.to || Math.abs(target - this.to) > 0.25) {
      this.snap(target, nowMs);
      return;
    }

    if (this.lastPushMs !== null) {
      const measured = nowMs - this.lastPushMs;
      if (measured > 0) {
        const clamped = Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, measured));
        // EMA so one late tick doesn't make the next segment crawl.
        this.intervalMs = this.intervalMs * 0.7 + clamped * 0.3;
      }
    }
    this.lastPushMs = nowMs;

    this.from = this.sample(nowMs);
    this.to = target;
    this.startMs = nowMs;
    this.durationMs = this.intervalMs;
  }

  /** Jump straight to a value (reset, reduced motion, finish). */
  snap(value: number, nowMs: number): void {
    this.from = value;
    this.to = value;
    this.startMs = nowMs;
    this.lastPushMs = nowMs;
  }

  /** Display value at time `nowMs`. Never overshoots the latest target. */
  sample(nowMs: number): number {
    if (this.durationMs <= 0) return this.to;
    const t = Math.min(1, Math.max(0, (nowMs - this.startMs) / this.durationMs));
    return this.from + (this.to - this.from) * t;
  }

  get target(): number {
    return this.to;
  }
}

/** Frame-rate independent exponential smoothing factor for `lerp(a, b, k)`. */
export function dampFactor(lambda: number, deltaSeconds: number): number {
  return 1 - Math.exp(-lambda * Math.max(0, deltaSeconds));
}
