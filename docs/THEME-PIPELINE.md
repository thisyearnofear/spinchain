# SpinChain Theme Pipeline

> **Status**: ACTIVE — created 2026-09-24 (Phase 1 of the Sep-24 wedge handoff).
> **See also**: [ARCHITECTURE.md](./ARCHITECTURE.md) §3 (renderer system) and §4 (adaptive UX), [WEDGE.md](./WEDGE.md).

---

## What This Is

The data-driven content pipeline for ride-world environments. **Adding a second (or third) environment is a database INSERT, not a redeploy.**

Three layers:

| Layer | Where | When it loads |
|-------|-------|---------------|
| Built-in themes | `app/components/features/route/visualizer-theme.ts` (`VISUALIZER_THEMES`) | Compile time — always available, even offline |
| Theme registry | `app/lib/themes/registry.ts` (`getTheme` / `loadRemoteThemes`) | Runtime merge of built-in + remote |
| Remote themes | Supabase `visualizer_themes` table | Fetched once per browser session on visualizer mount |

## Rule: One Color Vocabulary

World reactivity (`world-reactivity.ts`) derives every phase color from
`computePhaseTheme()` + `PHASE_COLORS` (`app/lib/phase-theme.ts`) — the same
engine the HUD, flow background, and coach channel read. Dark world colors
(fog, sky, ambient) are mechanical `darken()` mixes of the phase primary.
**Never add a per-surface color table.** Pulse timing likewise reads
`pulseMs` from the phase theme, so road glow, edge strips, props, and speed
lines all breathe at the phase's rhythm (sprint ≈400–700ms, recovery ≈3–4s).

## Adding a New Environment (No Redeploy)

1. Author a theme definition matching `ThemeDefinition` (`app/lib/themes/registry.ts`). Easiest: copy the `neon` entry from `visualizer-theme.ts` and adjust.
2. Insert it:

```sql
insert into visualizer_themes (name, label, definition) values (
  'aurora',
  'Aurora Fields',
  '{
    "fog": "#071a14",
    "roadColor": "#1f2937",
    "roadEmissive": "#34d399",
    "roadEmissiveIntensity": 0.3,
    "lineColor": "#6ee7b7",
    "riderColor": "#ffffff",
    "grid": true,
    "stars": true,
    "envPreset": "night",
    "particleColor": "#a7f3d0",
    "skyTop": "#03130d",
    "skyBottom": "#0b2e1f",
    "horizonGlow": "#34d399",
    "terrainColor": "#0f2a1d",
    "terrainAccent": "#34d399",
    "panelColor": "rgba(6, 20, 14, 0.72)",
    "worldLabel": "Aurora Fields",
    "atmosphere": "grid",
    "terrainBackScale": 0.35,
    "terrainFrontScale": 0.62,
    "patternOpacity": 0.2,
    "routeDashOpacity": 0.8,
    "props": { "type": "crystal", "color": "#6ee7b7", "count": 60, "scale": [0.5, 3, 0.5] }
  }'::jsonb
);
```

3. Reference it: any route/class whose theme field is `aurora` renders with it on next page load.

Guarantees:

- **Validation**: `parseThemeDefinition()` structurally validates every remote row (hex colors, prop type whitelist, finite numbers, prop count ≤ 500). Invalid rows are skipped with a console warning.
- **Fallback**: `getTheme(name)` returns built-in `neon` for unknown names. A bad or missing remote row can never crash a ride.
- **Built-ins win**: a remote row cannot shadow a built-in theme name.
- **Offline/no-Supabase**: `loadRemoteThemes()` no-ops; built-ins only.
- **No redeploy**: rows are fetched client-side once per session; flip `enabled = false` to retract a theme instantly.

## Schema

`visualizer_themes` (Supabase project `spinchain`, ref `avcihfixqlofvkpvwmiq`):

| Column | Type | Notes |
|--------|------|-------|
| `name` | text PK | machine key, e.g. `aurora` |
| `label` | text | rider-facing world name |
| `definition` | jsonb | `ThemeDefinition` payload |
| `enabled` | bool | RLS: only enabled rows are readable |
| `created_at` | timestamptz | |

RLS: public read of enabled rows (worlds are content, not user data). Writes go through the service role (dashboard or SQL editor).

## Deferred With Environment #2

- Widening `VisualizerTheme` prop types from the built-in union to `string` (route metadata, `route-selection-step.tsx` picker, test harness `?theme=`).
- Theme thumbnails / preview cards in the route picker.
- Versioning and cache-busting of edited remote themes (currently: once per session).
