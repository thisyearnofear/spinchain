/** Wall-clock gap between milestone overlays — stops ~1.5s spam in compressed practice. */
export const MILESTONE_COOLDOWN_MS = 10_000;

/** Pure gate: throttle minute-boundary popups in compressed practice. */
export function shouldShowMinuteMilestone(opts: {
  lastOverlayAt: number;
  now?: number;
  cooldownMs?: number;
}): boolean {
  const now = opts.now ?? Date.now();
  const cooldown = opts.cooldownMs ?? MILESTONE_COOLDOWN_MS;
  if (opts.lastOverlayAt === 0) return true;
  return now - opts.lastOverlayAt >= cooldown;
}
