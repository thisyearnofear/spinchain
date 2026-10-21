# The World System

> **Status**: ACTIVE — schema landed 2026-10-21. The renderer still draws exactly what it
> drew before; this document describes the shape that lets the product stop having one world.
> **Created**: 2026-10-21
> **See also**: [ARCHITECTURE.md](./ARCHITECTURE.md) (current renderer facts),
> [THEME-PIPELINE.md](./THEME-PIPELINE.md) (the palette pipeline this builds on),
> [RENDERING-ROADMAP.md](./RENDERING-ROADMAP.md) (the immersion work),
> [CHARACTER-SYSTEM.md](./CHARACTER-SYSTEM.md) (the cast).

---

## 1. Why

The product has five "worlds": Neon City, Summit Pass, Red Expanse, Toon Valley, Spectrum Run.
They are five **moods of one place**.

Every one of them renders the same road on the same flat skirt, with the same camera, the same
rider, the same prop-placement algorithm, and the same reactive layer. What differs is a
palette, one of five prop silhouettes, and one of five sky kits. A rider who has ridden all
five has seen one world five times.

That is not a bug in the art. It is a limit in the schema. `ThemeDefinition` has 25 colour and
number fields plus `props.type` from a fixed set of five. There is no field in it that can say
*"the ground here is lava"*, or *"there are three different kinds of plant here"*, or *"this
place has its own sound"*. **A palette cannot express a place.**

The brief is world variety — an underworld, a cloud realm, a concrete jungle, an animated
rainforest — places a rider can tell apart at a glance and want to return to. None of those can
be a recolouring of Tron.

## 2. The distinction

> **A WORLD is a place. A MODE is a presentation variant inside a place.**

The rule for deciding which one a change belongs to:

| If the change needs… | It is a | It lives at |
|---|---|---|
| a new prop silhouette, a new ground treatment, a new sky kit, its own sound | **world** | world level |
| only a palette, a post-processing weight, a camera behaviour, a reactivity curve | **mode** | mode level |

Worlds are what make the product feel like more than one product. Modes are what make one ride
feel different across sessions. Both are needed; confusing them is what produced the current
state, where five moods had to pretend to be five places.

The legacy five looks become **modes of one Tron world**. That frees the world slot for places
that are genuinely not vector-neon. The existing rider-facing labels survive unchanged — the
modes keep the names `Neon City`, `Summit Pass`, `Red Expanse`, `Toon Valley`, `Spectrum Run`,
so nothing a rider knows today changes.

## 3. The shape

`app/lib/themes/world-definition.ts` is the contract. In words:

```
WorldDefinition
  id, label, summary
  atmosphereKit?   ─┐
  ground?           │  place-level: what makes this a place
  props[]?          │
  ambient?          │
  hero?            ─┘
  modes[]           ─┐  presentation-level: what makes it worth returning to
    id, label, themeName (palette reference)
    post?, camera?, reactivity?
  complete          ──  true once the world renders every place-level slot itself
```

Two decisions worth recording:

- **`themeName` is a reference, not a copy.** A mode points at a `ThemeDefinition` by name, so
  the Supabase remote-theme pipeline keeps working untouched and a mode can be re-skinned
  without touching the world.
- **`complete: false` is honest.** The Tron world does not yet own its sky kit or its prop
  silhouette — those still come from the palette of whichever mode is active. Until that
  split happens, Tron borrows its shape from its modes, and the flag says so rather than
  letting the picker claim five distinct places.

### Resolution

`app/lib/themes/worlds/resolved.ts` resolves a `(world, mode)` pair into the values the
renderer already understands. Precedence is always **world → mode's palette → renderer
default**, so a world that owns a slot overrides it for every mode in it — which is what
makes "one place, several looks" actually one place.

Nothing renders differently yet. The point of landing the schema first is that the world slot
can be filled in **one field at a time**, without a flag day and without a visual-regression
baseline churn.

## 4. The real tax on adding a world

The schema is not the hard part. The hard part is that the renderer branches on the theme
**name** in 54 places:

| File | `theme === "…"` branches |
|---|---|
| `route-visualizer.tsx` | 24 |
| `focus-route-visualizer.tsx` | 9 |
| `world-reactivity.ts` | 5 |
| `selection-garage.tsx` | 5 |
| `route-skirt.ts` | 1 |
| `use-class-data.ts` | 1 |
| `api/ai/generate-route/route.ts` | 1 |
| `route-world.test.ts` | 1 |
| **total** | **54** |

