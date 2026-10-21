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

const WORLDS: WorldDefinition[] = [TRON_WORLD];

const byId = new Map<string, WorldDefinition>(WORLDS.map((w) => [w.id, w]));

/** Every registered world, in picker order. */
export function getWorlds(): WorldDefinition[] {
  return [...WORLDS];
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
