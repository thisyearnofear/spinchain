/**
 * World registry — the list of places the product can put a rider.
 *
 * `ThemeDefinition` (the palette) still exists and still owns the palette.
 * This registry owns the *places*. A route points at a world; a rider (or the
 * coaching engine) may point at a mode inside it.
 *
 * Adding a world is a data insert, like adding a remote theme is today
 * (`docs/THEME-PIPELINE.md`). Adding a *new asset class* for that world is
 * still code — see `docs/WORLD-SYSTEM.md` for what has to exist before a
 * world can be anything other than Tron.
 */

import type { WorldDefinition, WorldMode } from "@/app/lib/themes/world-definition";
import { TRON_WORLD } from "@/app/lib/themes/worlds/tron-world";
import { CLOUD_WORLD } from "@/app/lib/themes/worlds/cloud-world";

const WORLDS: WorldDefinition[] = [TRON_WORLD, CLOUD_WORLD];

/**
 * The world a ride gets when nothing says otherwise.
 *
 * This is the product's default world — the one a practice ride, a demo link
 * or a route with no theme lands in. It is deliberately ONE constant, so
 * "what does a ride default to" has a single answer that can be changed in
 * one place.
 */
export const DEFAULT_WORLD_ID = "cloud";

/** The mode the default world presents itself in. */
export const DEFAULT_WORLD_MODE_ID = "sugar";

const byId = new Map<string, WorldDefinition>(WORLDS.map((w) => [w.id, w]));

/** Every registered world, in picker order. */
export function getWorlds(): WorldDefinition[] {
  return [...WORLDS];
}

/** The default world — the one a ride lands in when nothing says otherwise. */
export function getDefaultWorld(): WorldDefinition {
  return byId.get(DEFAULT_WORLD_ID) ?? TRON_WORLD;
}

/** The theme name the default world uses — the palette a default ride paints. */
export function getDefaultThemeName(): string {
  const mode = getDefaultWorld().modes.find((m) => m.id === DEFAULT_WORLD_MODE_ID)
    ?? getDefaultWorld().modes[0];
  return mode.themeName;
}

/** One world by id. Unknown ids return the Tron world rather than throwing. */
export function getWorld(id: string): WorldDefinition {
  return byId.get(id) ?? TRON_WORLD;
}

/** One mode inside a world. Unknown ids return the world's first mode. */
export function getWorldMode(worldId: string, modeId: string): WorldMode {
  const world = getWorld(worldId);
  return world.modes.find((m) => m.id === modeId) ?? world.modes[0];
}

/** Every (world, mode) pair — the full appearance space of the product. */
export function getWorldModes(): { world: WorldDefinition; mode: WorldMode }[] {
  return WORLDS.flatMap((world) => world.modes.map((mode) => ({ world, mode })));
}

/**
 * Resolve the mode that presents a theme.
 *
 * `modeId` selects a specific mode of the theme's world when the route asks
 * for one; without it the world's default mode for that theme is used. An
 * unknown mode id falls back to the default rather than throwing — a bad
 * reference must never take the ride down.
 */
export function resolveModeForTheme(themeName: string, modeId?: string): WorldMode | null {
  const found = getDefaultModeForTheme(themeName);
  if (!found) return null;
  if (modeId) {
    const explicit = found.world.modes.find((m) => m.id === modeId);
    if (explicit) return explicit;
  }
  return found.mode;
}

/**
 * The mode a theme resolves to when nothing else chooses one.
 *
 * A theme may back several modes (the Cloud world's two moods share one
 * palette), so this is the mode the theme's world declares as its default
 * (or its first mode). Worlds are searched in registry order, which is why
 * the Cloud theme lands in the Cloud world and not in Tron.
 */
export function getDefaultModeForTheme(
  themeName: string,
): { world: WorldDefinition; mode: WorldMode } | null {
  for (const world of WORLDS) {
    const declared = world.defaultModeId
      ? world.modes.find((m) => m.id === world.defaultModeId)
      : undefined;
    const mode = declared ?? world.modes.find((m) => m.themeName === themeName);
    if (mode && mode.themeName === themeName) return { world, mode };
  }
  return null;
}
