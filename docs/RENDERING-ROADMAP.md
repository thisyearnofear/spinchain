# Rendering & Immersion Research

> **Status**: ACTIVE — design research and a prioritised plan for the 3D world.
> **Created**: 2026-10-20 · **Last updated**: 2026-10-20 (P0 shipped; P1 #6–9, #11 shipped ·
> remaining: P1 #10 diegetic bike readout, then the P2 backlog)
> **Scope**: how to make SpinChain's world more **immersive**, **performant**, **delightful** and
> **captivating** using current techniques from game development and real-time web rendering.
> **See also**: [WEDGE.md](./WEDGE.md) (the core loop this serves), [PROGRESSION.md](./PROGRESSION.md)
> (the ladder this work pays off), [ARCHITECTURE.md](./ARCHITECTURE.md) (current renderer facts).

---

## 1. The sources

Three primary sources drove this document, plus a wide sweep of the current literature.

| Source | Why it matters |
|--------|----------------|
| **Bruno Simon — bruno-simon.com v2** ([case study](https://www.awwwards.com/brunos-portfolio-case-study.html)) | The definitive example of a browser-native 3D world that is *captivating* rather than merely technical. WebGPU + TSL, a world built in Blender, 78,400 grass blades in one geometry, a full weather/time-of-day system, spatialised sound, 3D-native UI. |
| **The Sleepers** ([Codrops, Jul 2026](https://tympanus.net/codrops/2026/07/10/the-sleepers-creating-an-atmospheric-webgl-experience-with-lightweight-techniques)) | A Bruno Simon challenge entry whose whole thesis is *"the strongest visual impact with the simplest possible solutions."* The fake-volumetric-fog and threshold-transition techniques are directly liftable. |
| **Three.js post-processing 2026** ([roadmap](https://threejsroadmap.com/blog/the-complete-guide-to-threejs-post-processing-in-2026)) | `EffectComposer` → `RenderPipeline` (r183, node-based, TSL). Not available to us yet (we are on three 0.182) but it defines where the platform is going. |
| **100 Three.js Tips (2026)** ([utsubo](https://www.utsubo.com/blog/threejs-best-practices-100-tips)) | The current performance canon: draw-call budgets, instancing, batching, compression, adaptive quality. |
| Game-feel literature | Speed sensation, camera juice, peripheral-vision blur, layered audio-visual feedback. |

**One framing idea from Bruno Simon is worth stating up front, because it reorganises everything below:**

> "Most of the time, performance is the real constraint on creativity. Adding hundreds of cool
> features isn't the hard part, but if the experience runs at 10 FPS, no one will stick around."

That inverts the usual order. We do not start with "what can we add to be pretty" and then optimise.
We start with a **frame budget**, and every technique has to earn its place inside it.

---

## 2. What SpinChain already has (and what it is missing)

The foundation is stronger than it looks. Grounded in `app/components/features/route/route-visualizer.tsx`:

**Already good — do not rebuild these:**

- Five worlds with **distinct silhouettes** (`route-silhouettes.ts` — pine, tower, mesa, blossom,
  crystal) and **instanced** props (3 draw calls per world).
- **Bespoke sky + horizon** per world: `AlpineAtmosphere`, `NeonAtmosphere`, and the
  `PlanetAtmosphere` added for Mars / Toon Valley / Spectrum Run.
- **Per-world lighting** with theme profiles (ambient gain, hemisphere, key light, fog far).
- A **reactive layer** (`use-reactive-world.ts`) that maps effort + flow tier + phase onto fog
  colour/density, road glow, prop emissive, speed lines, FOV and sparkle — the effort→world
  transformation the wedge is built on.
- A **phase-tinted** palette (`phase-theme.ts`), a **flow-state engine** (0–4 tiers), and
  **effort-ability** delight gates.
- `EffectComposer` with bloom / chromatic aberration / noise / vignette, driven by live power
  through refs (not re-created per telemetry commit).

**The gaps, honestly named:**

> Gap status: everything below except the diegetic layer and the TSL port shipped on 2026-10-20 —
> see §4's ✅ marks and implementation notes. The table is kept as the original brief.

| Gap | Evidence |
|-----|----------|
| **The world is static.** | Props are instanced meshes with plain materials. Nothing moves except the road and the camera. Bruno's entire world "reacts to the wind." |
| **No ground cover.** | The ground is a flat `RouteSkirt`. Bruno's grass is 78,400 single-triangle blades in **one** geometry, *looped* to always fill the camera's view. |
| **No volumetric feel.** | `THREE.Fog` is distance-only. There is no height/atmosphere model, so the world reads flat rather than deep. |
| **Speed is implied, not felt.** | FOV opens with power and `SpeedLines` exist, but there is no radial/peripheral blur — the single cheapest "feels fast" effect. |
| **Adaptive quality is a cliff, not a dial.** | `gpu-probe.ts` makes a one-shot static decision. A marginal phone falls straight to the 2D Focus fallback instead of rendering 3D at reduced resolution. |
| **The world's time is not the rider's time.** | `context-palette.ts` computes time-of-day, weather, season and a full palette — and is **wired into the Scene as `contextPalette` and then never read** (it is currently an unused prop). |
| **Sound is functional, not atmospheric.** | There is a music engine and ceremony SFX. There is no environmental layer — wind, tyre roar, road surface. Bruno: *"we don't pay enough attention to sound design."* |
| **The HUD is a DOM overlay.** | Bruno rebuilds UI *inside* 3D to protect the immersion of the world. We do not want to throw away the accessible DOM HUD — but there is a middle ground (see §5). |
| **Custom shaders are raw GLSL.** | `planetary-atmosphere.ts`, `alpine-atmosphere.ts`, `neon-atmosphere.ts` and `route-skirt.ts` all use `ShaderMaterial` with GLSL. That blocks a WebGPU/TSL port. |

---

## 3. The techniques, and what each buys us

### 3.1 Immersion

**Fake volumetric fog (Sleepers technique).** Height-based fog injected into the standard materials
via `onBeforeCompile`: mix the fragment colour toward the fog colour as the fragment's *world Y*
falls below a threshold, with a `smoothstep` softness band. The same trick on an inverted sphere
produces horizon fog that meets the sky in the same colour. The animated version uses a **seamless
noise texture** (not procedural noise) plus domain warping and a distance-to-camera term — cheap,
because it is a texture fetch rather than an FBM evaluation per fragment.

*Why it fits SpinChain:* our worlds already have a fog colour per theme and the skirt already
fades to it. Height fog adds the missing vertical dimension — the ground melts into mist, the
ridge reads as distant. It is one `onBeforeCompile` patch and one uniform.

**Wind (Bruno Simon).** Everything in his world reacts to the wind: lines sweeping across the
island, grass swaying, foliage shaking. The technique is a vertex-shader displacement driven by a
`uTime` uniform, weighted by the vertex's local height so the base stays planted (the
"Breath of the Wild" grass shader pattern).

*Why it fits SpinChain:* our props are already instanced with a static material. Injecting a sway
into the instanced prop material costs **one uniform write per frame and zero CPU** — the
matrices are uploaded once and never touched again. It is the single highest delight-per-cost
change available to us.

**Weather + time of day.** Bruno runs a full weather system with day–night cycles and seasons,
and *everyone sees the same conditions at the same time*. We already compute a time-of-day /
weather / season palette — it is simply unused.

**Spatialised sound.** Bruno layers environmental audio (birds, crickets, waves, wind through
leaves, thunder), object-based sounds, and vehicle sounds, all spatialised through the Web Audio
panner. *"Sound is one of the most powerful ways to convey emotion."*

*Why it fits SpinChain:* for an indoor-cycling product this is unusually available — the sound of
a bike is a function of cadence and power, and the sound of *speed* is what riders actually feel.
A procedural wind/tyre layer that tracks cadence and speed is high immersion and near-zero asset
cost.

### 3.2 Captivating

**Speed is not a number, it is a set of cues.** The game-feel literature is consistent: velocity
is perceived through FOV, camera angle, peripheral effects and sound — *not* the speed parameter.
Radial blur is the physiological one: the human eye compresses and blurs peripheral vision at
speed, and racing games fake exactly that with a radial blur toward the screen edges.

*Why it fits SpinChain:* our wedge is that effort transforms the world. Right now effort changes
*colour and brightness*. If effort also changes **how fast the world feels**, the transformation
becomes felt rather than seen.

**Diegetic UI.** Bruno avoids traditional HTML UI entirely — real 3D models for the interface,
with clicks, scroll, keyboard, touch and gamepad all rebuilt in 3D.

*Where SpinChain should draw the line:* the DOM HUD is accessible, testable and already trusted by
the E2E suite. We should not rebuild it. But we can add a **diegetic layer** — a projected readout
on the bike computer in the 3D world — that carries the *flavour* (your interval target, your flow
tier) while the DOM HUD keeps carrying the *facts*. The world becomes the primary display and the
overlay becomes the accessible secondary.

**Achievement → cosmetic reward.** Bruno unlocks vehicle skins from achievements. Our rank ladder
already unlocks worlds; it should also unlock something the rider *wears*. The aura tier already
exists on each rank — it is declared and never rendered. Rendering it is a closed loop.

### 3.3 Performant

| Technique | Source | SpinChain application |
|-----------|--------|----------------------|
| **Draw-call budget ~100/frame on mobile** | 100 tips | We are well under (≈3 instanced draw calls per world + rider + road + sky). Not our bottleneck. |
| **Instancing** | 100 tips, Bruno | Already used for props. Extend to ground cover. |
| **Looped bands instead of full coverage** | Bruno | Grass/water/rain loop to fill the camera's view rather than covering the world. |
| **DRACO / KTX2 / ETC1S / Meshopt** | Bruno, 100 tips | Our geometry is procedural; our textures are 5 JPGs. **Low priority** — but the world art JPGs are ~300–400 KB each and uncompressed as GPU textures. |
| **Adaptive pixel ratio** | 100 tips, R3F `PerformanceMonitor` | **High value.** Converts "marginal phone → 2D fallback" into "marginal phone → 3D at 0.75× DPR". More riders see the world. |
| **`frameloop="demand"`** for static scenes | 100 tips | We already use `frameloop="never"` for the hidden 2D layer. |
| **Never create objects in `useFrame`** | 100 tips | Already true in our hot path. |
| **Cap pixel ratio** | 100 tips | Currently `Math.min(devicePixelRatio, 2)` on high tier — the 100-tips guidance is 1.0–1.5 for mobile. |
| **Occlusion queries** | 100 tips | `renderer.isOccluded()` — a real win once the world has more geometry. Later. |
| **Shader warm-up (`compileAsync`)** | 100 tips | Our world compiles 3–5 custom shaders on first frame → a visible hitch on ride start. **Real, cheap win.** |
| **Mobile preset: drop DOF/water blur, reduce shadow map** | Bruno | We have tiers, but mobile is hard-pinned to `"low"`. A proper mobile tier is better. |
| **WebGPU + TSL** | Bruno, 100 tips | Production-ready, ~87% support, and Bruno gets it *for free* via TSL. **We cannot** — our custom shaders are GLSL. A TSL port of `planetary-atmosphere` + `alpine-atmosphere` + `neon-atmosphere` + `route-skirt` is a real project, and it would also unlock compute-shader particles and GPU-driven rendering. Stage it; do not attempt it casually. |

### 3.4 Delightful

- **Layered feedback** (game juice): a moment should hit on several channels at once — visual
  (scale, colour, particles), physical (haptic), and auditory (a sound). SpinChain already has
  haptics and ceremony SFX; the missing piece is *environmental* reactivity (the world itself
  acknowledging the rider).
- **Anticipation and release**: the rank-up moment we just shipped is exactly this pattern.
- **Small, honest details**: Bruno varies the UI click sound's playback rate rather than using
  one static sample. Cheap, and it reads as craft.

---

## 4. Prioritised plan

Ordered by delight-per-unit-of-frame-budget. **P0** are the ones that change what a rider
experiences; **P1** are compounding; **P2** are the bigger projects.

### P0 — ship next

| # | Change | Delight | Perf | Effort | Where |
|---|--------|--------|------|--------|-------|
| 1 ✅ | **Wind on every world.** Vertex sway injected into the instanced prop material; gusts from a cheap sin-sum; amplitude scaled by the prop's own height. | ★★★★★ | ~0 cost (one uniform) | M | `route-silhouettes.ts` + a shared wind material |
| 2 ✅ | **Radial blur speed effect.** Custom `Effect`; strength tracks rider speed. | ★★★★★ | cheap (few taps, one pass) | S | `route-visualizer.tsx` post stack |
| 3 ✅ | **Adaptive pixel ratio.** `PerformanceMonitor` from R3F scales DPR before we fall back to 2D. | ★★★ | **negative cost** — more devices render 3D | S | `route-visualizer.tsx` canvas |
| 4 ✅ | **Height fog.** `onBeforeCompile` world-Y fog on the shared materials; horizon fog on the sky dome. | ★★★★ | ~0 | M | new `atmosphere-fog.ts` |
| 5 ✅ | **Procedural wind + tyre audio.** Web Audio filtered noise; gain and filter track cadence and speed. | ★★★★★ | CPU-audio only | M | new `app/lib/ambient-audio.ts` |

> ✅ = shipped. Implementation notes for the shipped items are below.

#### Shipped-item implementation notes (2026-10-20, commit `7280d95d6` + `9d6b16234`)

- **Wind (`app/components/features/route/wind-material.ts` + `wind-driver.tsx`).**
  The patch runs through `onBeforeCompile` on the *imperatively created* prop materials
  (`PropInstances` builds one `MeshStandardMaterial` with `useMemo` and attaches it via
  `<instancedMesh args={[geometry, material, ...]}>`). Two three.js facts this thread had to
  respect:
  1. `onBeforeCompile` runs **before** `#include` resolution — you cannot inject into a chunk
     body by replacing chunk source; you replace the `#include <project_vertex>` line and inline
     the chunk body yourself (with a guard that warns if the include disappears).
  2. The displacement is applied in **world space** (after `instanceMatrix`, before
     `modelViewMatrix`), so the whole world leans one way; a per-instance phase derived from the
     instance's own origin decorrelates the motion.
  The React Compiler additionally forbids ref writes during render and prop mutation inside
  `useFrame` — `BreathingMaterial` takes the material as a `RefObject` and receives the object
  from a layout effect.
  Wind strength tracks power (0.55 at rest → ~2.6 at 450 W), eased at 0.06/frame, and the clock
  freezes under prefers-reduced-motion while the strength keeps tracking effort.

- **Radial blur (`app/components/features/route/radial-blur-effect.tsx`).**
  A custom `postprocessing` `Effect` with `EffectAttribute.CONVOLUTION` and five taps whose
  offsets shrink toward the vanishing point. Three pmndrs facts worth remembering:
  1. `wrapEffect` and a plain `<primitive object={effectInstance} />` both mount the effect —
     the composer's child scan (`__r3f.children`) looks for `instanceof Effect`; the primitive
     route is the one retained here.
  2. **`EffectMaterial` prefixes everything it integrates** (`integrateEffect("e" + id++, …)`):
     the merged GLSL on the GPU contains `e4UStrength`/`e4MainImage`, *not* the source-level
     names — greps for the source tokens will "miss" a working shader. Verify through
     `pass.fullscreenMaterial.fragmentShader` instead.
  3. Convolution effects each get their own `EffectPass` — merging throws.
  The strength tracks `max(0, power − 120)/9000`, capped at 0.055, only in `ride` mode, and the
  effect **mounts only on the high tier** — the verified evidence (bisecting the visual-regression
  suite on the pre-change commit) is that the extra full-frame convolution pass was what pushed
  the software-WebGL finished-state baseline into intermittent black frames under parallel SwiftShader
  contention. The tier is fps-adaptive, so hardware sustaining ~60 fps still earns the effect.

- **Adaptive pixel ratio (`route-visualizer.tsx`, roadmap #3).**
  drei's `PerformanceMonitor` walks the Canvas `dpr` in 0.25 steps between 1 and the tier ceiling,
  starting from the static tier ratio. Two gates keep it honest:
  1. It mounts **only on the high tier** (`effectiveQuality.fps === 60`) in ride mode while active
     and unpaused — medium/low run `FrameRateLimiter` at 45/30 fps *by design*, and a monitor
     staring at a capped clock would permanently decline.
  2. `bounds` are tied to the 60 fps target (~55 lower), and `onFallback` (repeated flip-flop)
     parks the dpr at `base − 0.5` instead of letting resolution swaps oscillate.
  Any `quality`/`mode` switch resets the measurement. In the paused visual harness the monitor
  never mounts, so the baselines are untouched. Verified: typecheck/lint/unit + the visual suite
  green on this tree in parallel (and the suite also flaking on `main` in parallel under the same
  environment — the flake is contention, not a look change).

- **Ambient effort audio (`app/lib/ambient-audio.ts`, roadmap #5).**
  Two synthesized noise layers, no samples: wind (white noise → bandpass; gain and center
  frequency track speed/power; a 0.13 Hz LFO sweeps the filter so gusts breathe with zero
  main-thread work) and tyre hum (brown noise → lowpass; gain follows cadence/speed, `playbackRate`
  revs with cadence). The contract it must keep:
  1. **Starts only from a user gesture** (ride start), so autoplay policies are satisfied.
  2. **Sound has its own switch** — gated by `sfxEnabled()` (`spinchain:sfx:v1`), *not* by
     prefers-reduced-motion (that is a visual preference; silencing useful audio cues under it
     was a past bug, see `sfx-pref.ts`).
  3. `setTargetAtTime` everywhere (no zipper noise), peaks held under the music (~wind 0.085,
     tyre 0.065), façade in/out on start/stop with an 800 ms teardown so a fast stop→start never
     clicks (the pending teardown timer is cancelled by a re-start).
  It shares the app's single `AudioContext` via re-exported `getSharedAudioContext()` from
  `ceremony-sfx.ts` — never hit the browser's per-origin context cap mid-ride. Wired into
  `use-ride-music-flow.ts`: lifecycle follows `isRiding`; levels ride the existing telemetry
  subscription (a no-op while the graph isn't built).

- **Rank aura (`app/components/features/route/rank-aura.tsx`, P1 #8).**
  `RankAura` mounts inside `RiderMarker` and subscribes to `useProgression()` — rank changes are
  rare (rank-ups), so the subscription costs nothing at telemetry rate. Presentation by tier:
  ember = a shimmer, flow = an orbit, surge = + a vertical light pillar, apex = + a taller pillar
  and a counter-orbiting second sparkle layer. Colors come from `RANKS[n].color` (the rank's own
  identity), never the theme. Two small hard-won details: the early return for `tier === "none"`
  sits **after** `useFrame` (rules-of-hooks), and the sparkle scales/pillar radius are fixed
  integers — drei `Sparkles` reallocates its buffer when a scale prop changes size-class, and the
  budget only changes at rank-up, so buffers never churn mid-ride. Verified on the GPU with a
  seeded-apex screenshot through the paused harness: sparkle orbit + pillar visibly render around
  the rider (and the baseline suite is unaffected because the harness runs with no progression
  seed → tier `none`).

#### Shipped-item implementation notes (2026-10-20, second pass, commit `21d7714a5`)

- **Height fog (`app/components/features/route/atmosphere-fog.ts`).**
  The Sleepers vertical dimension of the haze: fragments in a low world-Y band mix toward the
  theme's fog colour, weighted by view distance — near road crisp, far road melts into mist.
  Mechanics that mattered:
  1. The patch latches onto `#include <fog_vertex>` (vertex, last chunk of main — `transformed`,
     `instanceMatrix` and `mvPosition` are all in scope) and `#include <fog_fragment>` (fragment),
     and **preserves the include lines** it matches. That is what lets it *chain* with
     `applyWind`: wind fully inlines `project_vertex`, so a fog patch that also replaced
     `project_vertex` would find nothing (its guard warning would fire) — fog deliberately never
     touches that chunk. Order at the material: `applyHeightFog(m)` then `applyWind(m)`.
  2. `modelMatrix * instanceMatrix * vec4(transformed, 1.0)` recomputes world Y instead of reusing
     `worldPosition` — that chunk's *inclusion* is conditional, so the variable is not guaranteed
     to exist. Wind is horizontal-only, so world Y is stable regardless of the sway.
  3. One shared uniform object per channel (`HEIGHT_FOG_UNIFORMS`) + a `HeightFogTuner` effect that
     re-points them at the theme's haze per world (planet worlds lift the whole band 4 units for
     their higher terrain). Applied to every prop material **and the road surface** — the latter in
     `useLayoutEffect` on the mesh ref (the patch must land before the renderer's first compile;
     after that it is lost to the program cache). The skirt is left alone: it already fades into
     the haze by its own gradient, and fogging it too would double the wash.

- **Ground cover band (`route-silhouettes.ts` tuft + `GroundCoverField`).**
  A fourth PropType ("tuft": three thin cones) and a dedicated `buildGroundCoverField` that hugs
  the road (lateral 2.5–12 vs the props' 8–23, biased 60% into the near third) and draws from its
  own seed offsets (+5000..+10000) so tufts interleave with props instead of coinciding with them.
  It reuses `PropInstances` wholesale — one extra instanced draw call per part, matrices uploaded
  once, and the sway is the same wind uniform (`WIND_FACTORS.tuft = 1.05`). Count scales by tier
  (high ×1 / medium ×0.55 / low ×0.3) — unlike the props, which stay static. Every world opts in
  via an optional `groundCover` entry in `visualizer-theme.ts` (and `ThemeDefinition` in the theme
  registry).

- **Context palette wired (`context-palette.ts` + `ride-visualization.tsx` + tron renderer).**
  `RideVisualization` owns `useContextAware()` (one palette refresh/minute — its re-render
  cadence, not telemetry's) and passes the palette through `TronRenderer` into RouteVisualizer.
  The rule throughout is **blend, don't replace**: 50% toward the palette sky (`mixHex` file
  helper), 35% into the fog/haze, <=25% into the ambient/point lights, plus a soft-light world tint
  overlay above both the 3D canvas and the DOM. Preview mode is exempt — the browser presents the
  authored look; `mode === "ride"` only. Rain/snow intensities remain unwired (no particle system
  yet) — documented scope.
  **Determinism:** the palette derives from the wall clock, which would make screenshot baselines
  drift depending on when the suite ran. `generateContextProfile` now honours a
  `window.__SPINCHAIN_FREEZE_CONTEXT__` override (checked at generate time, not module init), and
  `installTestHooks` freezes dusk/cloudy/autumn — visible in the active-play baseline as a warm
  low-sun cast, reproducible at any hour.

- **Shader warm-up (`ShaderWarmUp` in `route-visualizer.tsx`).**
  `gl.compileAsync(scene, camera)` fire-and-forget in a mount effect, with `compile` as the sync
  fallback for older three. The ride's opening frame no longer pays for compiling the wind, fog,
  road and post-stack programs. Nothing renders differently → all baselines untouched.

- **Swirling transition (`swirl-reveal.tsx`).**
  Sleepers' threshold-texture reveal applied to the activation → ride handoff: a canvas-2D veil
  (deep plum + phase accent) whose coverage falls along a domain-warped deterministic noise field
  — the dissolve unwinds as a slow vortex while the GO flash lights it. Chosen as **DOM canvas,
  not a WebGL pass** on purpose: the crossfade spans the 3D canvas *and* the 2D Focus layer, and
  the mask is ~37k pixel writes/frame at 256×144, GPU-scaled. It renders only while `goPhase` and
  not reduced-motion (the existing quick fade owns that path); the `activation-go-flash` test-id
  div is retained so the transition overlay's unit test is untouched. Two timing contracts: the
  reveal finishes (620 ms) before the parent's handoff unmount (~650 ms + exit fade), and its own
  240 ms CSS fade clears the last vanishing pixels.

#### Verification used for both

`onBeforeCompile`-patched shaders were confirmed on the GPU by recording
`WebGLRenderingContext.shaderSource` from a `page.addInitScript` hook and grepping the recorded
sources (wind: `windSway`; radial: /strength/i on the *material* shader). Visual states go through
`tests/visual-regression.spec.ts` — note that a single state can silently skip the composer on the
medium tier; check the tier when a post-effect appears missing.

**Baseline-regen gotcha:** `--update-snapshots` only rewrites baselines that *fail* comparison or
are missing. The second-pass look (height fog, ground-cover tufts, dusk cast) stayed under the
suite's tolerance (`maxDiffPixelRatio: 0.02`, `threshold: 0.2`), so a plain update run rewrote
nothing while "passing" against stale pre-arc baselines — confirmed via snapshot mtimes and
`git status`. When a look change is legitimate, **delete the affected PNGs first** and let the
update run re-capture them; the second-pass baselines (active-play/finished/preview, both
projects) were regenerated that way and the parallel re-run then reproduces them exactly.

### P1 — compounding

| # | Change | Why | Effort |
|---|--------|-----|--------|
| 6 ✅ | **Ground cover band.** Instanced tufts/blades/rocks looping to fill the camera's view (Bruno's trick) — one draw call, one geometry. | The world stops being a road on a plane | M |
| 7 ✅ | **Wire the existing context palette.** Time-of-day + weather tint the sky, fog and lights. The code exists; it is unused. | The world's time is the rider's time | M |
| 8 ✅ | **Render the aura tier.** The ladder grants an aura per rank; it is declared and never drawn. Close the progression → cosmetic loop. | Ladder payoff becomes visible in the world | M |
| 9 ✅ | **Shader warm-up.** `compileAsync` on the world shaders so the first ride frame does not hitch. | Removes a visible stall at ride start | S |
| 10 | **Diegetic bike readout.** The interval target and flow tier projected in-world; the DOM HUD keeps the facts. | The world becomes the primary display | L |
| 11 ✅ | **Swirling transition.** The Sleepers threshold-texture reveal, reused for the pre-ride → ride handoff. | The current transition is a cut | M |

### P2 — the bigger projects

| # | Change | Why | Effort |
|---|--------|-----|--------|
| 12 | **TSL port of the custom shaders.** | The only route to WebGPU, and to compute-shader particles. | **XL** |
| 13 | **Procedural ground-cover system with compute** | Bruno's grass at scale, GPU-driven | L |
| 14 | **Shared world conditions** (all riders in a class see the same weather/time) | Bruno's social proof mechanic | L (needs a server) |
| 15 | **Texture pipeline: KTX2/ETC1S + DRACO for the world art** | The 5 world JPGs are the only textures in the app | S |

---

## 5. What we are deliberately *not* doing

- **Not rebuilding the HUD in 3D.** Bruno does it; we will not. The DOM HUD is accessible,
  keyboard-navigable and covered by the E2E suite. A diegetic *layer* (item 10) gets most of the
  immersion for a fraction of the risk.
- **Not porting to WebGPU/TSL casually.** three 0.182 does not have `RenderPipeline` (r183+), and
  our custom GLSL is not WebGPU-compatible. Attempting a half-migration would break every world.
  It is a project, not a patch.
- **Not adding a full weather simulation.** A time-of-day tint from the palette we already
  computed delivers most of the feeling at a fraction of the cost.
- **Not chasing draw calls.** We are already far under budget. The bottleneck is fragment cost
  (post-processing) and fill rate, not draw calls.

---

## 6. How this is verified

Performance work is worthless without measurement. The repo already has the instrumentation:

- `tests/visual-regression.spec.ts` — pixel-diff baselines for `preview` / `active-play` /
  `finished` on desktop and mobile. Any visual change must regenerate **only** the states it
  legitimately affects, and the `ride` / `finished` baselines must stay byte-identical unless the
  change is a deliberate look change.
- `tests/effort-world.spec.ts` — asserts the effort→world transformation is *visible*
  (`meanChannelDelta`, `changedPixelPct`). This is our regression guard for "the world still
  reacts to effort".
- `app/lib/gpu-probe.ts` + `tests/webgl-fallback.spec.ts` — the 2D fallback path must keep working.
- `renderer.info` (draw calls / triangles) and `r3f-perf` for profiling.

**Rule for this track:** no effect ships without (a) a measured frame-time cost on the high tier,
(b) a measured cost on the mobile tier, and (c) a `low` tier that disables it cleanly.