Every one of those is a decision that should be *data* in a world definition. `theme === "neon"`
deciding the skirt edge drop, the skirt light colour, whether a prop breathes, whether the
grid draws — none of that is about Tron; it is about a world having a ground, a prop set and a
sky. As long as those branches exist, a new world is a code change across four files, and every
new world multiplies the branch count.

**That is the real blocker, and it is a bigger one than the schema.** A new world today means
adding `theme === "underworld"` to 54 sites. The schema's job is to give those 54 sites
something to read instead.

### The migration, in order

1. **Land the schema** ✅ 2026-10-21 — `world-definition.ts`, `worlds/tron-world.ts`,
   `worlds/index.ts`, `worlds/resolved.ts`, tests in
   `app/lib/themes/__tests__/world-definition.test.ts`.
2. **Move the branches into the world definition.** Each `theme === "x"` becomes a field the
   world owns: `ground.edgeDrop`, `ground.kind`, `props[].breathes`, `skyKit`, `grid`. The
   branch count goes to zero and the theme name stops being a control-flow input.
3. **Split the palette from the place.** `ThemeDefinition` keeps the colours; the prop
   silhouette and the sky kit move up to the world. This is what flips `complete` to `true`.
4. **Then add worlds.** Each new world is one registry entry plus whatever new asset classes it
   needs (a silhouette, a ground treatment, a sky kit).

Step 2 is the unglamorous one and it is the one that makes step 4 cheap. It is also mechanical,
which makes it safe to do in small, reviewable pieces.

## 5. What a world may contain

Not everything in here is implemented. This is the target.

| Slot | Kind | Where it comes from |
|---|---|---|
| `atmosphereKit` | sky + horizon | code — a new `AtmosphereKit` (the interface already exists) |
| `ground` | the surface the road sits on | code — `skirt` today; `lava`, `ice`, `cloud`, `concrete`, `jungle` to come |
| `props[]` | instanced sets, `scenery` and `landmark` | code — new silhouettes in `route-silhouettes.ts` |
| `ambient.bed` | the sound of the place | code (procedural) or a generated audio file |
| `ambient.particles` | embers, leaves, rain, snow, dust | code |
| `hero` | a generated place | Mint world / World Labs mesh / PINOC environment |
| `post`, `camera`, `reactivity` | per mode | code — the existing stacks, weighted |

`hero` is where generated content enters. `ref` points into a **registry entry**, never a URL:
Mint and PINOC download URLs expire, and a permanent page must not embed one.

### Where the generators fit

- **A generated mesh or panorama** is a *backdrop*: `hero.role = "backdrop"`. It is the far
  layer of a world, not the world. A splat is inert — no wind, no height fog, no reactivity —
  so a splat cannot be the reactive world, only the place behind it.
- **A generated prop pack** is a world's *landmarks*: real geometry that can be lit, fogged and
  instanced. This is the highest-value use of a generator, because it is what makes a place
  recognisable.
- **A generated character** populates a world. A splat character needs the Viggle Splat Engine
  on the web (`@viggle/splat-engine` + `playcanvas`), which is a bundle cost on the mobile tier
  and must be weighed before the `Splat / AIGen` renderer row opens.

## 6. The rule for a new world

A world earns its place in the picker when a rider can tell it from the others **with the
sound off and the HUD covered**. If it is only a palette, it is a mode.

That is the test the five legacy looks currently fail, and it is the test the new worlds have
to pass.

## 7. Verification

The schema is covered by `app/lib/themes/__tests__/world-definition.test.ts` (mode/legacy-theme
bijection, resolution fallbacks, world-over-mode precedence).

When step 2 starts, the **visual-regression baselines are the guard**: a world change must
regenerate only the states it legitimately affects, and the `ride`/`finished` baselines must
stay byte-identical unless the change is a deliberate look change. The gotcha is recorded in
[RENDERING-ROADMAP.md](./RENDERING-ROADMAP.md) — `--update-snapshots` only rewrites baselines
that fail or are missing, so a subtle change can "pass" against a stale PNG. Delete the
affected PNGs first and let the update run re-capture them.
