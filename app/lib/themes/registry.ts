/**
 * Visualizer Theme Registry — data-driven theme pipeline.
 *
 * Built-in themes live in `app/components/features/route/visualizer-theme.ts`
 * (compile-time, always available). Remote themes live in the Supabase
 * `visualizer_themes` table and are loaded at runtime via
 * `loadRemoteThemes()` — adding a second environment is an INSERT, not a
 * redeploy. See docs/THEME-PIPELINE.md.
 *
 * Lookups always succeed: unknown or invalid theme names fall back to the
 * built-in `neon` theme, so a bad remote row can never crash the ride.
 *
 * This module is plain TypeScript (no React). Components subscribe via
 * `subscribeThemes` / `getThemeVersion` (useSyncExternalStore-compatible)
 * so a late remote load re-renders the visualizer once.
 */

import {
  VISUALIZER_THEMES,
  type VisualizerTheme,
} from "@/app/components/features/route/visualizer-theme";
import { getBrowserClient, isSupabaseConfigured } from "@/app/lib/supabase/client";
import { getDefaultThemeName } from "@/app/lib/themes/worlds";

/** Shape of one theme entry. Mirrors the values of VISUALIZER_THEMES. */
export interface ThemeDefinition {
  fog: string;
  roadColor: string;
  roadEmissive: string;
  roadEmissiveIntensity: number;
  lineColor: string;
  riderColor: string;
  grid: boolean;
  stars: boolean;
  envPreset: string;
  particleColor: string;
  skyTop: string;
  skyBottom: string;
  horizonGlow: string;
  terrainColor: string;
  terrainAccent: string;
  panelColor: string;
  worldLabel: string;
  /**
   * The palette's sky style. Two consumers read it: the 2D focus view picks
   * its sky treatment off it (which is why the Cloud palette says "sun"
   * while the world's kit is "cumulus"), and a palette-only theme — a remote
   * row with no world above it — falls back to it as its atmosphere kit.
   * Built-in worlds declare their real kit on the mode (`atmosphereKit`);
   * for them this value only styles the 2D view and must mirror the kit.
   */
  atmosphere: string;
  terrainBackScale: number;
  terrainFrontScale: number;
  patternOpacity: number;
  routeDashOpacity: number;
  /**
   * The shared-kit silhouette a palette-only theme renders. Since the
   * palette/place split, no built-in theme declares one — silhouettes are
   * world data (`WorldMode.props`), and the renderer resolves them through
   * the world schema. Remote rows still must declare one: a remote row is a
   * one-mode palette world, and this is its dressing on the shared kit.
   */
  props?: {
    type: "building" | "tree" | "rock" | "blossom" | "crystal";
    color: string;
    count: number;
    scale: [number, number, number];
  };
  /** Roadmap #6 — the roadside tuft band. Optional: worlds without one keep bare skirt. */
  groundCover?: {
    /** Which silhouette the roadside band is built from. Today only the
     *  grass tufts every world shares. */
    type?: "tuft";
    color: string;
    count: number;
    scale: [number, number, number];
  };
  /**
   * Whether this world's props breathe (the one animated part of a
   * silhouette). Data, not a `theme === "…"` branch — see `docs/WORLD-SYSTEM.md`.
   */
  breathes?: boolean;
  /** The emissive intensity a breathing part sits at. Defaults to 0.8. */
  breatheEmissive?: number;
  /**
   * How far the ground ribbon's outer edge falls below the road. A shallow
   * rim reads as a continuous surface you can see across; a steep drop
   * reads as a plateau with a void beside it. Undefined = the default.
   */
  skirtEdgeDrop?: number;
  /**
   * Scene lighting for this world — the hemi/key/ambient/point rig the
   * route scene renders. Planet themes supply the same values through
   * `PlanetProfile` instead; this field is how a non-planet world (or a
   * remote theme) gets a real light rig. Undefined = neutral defaults,
   * no hemi/key pair.
   */
  lighting?: {
    ambientColor: string;
    ambientGain: number;
    hemiSky: string;
    hemiGround: string;
    hemiIntensity: number;
    keyColor: string;
    keyIntensity: number;
    /** Unnormalized [x,y,z] toward the key light; normalized at render. */
    keyDirection: [number, number, number];
    pointColor: string;
    /** Fog far plane. Undefined inside `lighting` = 250. */
    fogFar?: number;
  };
  /**
   * Base colour the effort-reactive point light lerps from. Independent of
   * `lighting.pointColor` on purpose: the reactive base is a phase accent,
   * not necessarily the scene's point colour. Undefined = #9b7bff.
   */
  reactivePointColor?: string;
  /** Colour of the grid floor lines. Undefined = #2a1d5a. */
  gridColor?: string;
  /**
   * Whether the road's emissive hue-cycles continuously (Spectrum Run's
   * signature). Undefined = false.
   */
  roadHueCycle?: boolean;
  /** Overlay noise opacity, pre-tier scaling. Undefined = 0. */
  noiseOpacity?: number;
  /** Starfield saturation. Undefined = 0 (white points). */
  starSaturation?: number;
  /** Half-width of the road edge lines in route units. Undefined = 2.3. */
  edgeLineWidth?: number;
  /** Half-width of the road's extrude profile. Undefined = 2.5. */
  roadHalfWidth?: number;
  /** Height-fog band strength. Undefined = 0.85. */
  heightFogStrength?: number;
  /**
   * Whether the scene fog colour follows the effort-reactive palette. The
   * two worlds with bespoke atmosphere kits (alpine, neon) keep their own
   * haze and ignore the reactive tint. Undefined = true.
   */
  reactiveFog?: boolean;
  /**
   * Skirt material light params (see `SkirtLight` in route-skirt.ts).
   * Undefined = the neutral light — worlds whose skirt should hold its
   * own sun/haze declare one here.
   */
  skirtLight?: {
    albedoGain: number;
    edgeShade: number;
    sunGain: number;
    /** Unnormalized [x,y,z]; normalized at render. */
    sunDirection: [number, number, number];
    fogStart: number;
    fogEnd: number;
  };
  /**
   * Which badge shape the 2D focus view draws around a story beat.
   * Data, not a theme-name branch. Undefined = "double-diamond".
   */
  beatBadge?: "diamond" | "triangle" | "orbit" | "star" | "double-diamond";
  /** 2D focus-view presentation tweaks. All fields optional. */
  focus?: {
    /** Number of tick marks on the progress arc. Default 6. */
    tickCount?: number;
    tickStroke?: string;
    /** Stroke for the dashed route overlay. Default rgba(255,255,255,0.14). */
    dashStroke?: string;
    /** Solid route base stroke instead of the gradient. Default false. */
    routeBaseSolid?: boolean;
    /** Idle float animation on beat markers. Default false. */
    float?: boolean;
  };
}

