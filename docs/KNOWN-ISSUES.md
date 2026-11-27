# Known issues

> **Status**: ACTIVE — open defects with evidence, written 2026-11-27 from the work that
> merged PR #133 (`feat/ride-lens-and-air`).
> **One job**: what is broken right now, how to prove it, and where to start. Not a roadmap
> ([RENDERING-ROADMAP.md](./RENDERING-ROADMAP.md)), not a history.
> **Rule**: an entry leaves this file when it is fixed *and* the check that would have caught
> it exists. Deleting an entry because the symptom stopped reproducing is how it comes back.

Work the list top down. Each entry says what "fixed" looks like, because "the frame looks
better now" is not a fix and cannot be reviewed. Each heading carries the issue that tracks it —
this file is the evidence, the issue is the work.

---

## 1. The Cloud Kingdom draws no geometry — P0, product's default world · [#135](https://github.com/thisyearnofear/spinchain/issues/135)

**Symptom.** The 3D view is black. The DOM overlay keeps working (HUD, coach card, `FINISH`
sign, rider markers), so the canvas is live and the camera is fine — the authored cloud kit
simply is not on screen.

**Where it shows up** (all reproduced, 2026-11-27):

| Surface | Result |
|---|---|
| `/test-harness/route-visualizer?testState=active-play&theme=cloud&paused=1`, any `progress` | black |
| `/test-harness/route-visualizer?testState=preview&theme=cloud` | black |
| `/rider/ride/demo?theme=cloud` — pre-ride preview | black |
| same URL — after Start Ride | black |
| Same harness, `theme=neon` / `alpine` / `woodland` | renders correctly |

**Evidence it is old and invisible to CI.** The committed baseline
`tests/visual-regression.spec.ts-snapshots/cloud-active-play-desktop-chromium-desktop.png`
is itself a black frame, dated 22 Oct (`35f4dc8 feat(world): Cloud Kingdom adopts the authored
ride standard`). It passes because cloud states use a 60-colour bar — an undrawn frame with
HUD text clears that. **So the suite has been green on a black default world for a month.**

**Not the cause, checked already:**

- Not the performance tier — logged `high` throughout.
- Not a shader/driver error — no `THREE`/WebGL warnings in the console.
- Not exotic GL features — the cloud kit has no transmission, no float render targets, no
  derivatives; it uses the same `EffectComposer` every world uses. So the "software renderer
  can't do it" theory is weak, and it probably fails on hardware too.
- Not a remount loop — `CloudLiveWorld` re-renders at telemetry rate, which is expected.

**Prime suspect.** The sky dome, `cloud-world.tsx`: it does
`skyMesh.position.copy(camera.position)` every frame. A dome parked on the camera that renders
opaque (or with a broken `uWarmth`) blacks out everything behind it while leaving DOM signage
visible — which is exactly the shape of this failure.

**First step.** Comment out three children of `CloudLiveWorld` one at a time —
`CloudWorldScene` (sky + cumulus + towers), `CloudRoad`, `RideAirfield` — and see which one is
covering the frame. Ten minutes, no guessing required.

**Fixed looks like:** the harness cloud frame contains sky, road and cumulus at `progress=0`
and `0.5`; then `pnpm exec playwright test tests/visual-regression.spec.ts --update-snapshots`
re-records the cloud baseline, and the cloud colour bar in `expectDrawnScene` goes back to the
same ~200 as the other worlds. Until that last step the baseline is a trap.

**Blocked check to re-enable:** `tests/effort-world.spec.ts` — the `cloud` case is `test.fixme`
with the evidence. Remove the `blocked` field once the world renders; two identical black
frames were being read as "effort changed nothing".

---

## 2. `pod install + xcodebuild (simulator)` — stale iOS pods lock · [#136](https://github.com/thisyearnofear/spinchain/issues/136)

**Symptom.** CI fails with `ios/App/Podfile.lock is stale. Run pnpm exec cap sync ios on macOS
and commit it.` The job runs `pnpm exec cap sync ios` and then fails if that changes the lock.

**Cause.** No dependency changed in the work that exposed this. The lock has drifted from the
Capacitor pods since `ba50b47 chore(ios): refresh Podfile.lock for the Capacitor 8 pods`, and
the check only surfaces when the job runs.

**First step.** On macOS with CocoaPods installed: `pnpm exec cap sync ios`, commit
`ios/App/Podfile.lock`. Check the diff is only pod versions/checksums — if it also rewrites
project files, something else is wrong.

**Fixed looks like:** the iOS job green on a PR that touches no native deps.

---

## 3. Visual regression can still come back with a blank canvas in CI · [#137](https://github.com/thisyearnofear/spinchain/issues/137)

**Symptom.** A whole shard fails with `harness never drew a scene (115 distinct colours)` —
every state in that job, not one. Other shards of the same commit pass. Roughly one run in
five on main, 2026-11-27.

**Already fixed** (do not re-fix): the harness frame budget no longer runs into a zero-sized
canvas; the harness canvas sets `preserveDrawingBuffer`; the settle wait is a deadline rather
than one screenshot; the mobile project's timeout matches the cost of a software-GL frame
budget. `readPixels` was tried as a "is this drawn" probe and is **not** the answer — under the
composer it reports one flat colour on a frame that screenshots fine.

**Still open.** When it happens, no picture is in the drawing buffer at all, so this is now
about the browser in those jobs rather than about any scene.

**First step.** Pull the failed job's `test-failed-1.png` artifact and confirm it is the CSS
backdrop (a few hundred bytes of gradient) and not a dark scene. Then, in the harness, and only
then: reload the page once and retry before failing, and pin harness `dpr` to 1 so software GL
is not shading 4× the pixels for a diff that is compared at CSS size anyway.

**Fixed looks like:** twenty consecutive visual shard runs on `main` without a blank-canvas
failure — or a harness that reports *why* the canvas never presented instead of asserting a
colour count.

---

## 4. The rider's `.riv` predates the fix to its own source — small, real · [#138](https://github.com/thisyearnofear/spinchain/issues/138)

`rive/rider/scene.rml` no longer compiles six `interpolationType="cubic"` keyframes without the
`<CubicEaseInterpolator>` they need (fixed in `c7cc32f`; `Rive verify + goldens` is green). But
the shipped `public/rive/rider.riv` is from 11 Oct, because writing a `.riv` now requires
`rive login` + `--publish` (the old `--once` flag is gone). The Ready/Fatigued idle breathing
therefore still runs on whatever easing the old build baked in.

**First step.** `rive login` then `pnpm rive:build`, and commit the four `.riv` files. Confirm
the rider still cycles and the tap panel still works on a ride.

---

## 5. Greenwood ships unlocked — a product decision, not a bug · [#139](https://github.com/thisyearnofear/spinchain/issues/139)

`UNLOCKS` in `app/lib/progression.ts` has no `world:woodland` entry, and a world with no
unlock is open to everyone (`isWorldUnlocked` returns true). So Greenwood appears next to Neon
at rank 0, like the Cloud Kingdom.

Decide: give it a rank gate (then it needs an `UnlockDefinition` with `rankIndex`/`xpRequired`
and a label), or accept it as a starter world. Nothing is broken either way — but the picker
heading currently promises "new worlds open as you climb the ladder".

---

## How these were found

Worth keeping, because the pattern repeats: three of the entries above started life as "flaky
tests". Each time, the flake was a *true* signal being measured badly — a test sampling before
a frame existed, a baseline that had been recorded black, a job that timed out and reported it
as "never drew". Before marking a visual check flaky, look at its artifact.
