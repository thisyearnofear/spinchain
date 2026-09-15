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
 * - `fatigued` is reserved until training-load modeling is honest enough
 *   to drive it (see the health principles in docs/CHARACTER-SYSTEM.md).
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
