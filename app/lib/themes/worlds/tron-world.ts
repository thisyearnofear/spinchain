/**
 * The Tron world — the one world that exists today.
 *
 * The five built-in looks (Neon City, Summit Pass, Red Expanse, Toon Valley,
 * Spectrum Run) are modelled here as **modes** of one world rather than as
 * five worlds, for two reasons.
 *
 * 1. They are five looks at one place: the same road on the same flat skirt,
 *    differing in palette, in which of five prop silhouettes stands beside it,
 *    and in which of five sky kits hangs above it. A world is a place; these
 *    are moods.
 * 2. Modelling them as modes frees the world slot. The product needs places
 *    that are *not* vector-neon — an underworld, a cloud realm, a concrete
 *    jungle, a rainforest — and each of those needs its own ground, its own
 *    props and its own sky. Those cannot be modes of Tron.
 *
 * The honest caveat, recorded in `complete: false`: the five modes still differ
 * in place-level traits today (the prop silhouette and the sky kit come from the
 * palette, not from the world). Until those are split out — the palette into a
 * true colour palette, the silhouette and the kit up to world level — Tron
 * borrows its shape from its modes. `docs/WORLD-SYSTEM.md` tracks that work.
 */

import type { WorldDefinition, WorldMode } from "@/app/lib/themes/world-definition";

/**
 * The five legacy looks. `themeName` is the palette reference; the legacy
 * `ThemeDefinition` still carries the atmosphere kit and the prop silhouette,
 * and `resolved.ts` reads them from there until the split lands.
 */
const TRON_MODES: WorldMode[] = [
  {
    id: "neon",
    label: "Neon City",
    themeName: "neon",
    summary: "Grid-floor vector city. The default.",
    post: { bloom: 1, chromaticAberration: 1 },
  },
  {
    id: "alpine",
    label: "Summit Pass",
    themeName: "alpine",
    summary: "Cold mist and pines. Quiet, high-contrast.",
    post: { bloom: 0.8, vignette: 1.2 },
    camera: { fovGain: 0.95 },
  },
  {
    id: "mars",
    label: "Red Expanse",
    themeName: "mars",
    summary: "Dust and low sun. Heavy, warm, fast.",
    post: { bloom: 1.1, noise: 1.2, chromaticAberration: 1.15 },
    reactivity: { fogGain: 1.15, glowGain: 1.1 },
  },
  {
    id: "anime",
    label: "Toon Valley",
    themeName: "anime",
    summary: "Soft blossom valley. Bright, forgiving.",
    post: { bloom: 0.7, chromaticAberration: 0.7, vignette: 0.7 },
    reactivity: { speedGain: 0.9 },
  },
  {
    id: "rainbow",
    label: "Spectrum Run",
    themeName: "rainbow",
    summary: "Prism crystal. Maximum saturation.",
    post: { bloom: 1.3, chromaticAberration: 1.35, radialBlur: 1.2 },
    reactivity: { glowGain: 1.2, speedGain: 1.15 },
  },
];

export const TRON_WORLD: WorldDefinition = {
  id: "tron",
  label: "Tron City",
  summary: "The vector-neon world. Five moods, one place.",
  modes: TRON_MODES,
  /**
   * Not complete: the sky kit and the prop silhouette still come from the
   * palette of whichever mode is active, so the five modes differ in more than
   * presentation. See the module comment.
   */
  complete: false,
};

/** Legacy theme name -> the mode that owns it. Used to migrate call sites. */
export const THEME_NAME_TO_MODE: Record<string, { worldId: string; modeId: string }> =
  Object.fromEntries(
    TRON_MODES.map((m) => [m.themeName, { worldId: TRON_WORLD.id, modeId: m.id }]),
  );
