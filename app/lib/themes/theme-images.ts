/**
 * Theme → world imagery, single source of truth.
 *
 * Every surface that renders a route/class image (landing showcase, ride
 * transition overlay, …) resolves through `worldImageFor` so a theme can
 * never show another world's art. World art lives at
 * /images/worlds/<key>.jpg, keyed by the real VisualizerTheme keys.
 *
 * Lookup always succeeds: unknown or missing route themes resolve to
 * "neon", mirroring the registry's own FALLBACK_THEME.
 */

import {
  VISUALIZER_THEMES,
  type VisualizerTheme,
} from "@/app/components/features/route/visualizer-theme";

export interface WorldImage {
  src: string;
  label: string;
}

export const WORLD_IMAGES: Record<VisualizerTheme, WorldImage> = {
  neon: { src: "/images/worlds/neon.jpg", label: VISUALIZER_THEMES.neon.worldLabel },
  alpine: { src: "/images/worlds/alpine.jpg", label: VISUALIZER_THEMES.alpine.worldLabel },
  mars: { src: "/images/worlds/mars.jpg", label: VISUALIZER_THEMES.mars.worldLabel },
  anime: { src: "/images/worlds/anime.jpg", label: VISUALIZER_THEMES.anime.worldLabel },
  rainbow: { src: "/images/worlds/rainbow.jpg", label: VISUALIZER_THEMES.rainbow.worldLabel },
};

/**
 * Legacy route.theme strings (from class metadata / demo content) → the
 * visualizer world they belong to. Choices where no exact world exists:
 */
export const ROUTE_THEME_TO_VISUALIZER: Record<string, VisualizerTheme> = {
  mountain: "alpine", // legacy name for the summit/mountain world
  alpine: "alpine", // identity
  neon: "neon", // identity
  city: "neon", // city rides belong to the Neon City world
  mars: "mars", // identity
  anime: "anime", // identity
  rainbow: "rainbow", // identity
  coastal: "alpine", // bright outdoor ride; closest calm world (no coastal world exists)
  forest: "alpine", // forested outdoor terrain; alpine is the only natural world
  group: "neon", // studio/social rides; closest energetic world
};

/** Mirrors FALLBACK_THEME in ./registry.ts — lookups never fail. */
const FALLBACK_THEME: VisualizerTheme = "neon";

/**
 * Resolve any route.theme string to its world image. Unknown/missing
 * themes fall back to neon — never to another world's art.
 */
export function worldImageFor(
  routeTheme?: string | null,
): WorldImage & { theme: VisualizerTheme } {
  const theme =
    ROUTE_THEME_TO_VISUALIZER[(routeTheme ?? "").toLowerCase()] ?? FALLBACK_THEME;
  return { ...WORLD_IMAGES[theme], theme };
}