const BUILTIN = VISUALIZER_THEMES as unknown as Record<string, ThemeDefinition>;
/**
 * Where a ride lands when its world is unknown or invalid.
 *
 * This is the product's DEFAULT WORLD, not a "safe" theme: a route with a bad
 * theme name should look like every other default ride, not like a different
 * product. One constant, so the answer is in one place.
 */
const FALLBACK_THEME = getDefaultThemeName();

const themes = new Map<string, ThemeDefinition>(Object.entries(BUILTIN));

// ─── Validation ─────────────────────────────────────────────────────

const PROP_TYPES = new Set(["building", "tree", "rock", "blossom", "crystal"]);

/** Silhouettes the roadside band may be built from. */
const GROUND_COVER_TYPES = new Set(["tuft"]);

// drei v10 <Environment> presets — anything else throws during render.
const ENV_PRESETS = new Set([
  "apartment", "city", "dawn", "forest", "lobby",
  "night", "park", "studio", "sunset", "warehouse",
]);

function isHexColor(v: unknown): boolean {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

/**
 * Structural guard for remote theme rows. Strict on shape, lenient on
 * palette (any #rrggbb). Returns null for anything unusable.
 */
export function parseThemeDefinition(raw: unknown): ThemeDefinition | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Record<string, unknown>;

  const hexFields = [
    "fog", "roadColor", "roadEmissive", "lineColor", "riderColor",
    "particleColor", "skyTop", "skyBottom", "horizonGlow",
    "terrainColor", "terrainAccent",
  ] as const;
  for (const f of hexFields) if (!isHexColor(d[f])) return null;

  const numFields = [
    "roadEmissiveIntensity", "terrainBackScale", "terrainFrontScale",
    "patternOpacity", "routeDashOpacity",
  ] as const;
  for (const f of numFields) if (typeof d[f] !== "number" || !Number.isFinite(d[f])) return null;

  if (typeof d.panelColor !== "string") return null;
  if (typeof d.worldLabel !== "string" || d.worldLabel.length === 0) return null;
  if (typeof d.envPreset !== "string" || !ENV_PRESETS.has(d.envPreset)) return null;
  if (typeof d.atmosphere !== "string") return null;
  if (typeof d.grid !== "boolean" || typeof d.stars !== "boolean") return null;

  const props = d.props as Record<string, unknown> | undefined;
  if (typeof props !== "object" || props === null) return null;
  if (!PROP_TYPES.has(props.type as string)) return null;
  if (!isHexColor(props.color)) return null;
  if (typeof props.count !== "number" || props.count < 0 || props.count > 500) return null;
  const scale = props.scale;
  if (!Array.isArray(scale) || scale.length !== 3 || !scale.every((n) => typeof n === "number" && Number.isFinite(n))) return null;

  // Optional: the roadside band. Its silhouette is "tuft" unless the row says
  // otherwise, and its count is capped like the props count.
  const groundCover = d.groundCover as Record<string, unknown> | undefined;
  if (groundCover !== undefined) {
    if (typeof groundCover !== "object" || groundCover === null) return null;
    if (groundCover.type !== undefined && !GROUND_COVER_TYPES.has(groundCover.type as string)) return null;
    if (!isHexColor(groundCover.color)) return null;
    if (typeof groundCover.count !== "number" || groundCover.count < 0 || groundCover.count > 500) return null;
    const gcScale = groundCover.scale;
    if (!Array.isArray(gcScale) || gcScale.length !== 3 || !gcScale.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  }

  // Optional: does this world breathe, and how brightly.
  if (d.breathes !== undefined && typeof d.breathes !== "boolean") return null;
  if (d.breatheEmissive !== undefined && (typeof d.breatheEmissive !== "number" || !Number.isFinite(d.breatheEmissive))) return null;

  // Optional presentation fields — shape-checked, palette-lenient.
  const optHex = (v: unknown) => v === undefined || isHexColor(v);
  const optNum = (v: unknown) => v === undefined || (typeof v === "number" && Number.isFinite(v));
  const optVec3 = (v: unknown) =>
    v === undefined ||
    (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n)));

  if (d.skirtEdgeDrop !== undefined && !optNum(d.skirtEdgeDrop)) return null;
  if (!optHex(d.reactivePointColor) || !optHex(d.gridColor)) return null;
  if (!optNum(d.edgeLineWidth) || !optNum(d.roadHalfWidth) || !optNum(d.heightFogStrength)) return null;
  if (!optNum(d.noiseOpacity) || !optNum(d.starSaturation)) return null;
  if (d.reactiveFog !== undefined && typeof d.reactiveFog !== "boolean") return null;
  if (d.roadHueCycle !== undefined && typeof d.roadHueCycle !== "boolean") return null;

  const lighting = d.lighting as Record<string, unknown> | undefined;
  if (lighting !== undefined) {
    if (typeof lighting !== "object" || lighting === null) return null;
    if (!isHexColor(lighting.ambientColor) || !optNum(lighting.ambientGain)) return null;
    if (!isHexColor(lighting.hemiSky) || !isHexColor(lighting.hemiGround) || !optNum(lighting.hemiIntensity)) return null;
    if (!isHexColor(lighting.keyColor) || !optNum(lighting.keyIntensity) || !optVec3(lighting.keyDirection)) return null;
    if (!isHexColor(lighting.pointColor)) return null;
    if (lighting.fogFar !== undefined && !optNum(lighting.fogFar)) return null;
  }

  const skirtLight = d.skirtLight as Record<string, unknown> | undefined;
  if (skirtLight !== undefined) {
    if (typeof skirtLight !== "object" || skirtLight === null) return null;
    if (!optNum(skirtLight.albedoGain) || !optNum(skirtLight.edgeShade) || !optNum(skirtLight.sunGain)) return null;
    if (!optVec3(skirtLight.sunDirection)) return null;
    if (!optNum(skirtLight.fogStart) || !optNum(skirtLight.fogEnd)) return null;
  }

  if (d.beatBadge !== undefined && !["diamond", "triangle", "orbit", "star", "double-diamond"].includes(d.beatBadge as string)) return null;

  const focus = d.focus as Record<string, unknown> | undefined;
  if (focus !== undefined) {
    if (typeof focus !== "object" || focus === null) return null;
    if (!optNum(focus.tickCount)) return null;
    if (focus.tickStroke !== undefined && typeof focus.tickStroke !== "string") return null;
    if (focus.dashStroke !== undefined && typeof focus.dashStroke !== "string") return null;
    if (focus.routeBaseSolid !== undefined && typeof focus.routeBaseSolid !== "boolean") return null;
    if (focus.float !== undefined && typeof focus.float !== "boolean") return null;
  }

  return d as unknown as ThemeDefinition;
}

