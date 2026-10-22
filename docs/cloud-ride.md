# Cloud ride — art-direction study (`/test-harness/cloud-ride`)

> **Status: shipped to production.** The look this harness authored is now the
> live Cloud Kingdom — `route-visualizer.tsx` renders the same modules
> (`CloudRoad`, `CloudWorldScene`, `CloudRiderRig`) driven by real telemetry
> instead of the 45s clock. This harness remains the place to tune the art.

A Cloud art-direction study — one authored 45-second pass alongside the
neutral [ride lab](./ride-lab.md). Meaningful advance from the neutral
blockout, but the clouds/rider/bike are hand-authored prototype geometry,
not final production quality. Same play mechanics
(mutated-ref clock, demand-mode canvas, scrub, pause) but a deliberately
stylised world: sculpted rounded ribbon, continuous cumulus forms, toon
rider on a chunky mint bike, coral scarf, WebAudio wind/pad/chime.

## The sequence (one route, four beats)

| Time | Chapter |
|---|---|
| 0–9s | **Above the clouds** — open air, the lower sea below. |
| 9–21s | **The cloud cathedral** — asymmetrical towers flank the road, cloud arch overhead. |
| 21–29s | **Into the light** — reveal: soft chime, light/fog warm through `revealAt`. |
| 29–45s | **One road. Open sky.** — long sweep over island banks; a second, lighter cloud arch waits at ~38s. |

## Controls

- **Play view** (low chase) / **Cinema view** (high chase) — switching keeps
  the current time; paused switches snap for comparison.
- **Play/Pause**, **Restart**, seek slider (0–45s).
- **Simulated effort** — Cruise/Build/Push changes cadence, scarf flutter,
  pulse-strip speed and wind sound only. Never route speed, density, or
  camera path.
- **Sound** — off by default; the toggle is the explicit gesture that
  creates + resumes the AudioContext (failure shows a visible "Sound
  unavailable" status). Wind + quiet pad; a soft 3-note chime once per
  forward crossing of 21s (scrub/restart never retrigger). Pause, hidden
  tab, context loss and mute silence it immediately.
- **Share this moment** — copies a paused-at-frame link.
- Keys: Space play/pause, V toggle view, M sound.
- `prefers-reduced-motion`: loads paused; disables banking, cloud breathing
  and scarf flutter. Camera path is unchanged.
- A shared link restores the world/view/frame; the pedal phase after
  mid-ride effort changes is approximate (cadence eases, feet don't jump).

Query params: `?view=play|cinema&effort=cruise|build|push&t=0..45&paused=0|1`.

## Implementation

- `app/components/features/route/cloud-ride/` — `sequence.ts` (contract:
  curve, timing bands, views, effort), `cloud-geometry.ts` (banked rounded
  ribbon, piping, dashes, shared `cloudFrameAt`), `cloud-materials.ts` (sky
  + pulse strip shaders, toon ramp), `cloud-world.tsx` (MarchingCubes
  cumulus + authored layout, breathing near towers, shared `CloudRoad` /
  `CloudWorldScene`), `cloud-rider.tsx` (cloned GLB with toon materials,
  fixed t=.6 reference pose, IK, chunky bike, scarf — shared `CloudRiderRig`),
  `cloud-scene.tsx` (Canvas, driver, camera, hook), `use-cloud-audio.ts`
  (WebAudio lifecycle, harness-only).
- `cloud-live.tsx` is the production adapter: the same scene components fed
  by the ride clock, `progressRef` and `visualEffort`. `worldView` ("play" |
  "cinema", `?view=` on the ride URL) picks the authored chase framing.
- Rider: the local `public/characters/rider-idle.glb`, cloned via
  SkeletonUtils, materials replaced with MeshToonMaterial keeping the
  golden map; Head bone scaled 1.14× after the mixer sample each frame.
- The deck is a banked rounded-rect ribbon (±0.08 rad) with mint piping and
  a travelling pulse strip; road, rider, dashes share `cloudFrameAt`.
- Prototype blockout shapes for spatial judgment — not finished art, no
  production performance claims.
- `window.__CLOUD_RIDE__.snapshot()` — read-only state + `gl.info` counters.
  With the composer off this is the single scene pass; no FPS claims.
- Prototype assets: metaball clouds are shaded solids, not volumetrics; the
  bike is handmade support geometry. Not finished production art.

## Product direction

This sequence is more than a visual test — it's the prototype for a
user-facing **free ride**: a Cloud Kingdom session with no intervals,
targets or coach, where the world alone responds to pedalling. Two
plausible homes:

- **A relaxing ride mode** — cruise at any pace; the world breathes with
  your effort. Mostly session-layer work: drop goals and coaching, let the
  scenery carry the experience.
- **A first-touch experience** — a short authored ride (~45s) to hand a
  new rider or share as a link before they commit to a real session.

Open design question: the authored sequence is scripted, peaking around
25s. A real free ride needs interest *distributed* along the route and
scaled by effort rather than timed — a rider cruising thirty minutes
shouldn't see one reveal then an empty horizon. The production world's
deterministic landmarks are a start, but pacing a goal-less ride is a
design problem, not just removing the goal UI.
