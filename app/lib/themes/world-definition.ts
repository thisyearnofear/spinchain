/**
 * World Definition — the shape a *place* takes.
 *
 * Why this exists: `ThemeDefinition` (see `registry.ts`) is a palette. It can
 * express five moods, but it cannot express five places, because every field
 * it has is a colour, a number, or one of five prop silhouettes. The five
 * built-in themes all render the same road on the same flat skirt, so they are
 * five looks at one world — not five worlds.
 *
 * A **world** is a place: it owns the sky, the ground, the things that stand in
 * it, the sound of it, and (optionally) generated hero content. A **mode** is a
 * presentation variant *within* a place: a palette, a post-processing stack, a
 * camera behaviour, a reactivity curve.
 *
 * The distinction is a hard rule, not a preference:
 *
 *   - If a difference needs a new asset class (a new prop silhouette, a new
 *     ground treatment, a new sky kit), it is a WORLD and it belongs at
 *     world level.
 *   - If a difference is palette, post, camera or reactivity, it is a MODE and
 *     it belongs at mode level.
 *
 * Modes are cheaper to author and cheaper to render, and they are what makes a
 * single ride feel different across sessions. Worlds are what make the product
 * feel like more than one product. Both are needed; they must not be confused.
 *
 * Nothing here renders yet. `resolved.ts` resolves a (world, mode) pair into the
 * concrete values the renderer already understands, so the schema can be filled
 * in incrementally without a flag day. See `docs/WORLD-SYSTEM.md`.
 */

import type { PropType } from "@/app/components/features/route/route-silhouettes";

/** The sky/horizon kits that exist in the renderer today. */
export type AtmosphereKitId =
  | "grid"      // neon-atmosphere
  | "mist"      // alpine-atmosphere
  | "dust"      // planetary-atmosphere
  | "sun"       // planetary-atmosphere
  | "prism"     // planetary-atmosphere
  | "cumulus";  // cloud-ride — authored sky shader + metaball sea, not ThemeAtmosphere

/**
 * Post-processing weights a mode can set. Every field is a multiplier on the
 * existing stack in `route-visualizer.tsx`; `undefined` means "leave the
 * world default alone". The stack is already tier-gated, so a mode never
 * switches an effect on for a tier that has it off.
 */
export interface WorldModePost {
  bloom?: number;
  chromaticAberration?: number;
  noise?: number;
  vignette?: number;
  grain?: number;
  /** Radial blur is a high-tier-only effect; a mode may only scale it. */
  radialBlur?: number;
}

/** Camera behaviour for a mode. Units are the renderer's existing units. */
export interface WorldModeCamera {
  /** Multiplier on the reactive FOV range (1 = the world's own curve). */
  fovGain?: number;
  /** Extra degrees of vertical look-down at high speed. */
  pitchBias?: number;
}

/**
 * How effort maps onto the world. `use-reactive-world.ts` owns the curve; a
 * mode scales it. `1` is neutral.
 */
export interface WorldModeReactivity {
  /** Scales the reactive fog density/distance response. */
  fogGain?: number;
  /** Scales road-glow and emissive response to power. */
  glowGain?: number;
  /** Scales the speed-line and FOV response. */
  speedGain?: number;
}

/**
 * One presentation variant inside a world.
 *
 * `themeName` points at a `ThemeDefinition` by name — today that is one of the
 * five built-ins or a Supabase row. It stays a *reference*, not a copy, so the
 * existing remote-theme pipeline keeps working unchanged.
 */
export interface WorldMode {
  id: string;
  label: string;
  /** Name of the palette this mode uses, resolved through the theme registry. */
  themeName: string;
  /** One line for the world picker. */
  summary?: string;
  post?: WorldModePost;
  camera?: WorldModeCamera;
  reactivity?: WorldModeReactivity;
}

/** The ground a world stands on. `skirt` is the current flat road-side plane. */
export type WorldGroundKind =
  | "skirt"
  | "lava"
  | "ice"
  | "cloud"
  | "concrete"
  | "jungle";

export interface WorldGround {
  kind: WorldGroundKind;
  /** Base colour of the ground surface. */
  color?: string;
  /** Emissive strength — lava and crystal ground use this. */
  emissive?: number;
  /**
   * How far the skirt edge drops below the road surface. The renderer reads
   * this per world instead of branching on the theme name.
   */
  edgeDrop?: number;
}

/** One instanced prop set belonging to a world. */
export interface WorldPropSet {
  type: PropType;
  color: string;
  count: number;
  scale: [number, number, number];
  /**
   * Placement band, in world units from the road edge. The current renderer
   * scatters props between 8 and 23 units; a band makes that per-world.
   */
  band?: { inner: number; outer: number; /** 0..1 share biased toward `inner`. */ bias?: number };
  /**
   * `scenery` is the repeated field. `landmark` is the occasional hero prop —
   * the thing that makes a place recognisable at a glance. Landmarks are few
   * and individually placed, which is why they are not just another count.
   */
  role?: "scenery" | "landmark";
  /** Only meaningful for landmarks: place them every N units along the route. */
  spacing?: number;
}

/** The particle systems a world carries (embers, leaves, rain, snow, dust). */
export interface WorldAmbient {
  /** Identifier for an audio bed — procedural in-app, or a registered file. */
  bed?: string;
  particles?: {
    kind: "ember" | "leaf" | "rain" | "snow" | "dust" | "spore";
    count: number;
    color: string;
  };
}

/**
 * Generated hero content — a place that came from a generator rather than from
 * primitives. `ref` points into a generated-asset registry (see
 * `app/lib/generated-worlds.json`), never a URL: those expire.
 */
export interface WorldHero {
  kind: "mesh" | "splat" | "panorama";
  ref: string;
  role: "backdrop" | "landmark";
}

/**
 * A world. Place-level fields are what make it a *place*; `modes` are what make
 * it worth returning to.
 */
export interface WorldDefinition {
  id: string;
  label: string;
  /** One line for the world picker: what this place feels like. */
  summary: string;
  /**
   * World-level sky kit. When absent, the mode's palette supplies it — which
   * is how the Tron world works today, and is the only reason the legacy
   * themes can be modelled as modes before the kits are split out.
   */
  atmosphereKit?: AtmosphereKitId;
  /** World-level ground. When absent, the mode's palette supplies a flat skirt. */
  ground?: WorldGround;
  /** World-level props. When absent, the mode's palette supplies one set. */
  props?: WorldPropSet[];
  /** World-level sound and particles. */
  ambient?: WorldAmbient;
  /** Optional generated hero content. */
  hero?: WorldHero;
  /** Presentation variants inside this world. */
  modes: WorldMode[];
  /**
   * Which mode a ride gets when nothing else chooses one. Undefined = the
   * world's first mode.
   */
  defaultModeId?: string;
  /**
   * True once the world renders every place-level slot itself. A world that is
   * not complete is borrowing its shape from its modes — that is legal (the
   * Tron world is the only complete one today) but it must not masquerade as
   * a distinct place in the picker.
   */
  complete: boolean;
}
