/**
 * Resolution — turning a (world, mode) pair into the concrete values the
 * renderer already understands.
 *
 * The point of this file is that the schema can be filled in without a flag
 * day. Today a world mostly *borrows* its shape from its mode's palette: the
 * sky kit and the prop silhouette live on `ThemeDefinition` today, and the
 * renderer reads them from there. As each world starts to own them, this
 * resolver starts preferring the world-level value — and the call sites do not
 * change.
 *
 * The precedence is always: world-level field → mode's palette → renderer
 * default. A world that owns a slot overrides the palette for every mode in
 * it, which is what makes "one place, several looks" actually one place.
 */

import type { ThemeDefinition } from "@/app/lib/themes/registry";
import { getTheme } from "@/app/lib/themes/registry";
import type {
  AtmosphereKitId,
  WorldAmbient,
  WorldDefinition,
  WorldGround,
  WorldMode,
  WorldModeCamera,
  WorldModePost,
  WorldModeReactivity,
  WorldPropSet,
} from "@/app/lib/themes/world-definition";
import { getWorld } from "@/app/lib/themes/worlds";

/** The renderer scatters props between these distances from the road edge. */
const DEFAULT_PROP_BAND = { inner: 8, outer: 23 } as const;

export interface ResolvedWorld {
  world: WorldDefinition;
  mode: WorldMode;
  /** The palette for this mode. */
  theme: ThemeDefinition;
  /** Which sky/horizon kit renders the world. */
  atmosphereKit: AtmosphereKitId;
  /** The ground the world stands on. */
  ground: WorldGround;
  /** The instanced prop sets that fill the world. */
  props: WorldPropSet[];
  /** Sound bed and particles, if the world has any. */
  ambient: WorldAmbient | null;
  post: WorldModePost;
  camera: WorldModeCamera;
  reactivity: WorldModeReactivity;
}

function atmosphereFromTheme(theme: ThemeDefinition): AtmosphereKitId {
  // `ThemeDefinition.atmosphere` is a free string today; the built-in values
  // are exactly the kit ids. A remote row with an unknown value must not
  // crash the ride, so it falls back to the neon grid.
  const known: AtmosphereKitId[] = ["grid", "mist", "dust", "sun", "prism"];
  return known.includes(theme.atmosphere as AtmosphereKitId)
    ? (theme.atmosphere as AtmosphereKitId)
    : "grid";
}

function propsFromTheme(theme: ThemeDefinition): WorldPropSet[] {
  return [
    {
      type: theme.props.type,
      color: theme.props.color,
      count: theme.props.count,
      scale: [theme.props.scale[0], theme.props.scale[1], theme.props.scale[2]],
      role: "scenery",
      band: { ...DEFAULT_PROP_BAND },
    },
  ];
}

/**
 * Resolve a (world, mode) pair.
 *
 * Unknown world or mode ids fall back to Tron rather than throwing — the same
 * rule `getTheme` follows, and for the same reason: a bad reference must never
 * take the ride down.
 */
export function resolveWorld(worldId: string, modeId: string): ResolvedWorld {
  const world = getWorld(worldId);
  const mode = world.modes.find((m) => m.id === modeId) ?? world.modes[0];
  const theme = getTheme(mode.themeName);

  return {
    world,
    mode,
    theme,
    atmosphereKit: world.atmosphereKit ?? atmosphereFromTheme(theme),
    ground: world.ground ?? { kind: "skirt", color: theme.terrainColor },
    props: world.props ?? propsFromTheme(theme),
    ambient: world.ambient ?? null,
    post: mode.post ?? {},
    camera: mode.camera ?? {},
    reactivity: mode.reactivity ?? {},
  };
}
