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
      // The place's signature: trunks close enough to the road to pass the lens.
      type: "tree",
      color: "#3c4a2c",
      count: 260,
      scale: [1.1, 3.4, 1.1],
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
      color: "#5d7a3a",
      count: 320,
      scale: [1.2, 1.5, 1.2],
      band: { inner: 5, outer: 14, bias: 0.8 },
      role: "scenery",
    },
    {
      // The occasional hero: one ancient trunk every few hundred metres.
      type: "tree",
      color: "#2f3a24",
      count: 8,
      scale: [2.6, 5.2, 2.6],
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