// ─── Lookup ─────────────────────────────────────────────────────────

/** Get a theme by name. Unknown names fall back to the built-in neon theme. */
export function getTheme(name: VisualizerTheme | string): ThemeDefinition {
  return themes.get(name) ?? themes.get(FALLBACK_THEME)!;
}

/** Names of all registered themes (built-in + remote). */
export function getThemeNames(): string[] {
  return [...themes.keys()];
}

// ─── Version + subscription (for useSyncExternalStore) ──────────────

let version = 0;
type ThemeListener = () => void;
const listeners = new Set<ThemeListener>();

export function getThemeVersion(): number {
  return version;
}

export function subscribeThemes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  version += 1;
  listeners.forEach((l) => l());
}

// ─── Remote loading ─────────────────────────────────────────────────

let loadState: "idle" | "loading" | "done" | "failed" = "idle";

/**
 * Fetch enabled themes from Supabase and register them. No-op when
 * Supabase is not configured (localStorage-fallback environments) or when
 * already loaded. Safe to call on every mount — fetches once per session.
 */
export async function loadRemoteThemes(): Promise<void> {
  if (loadState === "loading" || loadState === "done") return;
  if (typeof window === "undefined") return;
  if (!isSupabaseConfigured()) return;

  const client = getBrowserClient();
  if (!client) return;

  loadState = "loading";
  try {
    const { data, error } = await client
      .from("visualizer_themes")
      .select("name, label, definition")
      .eq("enabled", true);

    if (error) throw error;

    let registered = 0;
    for (const row of data ?? []) {
      if (typeof row.name !== "string" || row.name.length === 0) continue;
      if (BUILTIN[row.name]) continue; // built-ins win; remote cannot shadow them
      const def = parseThemeDefinition(row.definition);
      if (!def) {
        console.warn(`[themes] remote theme "${row.name}" failed validation, skipped`);
        continue;
      }
      themes.set(row.name, { ...def, worldLabel: row.label ?? def.worldLabel });
      registered += 1;
    }

    loadState = "done";
    if (registered > 0) notify();
  } catch (err) {
    loadState = "failed";
    console.warn("[themes] remote theme load failed, using built-ins only", err);
  }
}
