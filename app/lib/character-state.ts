/**
 * CharacterState — the single vocabulary of rider-avatar states for the
 * whole product (docs/CHARACTER-SYSTEM.md).
 *
 * One state, many renderings: the 3D world avatar crossfades clips, the
 * Rive HUD rider switches postures, cards/screens pick a tone — all from
 * this enum, derived from the same stores. Surfaces must never invent
 * per-surface character logic; extend the resolver here instead.
 *
 * Notes:
 * - `flow` is a *modifier* layered on `riding` today (aura, glow, camera
 *   FOV), not a separate clip — the asset library has no flow clip yet.
 * - `fatigued` is now driven by the honest training-load model
 *   (getWeeklyLoad: 3+ hard rides in 7 days) via resolveBetweenRideState,
 *   the between-ride extension below (see docs/CHARACTER-SYSTEM.md).
 * - The 3D avatar has no pedaling clip (Mint's catalog lacks one — see
 *   public/characters/rider.mint.json), so riding states map to the
 *   neutral seated idle; the Rive HUD rider carries the pedaling story.
 */

import type { IntervalPhase } from "@/app/lib/phase-theme";

export const CHARACTER_STATES = [
  "idle",
  "ready",
  "riding",
  "flow",
  "recovery",
  "celebrate",
  "fatigued",
] as const;

export type CharacterState = (typeof CHARACTER_STATES)[number];

export interface CharacterStateInput {
  /** Ride is actively running. */
  isRiding: boolean;
  intervalPhase?: IntervalPhase | null;
  /** Within a (short, edge-triggered) celebration window — prBeaten is a
   *  sticky store flag, so callers own the window timing. */
  celebrating?: boolean;
  /** Peak/current flow tier (0–4); tier ≥ 2 upgrades riding → flow. */
  flowTier?: number;
}

export function resolveCharacterState({
  isRiding,
  intervalPhase = null,
  celebrating = false,
  flowTier = 0,
}: CharacterStateInput): CharacterState {
  if (celebrating) return "celebrate";
  if (intervalPhase === "recovery" || intervalPhase === "cooldown") {
    return "recovery";
  }
  if (isRiding) return flowTier >= 2 ? "flow" : "riding";
  return "idle";
}

/**
 * Which registered avatar clip plays for a state. Clip names must match
 * the `clips[].name` entries in app/lib/generated-avatars.json. States
 * without a dedicated clip fall back to the neutral seated idle.
 */
export const AVATAR_CLIP_BY_STATE: Record<CharacterState, string> = {
  idle: "idle",
  ready: "idle",
  riding: "idle", // no pedaling clip exists yet — see module docstring
  flow: "idle",
  recovery: "recovery",
  celebrate: "celebrate",
  fatigued: "idle",
};

// ─── Between-Ride Resolution ───────────────────────────────────────

/**
 * Between-ride signals, computed by the caller from ride history +
 * training-load + coach memory. Kept primitive so this module stays
 * dependency-free; the journey page wires the real stores in.
 */
export interface BetweenRideSignal {
  /** Total recorded rides. */
  rideCount: number;
  /** Epoch ms of the most recent ride; null when never ridden. */
  lastRideAt: number | null;
  /** The trailing-window fatigue flag from getWeeklyLoad() — the honest
   *  training-load model this vocabulary was waiting for. */
  fatigued: boolean;
  /** The most recent ride set a personal record (e.g. best avg power). */
  lastRideWasPR: boolean;
  /** Current time, injectable for tests. */
  now?: number;
}

const DAY_MS = 86_400_000;

/**
 * The fourth act of the character loop: who the rider IS between rides.
 * Factual only — no readiness scores, no invented states:
 * - celebrate: a PR is fresh (within a day)
 * - fatigued: the training-load model says so (3+ hard rides this week)
 * - recovery: rode within the last ~1.5 days — the body is absorbing work
 * - ready: rested 2+ days
 * - idle: never ridden
 */
export function resolveBetweenRideState(signal: BetweenRideSignal): CharacterState {
  const { rideCount, lastRideAt, fatigued, lastRideWasPR } = signal;
  if (rideCount === 0 || lastRideAt === null) return "idle";
  const now = signal.now ?? Date.now();
  const since = now - lastRideAt;
  if (lastRideWasPR && since <= DAY_MS) return "celebrate";
  if (fatigued) return "fatigued";
  if (since <= DAY_MS * 1.5) return "recovery";
  return "ready";
}

/** Rider-facing labels for between-ride states (never raw enum names). */
export const BETWEEN_RIDE_LABELS: Record<CharacterState, string> = {
  idle: "Fresh start",
  ready: "Rested",
  riding: "Riding",
  flow: "In flow",
  recovery: "Recovering",
  celebrate: "Personal best",
  fatigued: "Ease-up day",
};
