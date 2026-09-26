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
  atmosphere: string;
  terrainBackScale: number;
  terrainFrontScale: number;
  patternOpacity: number;
  routeDashOpacity: number;
  props: {
    type: "building" | "tree" | "rock" | "blossom" | "crystal";
    color: string;
    count: number;
    scale: [number, number, number];
  };
}

const BUILTIN = VISUALIZER_THEMES as unknown as Record<string, ThemeDefinition>;
const FALLBACK_THEME = "neon";

const themes = new Map<string, ThemeDefinition>(Object.entries(BUILTIN));

// ─── Validation ─────────────────────────────────────────────────────

const PROP_TYPES = new Set(["building", "tree", "rock", "blossom", "crystal"]);

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
