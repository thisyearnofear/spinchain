/**
 * The Tron world — the world the five built-in looks live in.
 *
 * The five built-in looks (Neon City, Summit Pass, Red Expanse, Toon Valley,
 * Spectrum Run) are modelled here as **modes** of one world rather than as
 * five worlds, for two reasons.
 *
 * 1. They are five looks at one place: the same road on the same flat skirt,
 *    differing in palette, in which prop silhouette stands beside it, and in
 *    which sky kit hangs above it. A world is a place; these are moods.
 * 2. Modelling them as modes frees the world slot. The product needs places
 *    that are *not* vector-neon — an underworld, a cloud realm, a concrete
 *    jungle, a rainforest — and each of those needs its own ground, its own
 *    props and its own sky. Those cannot be modes of Tron.
 *
 * Since the palette/place split (docs/WORLD-SYSTEM.md §4 step 3), the modes'
 * differing dressings are declared here as mode-level place data: each mood
 * fills the `atmosphereKit` and `props` slots the world deliberately leaves
 * open, with the values that used to sit on the palette. The palette keeps
 * only colours and furniture; `complete: true` is now honest — every
 * place-level value comes from this file, not from `ThemeDefinition`.
 */

import type { WorldDefinition, WorldMode } from "@/app/lib/themes/world-definition";

/**
 * The five legacy looks. `themeName` is the palette reference; the palette
 * keeps the colours while the mode declares the dressing it used to carry —
 * the sky kit (`atmosphereKit`) and the silhouette set (`props`), values
 * moved verbatim so the visual-regression baselines hold.
 *
 * The modes still carry NO post, camera or reactivity weights. That is
 * deliberate: those weights are applied to the render, so any value here
 * would change how an existing world looks — and the visual-regression
 * baselines are the contract on those looks. The Cloud world's modes are
 * the proof that a mode can be more.
 */
const TRON_MODES: WorldMode[] = [
  {
    id: "neon",
    label: "Neon City",
    themeName: "neon",
    summary: "Grid-floor vector city. The default.",
    atmosphereKit: "grid",
    props: [{ type: "building", color: "#6d7cff", count: 40, scale: [2, 8, 2] }],
  },
  {
    id: "alpine",
    label: "Summit Pass",
    themeName: "alpine",
    summary: "Cold mist and pines. Quiet, high-contrast.",
    atmosphereKit: "mist",
    props: [{ type: "tree", color: "#22543d", count: 120, scale: [0.5, 2, 0.5] }],
  },
  {
    id: "mars",
    label: "Red Expanse",
    themeName: "mars",
    summary: "Dust and low sun. Heavy, warm, fast.",
    atmosphereKit: "dust",
    props: [{ type: "rock", color: "#92400e", count: 80, scale: [1, 1, 1] }],
  },
  {
    id: "anime",
    label: "Toon Valley",
    themeName: "anime",
    summary: "Soft blossom valley. Bright, forgiving.",
    atmosphereKit: "sun",
    props: [{ type: "blossom", color: "#fbcfe8", count: 200, scale: [0.3, 0.3, 0.3] }],
  },
  {
    id: "rainbow",
    label: "Spectrum Run",
    themeName: "rainbow",
    summary: "Prism crystal. Maximum saturation.",
    atmosphereKit: "prism",
    props: [{ type: "crystal", color: "#00ffff", count: 60, scale: [0.5, 3, 0.5] }],
  },
];

export const TRON_WORLD: WorldDefinition = {
  id: "tron",
  label: "Tron City",
  summary: "The vector-neon world. Five moods, one place.",
  /**
   * One ground for one place: all five moods ride the same flat skirt. Its
   * colour and edge drop stay on the palette — those are the mood's paint
   * on a shared surface, not a different ground.
   */
  ground: { kind: "skirt" },
  modes: TRON_MODES,
  /**
   * Complete: the world owns its ground, and its modes declare their own
   * skies and silhouettes — nothing place-level is read off the palette any
   * more. What the modes still borrow is furniture (lighting, skirt light,
   * the tuft band), which is palette data by design.
   */
  complete: true,
};

/** Legacy theme name -> the mode that owns it. Used to migrate call sites. */
export const THEME_NAME_TO_MODE: Record<string, { worldId: string; modeId: string }> =
  Object.fromEntries(
    TRON_MODES.map((m) => [m.themeName, { worldId: TRON_WORLD.id, modeId: m.id }]),
  );
