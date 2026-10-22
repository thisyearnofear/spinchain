# Ride lab

See also the authored follow-up: [Cloud ride sequence](./cloud-ride.md) — one stylised 45s pass built on the same mechanics. Its look now ships as the production Cloud Kingdom; the lab remains a comparison tool.

`/test-harness/ride-lab` — a small, isolated 3D testbed for comparing spatial
compositions before anything ships. It renders one deterministic 45-second
pass over a fixed open spline route and swaps three things independently:

- **Study** — the spatial composition around the same road:
  - *Open ribbon* — a thin deck above a cloud sea / night city. Tests height,
    openness, air.
  - *Passage & reveal* — close surroundings (cloud banks / city walls and
    beams) for the first ~half, then a hard stop at u≈.48 and an open vista.
  - *Landmark journey* — an arch across the route at u≈.58, then a smaller
    second landmark at u≈.90.
- **World** — dressing only. `cloud` (daylit cloud banks, lilac deck) and
  `neon` (night city, charcoal deck, cyan edges) share the road, route path,
  rider and camera math — switching worlds changes the world-specific
  dressing and lighting, never the road or path.
- **Camera** — High chase / Low chase / First person (with a handlebar
  silhouette instead of the rider). Switching keeps the current time.

**Recommended order of operations: pick the study first (space), then the
camera (how the space is read), then effort (how hard the rider works).**
Compare candidates at the same timestamp — scrub to t=12s (inside the
corridor), t=27s (after the reveal), t=20s (approaching the arch).

## URL controls

Controls push the comparison state into the query string, and *Share
comparison* freezes a paused-at-frame link that lands on exactly what you
were looking at:

`?world=cloud&study=passage&camera=low&effects=0&effort=steady&dpr=1&t=12&paused=1`

| Param | Values | Default |
|---|---|---|
| `world` | `cloud`, `neon` | `cloud` |
| `study` | `ribbon`, `passage`, `landmark` | `passage` |
| `camera` | `chase`, `low`, `first` | `low` |
| `effects` | `0`, `1` | `0` |
| `effort` | `steady`, `build`, `push` | `steady` |
| `dpr` | `1`, `1.5` | `1` |
| `t` | `0`–`45` (clamped) | `0` |
| `paused` | `0`, `1` | autoplays (never with reduced motion) |
| `loop` | `1` | off — plays once, then pauses at the end |

Unknown values fall back to defaults; out-of-range `t` clamps.

Keyboard: **Space** play/pause, **1/2/3** study select (disabled while focus
is inside a form control). `prefers-reduced-motion` starts paused and Restart
stays paused. Hiding the tab pauses playback; it stays paused on return.

## What it is not

- Not a production replacement and not a measure of production quality.
- Prototype geometry: clouds are opaque shaded instanced lobes plus a few
  billboard wisps — **not** volumetrics; the neon world is instanced boxes.
  The concept board is a hand-drawn spatial sketch, not finished art.
- *Simulated effort* changes cadence and a small edge/fov gain only — never
  simulation speed, scene density, or the camera path.
- No FPS numbers are shown or implied; DPR is a manual 1×/1.5× choice so
  comparisons aren't contaminated by adaptive quality.

## Implementation notes

- Scene: `app/components/features/route/ride-lab/` — `config.ts` (contract,
  curve, parsing, playback type), `lab-geometry.ts` (horizontal ribbon road,
  edge trims, distance marks), `lab-worlds.ts` (deterministic seeded layout
  descriptors), `ride-lab-world.tsx` (materials + instancing + sky),
  `ride-lab-rider.tsx` (production AnimatedModel/ProceduralBike/useCyclistPose
  rig driven by `seconds`, deterministic crank AND clip time via
  AnimatedModel's optional `timeRef`), `ride-lab-scene.tsx`
  (Canvas, clock owner, camera rig, optional bloom).
- Playback is a mutable `LabPlayback` ref; React mirrors it at 4 Hz. The
  Canvas runs `frameloop="demand"` — paused scenes render once, controls
  invalidate on change, no continuous paused RAF.
- `window.__RIDE_LAB__.snapshot()` exposes read-only state plus
  `gl.info.render`/`gl.info.memory` counters for benchmarking. **Caveat:**
  when the effects composer is on, `gl.info.render` reflects only the last
  composer pass, not scene totals. Nothing is sent anywhere.
- The concept board is a locally authored SVG schematic (three panels,
  rider POV + side elevation each) — a spatial sketch, not finished art.
- WebGL failure or context loss shows a fallback with Retry (re-probes)
  and links to the concept board / current ride demo.
- This is a prototype route — no production FPS or performance claims.
