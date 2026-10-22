/**
 * Cloud Kingdom — the first world that is not Tron.
 *
 * Unlike the five Tron moods, this one *is* a place: it owns a sky (the
 * planet shader's pastel daylight style, which already draws cotton cloud
 * bands), a ground (a cloud sea the road floats over), a silhouette of its
 * own (soft spheres that bob), and a sound of its own.
 *
 * Its two modes are the same place under different weather — which is the
 * whole point of splitting worlds from modes. "Sugar Rush" is not a different
 * place with a different palette; it is the same cumulus with more bloom,
 * more fringing and a hotter response to effort.
 */

import type { WorldDefinition, WorldMode } from "@/app/lib/themes/world-definition";

const CLOUD_MODES: WorldMode[] = [
  {
    id: "cotton",
    label: "Cotton Candy",
    themeName: "cloud",
    summary: "Soft daylight, gentle bloom. The default.",
    // A white road on a white cloud sea blows out under the shared bloom
    // curve, so this world pulls the whole post stack down. That is a mode
    // weight doing exactly what a mode weight is for.
    post: { bloom: 0.42, chromaticAberration: 0.35, noise: 0, vignette: 0.5 },
    reactivity: { fogGain: 1, glowGain: 0.9, speedGain: 0.95 },
  },
  {
    id: "sugar",
    label: "Sugar Rush",
    themeName: "cloud",
    summary: "Hotter light, more colour, a wider rush.",
    post: { bloom: 0.68, chromaticAberration: 0.9, noise: 0, vignette: 0.8 },
    reactivity: { fogGain: 1.1, glowGain: 1.15, speedGain: 1.15 },
  },
];

export const CLOUD_WORLD: WorldDefinition = {
  id: "cloud",
  label: "Cloud Kingdom",
  summary: "Cuddly cumulus, rainbow sugar, a road that floats.",
  /**
   * The planet shader's pastel daylight style — its sky already draws the
   * cotton cloud bands, so the world needs a palette and nothing else.
   */
  atmosphereKit: "sun",
  ground: { kind: "cloud", color: "#ffeaf7" },
  props: [
    {
      type: "cloud",
      color: "#ffffff",
      count: 60,
      scale: [1.9, 1.5, 1.9],
      role: "scenery",
      band: { inner: 8, outer: 23 },
    },
  ],
  ambient: {
    particles: { kind: "spore", count: 120, color: "#ffd6f2" },
  },
  modes: CLOUD_MODES,
  /**
   * Sugar Rush is the default mood: the Cloud Kingdom is the product's
   * default world, and a first ride should feel like the exciting one.
   */
  defaultModeId: "sugar",
  /**
   * Complete: the world owns its sky kit, its ground and its props. The
   * values are mirrored by the `cloud` theme in `visualizer-theme.ts` — the
   * renderer reads the theme today — and a unit test asserts the two agree,
   * so the mirror cannot drift.
   */
  complete: true,
};
