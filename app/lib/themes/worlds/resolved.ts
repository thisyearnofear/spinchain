/**
 * Resolution — turning a (world, mode) pair into the concrete values the
 * renderer already understands.
 *
 * The precedence is always: **world → mode → palette → renderer default**.
 * A world that owns a slot overrides it for every mode in it — which is what
 * makes "one place, several looks" actually one place. A mode's place-level
 * fields (`atmosphereKit`, `props`) are only ever a *fill*: they apply when
 * the world leaves the slot open, which is how the five Tron moods hang
 * different skies over one place. The palette is the last resort — it is
 * only ever reached by palette-only themes (remote rows), which are
 * one-mode worlds that have not been promoted into the world registry yet.
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
import { getDefaultModeForTheme, getWorld } from "@/app/lib/themes/worlds";

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

/** Schema fields with renderer defaults filled in — band and role. */
function withPropDefaults(set: WorldPropSet): WorldPropSet {
  return { role: "scenery", band: { ...DEFAULT_PROP_BAND }, ...set };
}

function propsFromTheme(theme: ThemeDefinition): WorldPropSet[] {
  // A palette may own no silhouette at all (the authored Cloud Kingdom's
  // dressing is its metaball layout, not a shared prop set).
  if (!theme.props) return [];
  return [
    withPropDefaults({
      type: theme.props.type,
      color: theme.props.color,
      count: theme.props.count,
      scale: [theme.props.scale[0], theme.props.scale[1], theme.props.scale[2]],
    }),
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
    atmosphereKit: world.atmosphereKit ?? mode.atmosphereKit ?? atmosphereFromTheme(theme),
    // A declared ground colour wins; the palette's terrain colour fills it
    // when the ground says only what kind of surface it is.
    ground: { color: theme.terrainColor, ...(world.ground ?? { kind: "skirt" as const }) },
    props: (world.props ?? mode.props ?? propsFromTheme(theme)).map(withPropDefaults),
    ambient: world.ambient ?? null,
    post: mode.post ?? {},
    camera: mode.camera ?? {},
    reactivity: mode.reactivity ?? {},
  };
}

/**
 * Resolve the world a *theme* renders as.
 *
 * The renderer still keys on theme names — a route's `theme` field picks a
 * palette, and the palette's owning world supplies the place. `modeId`
 * selects a specific mode of that world when the route asks for one; an
 * unknown mode id falls back to the theme's default mode rather than
 * throwing.
 *
 * A theme no world claims — a remote row today — resolves as a palette-only
 * world: it keeps its palette-declared kit and silhouette (the last-resort
 * fallbacks above) and reports `complete: false`, because its place is
 * borrowed from the palette rather than declared by a world definition.
 */
export function resolveWorldForTheme(themeName: string, modeId?: string): ResolvedWorld {
  const found = getDefaultModeForTheme(themeName);
  if (!found) {
    const theme = getTheme(themeName);
    const world: WorldDefinition = {
      id: "palette",
      label: theme.worldLabel,
      summary: "A palette-only world (remote theme) on the shared kit.",
      modes: [{ id: "palette", label: theme.worldLabel, themeName }],
      complete: false,
    };
    return {
      world,
      mode: world.modes[0],
      theme,
      atmosphereKit: atmosphereFromTheme(theme),
      ground: { kind: "skirt", color: theme.terrainColor },
      props: propsFromTheme(theme),
      ambient: null,
      post: {},
      camera: {},
      reactivity: {},
    };
  }
  const mode = modeId
    ? found.world.modes.find((m) => m.id === modeId) ?? found.mode
    : found.mode;
  return resolveWorld(found.world.id, mode.id);
}
