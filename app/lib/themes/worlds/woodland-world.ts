/**
 * Greenwood — the woodland world.
 *
 * The first world added under the ambient-particle contract: a place declares
 * what drifts through its air (`WorldAmbient.particles`) and the renderer's
 * grain field draws it. Before this, that slot was schema with nothing behind
 * it, and every world's air was the same dust.
 *
 * Its sky is not new. `mist` already exists and gives a canopy the depth the
 * forest needs; a woodland-specific sky kit would be a new asset class, and
 * this world does not need one yet. The distinguishing assets are its ground
 * (leaf litter rather than a border) and its trees.
 */

import type { WorldDefinition } from "@/app/lib/themes/world-definition";

export const WOODLAND_WORLD: WorldDefinition = {
  id: "woodland",
  label: "Greenwood",
  summary: "Leaf litter, close canopy, sun in shafts — the quiet climb.",
  atmosphereKit: "mist",
  ground: {
    kind: "skirt",
    color: "#2f3d28",
    // Leaf litter sits proud of the road edge rather than dropping away: you
    // read a cutting through trees, not a road in orbit.
    edgeDrop: 0.5,
  },
  props: [
    {
      // The place's signature: crowns close enough to the road to pass the lens.
      type: "broadleaf",
      // Lit from above by a low sun through the canopy, so the crowns are much
      // lighter than a pine's needles would be. Anything near #3c4a2c reads as a
      // black cutout against the mist sky — the whole treeline disappears.
      color: "#6f8f4a",
      count: 260,
      scale: [1.0, 2.6, 1.0],
      band: { inner: 7, outer: 26, bias: 0.65 },
      role: "scenery",
    },
    {
      type: "blossom",
      color: "#c8d98a",
      count: 90,
      scale: [0.8, 0.8, 0.8],
      band: { inner: 8, outer: 20 },
      role: "scenery",
    },
    {
      type: "tuft",
      // Grass, not debris: at #5d7a3a these tufts read as black darts scattered
      // over the litter instead of the litter standing up.
      color: "#82994f",
      count: 320,
      scale: [1.2, 1.5, 1.2],
      band: { inner: 5, outer: 14, bias: 0.8 },
      role: "scenery",
    },
    {
      // The occasional hero: one ancient broadleaf every few hundred metres.
      type: "broadleaf",
      color: "#54703a",
      count: 8,
      scale: [2.2, 4.2, 2.2],
      band: { inner: 12, outer: 30 },
      role: "landmark",
      spacing: 320,
    },
  ],
  ambient: {
    bed: "forest",
    particles: {
      kind: "leaf",
      // Leaves, not dust: fewer, larger, and slower than grain.
      count: 260,
      color: "#d9b56a",
    },
    // What makes this a forest rather than a green field with trees on it:
    // light arrives in shafts, not evenly. Leaned along the palette's own key
    // light, and sized to the 8m understorey the broadleaf kit stands up.
    shafts: {
      count: 48,
      color: "#ffeec4",
      height: 9.5,
      width: 4.2,
      intensity: 0.62,
    },
  },
  complete: true,
  defaultModeId: "greenwood",
  modes: [
    {
      id: "greenwood",
      label: "Greenwood",
      themeName: "woodland",
      summary: "High summer under the canopy.",
      post: { bloom: 0.7, noise: 0.6, vignette: 0.9 },
      camera: { fovGain: 1, pitchBias: 0.02 },
      reactivity: { fogGain: 0.9, glowGain: 0.8, speedGain: 1 },
    },
  ],
};
