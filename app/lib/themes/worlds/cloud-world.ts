/**
 * Cloud Kingdom — the first world that is not Tron.
 *
 * Unlike the five Tron moods, this one *is* a place, and since the
 * harmonization it renders the authored cloud-ride kit
 * (`app/components/features/route/cloud-ride/`): a sculpted banked ribbon
 * with mint pulse piping, an instanced metaball cumulus sea with cathedral
 * towers and arches, a camera-following sky shader, and a toon rider on a
 * chunky mint bike — none of the shared extrude-road / skirt / silhouette
 * machinery the Tron worlds use.
 *
 * Its two modes are the same place under different weather — which is the
 * whole point of splitting worlds from modes. "Sugar Rush" is not a different
 * place with a different palette; it is the same cumulus with a touch more
 * bloom, more fringing and a hotter response to effort. Both stay restrained:
 * the authored look is pastel and matte, so neither mode runs the heavy
 * bloom the old Sugar Rush did.
 */

import type { WorldDefinition, WorldMode } from "@/app/lib/themes/world-definition";

const CLOUD_MODES: WorldMode[] = [
  {
    id: "cotton",
    label: "Cotton Candy",
    themeName: "cloud",
    summary: "Soft daylight, gentle bloom. The default.",
    // A pastel world on a cumulus sea blows out under the shared bloom
    // curve, so both modes pull the post stack down. That is a mode weight
    // doing exactly what a mode weight is for.
    post: { bloom: 0.42, chromaticAberration: 0.35, noise: 0, vignette: 0.5 },
    reactivity: { fogGain: 1, glowGain: 0.9, speedGain: 0.95 },
  },
  {
    id: "sugar",
    label: "Sugar Rush",
    themeName: "cloud",
    summary: "A touch warmer light, a touch wider rush.",
    post: { bloom: 0.5, chromaticAberration: 0.5, noise: 0, vignette: 0.6 },
    reactivity: { fogGain: 1.1, glowGain: 1.15, speedGain: 1.15 },
  },
];

export const CLOUD_WORLD: WorldDefinition = {
  id: "cloud",
  label: "Cloud Kingdom",
  summary: "A sculpted ribbon road over a breathing cumulus sea.",
  /**
   * The authored cumulus kit — the cloud-ride sky shader plus the metaball
   * sea/cathedral layout — not one of the shared ThemeAtmosphere kits. The
   * "cloud" PropType is gone with it: the world's dressing is the instanced
   * metaball geometry, which the silhouette schema cannot express, so the
   * world declares no `props` at all rather than lying about a puff set.
   */
  atmosphereKit: "cumulus",
  ground: { kind: "cloud", color: "#e9e6f6" },
  modes: CLOUD_MODES,
  /**
   * Sugar Rush is the default mood: the Cloud Kingdom is the product's
   * default world, and a first ride should feel like the exciting one —
   * still restrained, never the old bloom-heavy wash.
   */
  defaultModeId: "sugar",
  /**
   * Complete: the world owns its sky kit, its ground and its dressing. What
   * remains on the `cloud` theme is palette + furniture (finish arch,
   * welcome sign, readout accents, the 2D focus view) — a unit test asserts
   * the world and the theme agree.
   */
  complete: true,
};
