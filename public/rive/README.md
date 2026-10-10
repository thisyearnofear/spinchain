# SpinChain Rive assets (CLI-built)

Sources live in `rive/<name>/scene.rml`; shipped files here are built with
`pnpm rive:build` (verify: `pnpm rive:verify`). All state machines are driven
by **view-model properties** (legacy `StateMachine*` inputs are deprecated and
not used — one deliberate exception: the rider's right-click `celebrateClick`
input trigger, see "Pointer listeners"). Wrappers use `autoBind: true` + the
`useViewModel*` hooks from `@rive-app/react-canvas`.

| Asset | State machine / view model | Properties |
|---|---|---|
| `rider.riv` | `Ride` / `Ride` | `isRiding`, `cadence`, `effort` (0–1), `isSprint`, `isRecovery`, `isSpeaking`, `isReady`, `isFatigued`, `riderTapped` (booleans/numbers), `rewardPulse`, `prPulse`, `finishPulse` (triggers) |
| `effort-aura.riv` | `Aura` / `Aura` | `intensity` (0–1), `isSprint`, `flowPulse` |
| `coach-orb.riv` | `Coach` / `Coach` | `emotion` (0 calm…3 celebratory), `isSpeaking`, `celebrate` |
| `flow-badge.riv` | `Badge` / `Badge` | `flowTier` (0–4), `streak`, `milestone`, `levelUp` |

The React wrappers live in `app/components/features/ride/rive-*.tsx`:

- `RiveRider` (mounted bottom-left in `ride-hud-overlay-v2.tsx` — the live ride HUD; also in the `ride-completion-v2.tsx` celebration and the `/rider` hero greeting)
- `RiveEffortAura` (background layer behind the HUD)
- `RiveCoachOrb` (coach profile `/agent`, and beside the coach debrief in `ride-completion-v2.tsx`)
- `RiveFlowBadge` (hero + dashboard gamification signal)

All wrappers are lazy-loaded via `next/dynamic` at their mount sites, and the
WASM runtime is self-hosted (`rive.wasm` here, copied by
`scripts/copy-rive-wasm.mjs` on postinstall, wired via
`rive-runtime.ts` → `RuntimeLoader.setWasmUrl`).

**Versions**: scenes are built with the Rive CLI (`rive update` keeps it
current; 1.5.1 as of 2026-10-10). The web runtime is
`@rive-app/react-canvas` 4.36.0 with a `pnpm.overrides` pin of
`@rive-app/canvas` **2.44.2** — first pointer-listener mouse-button support
landed in 2.44.1 (Rive Editor 0.9.104); 2.44.2's wasm is byte-identical to
2.44.1's (JS-layer fixes only). Remove the override once react-canvas depends
on ≥2.44.1 (checked 2026-10-10: the latest react-canvas is still 4.36.0,
pinning canvas 2.44.0 — the override stays; re-check with
`npm view @rive-app/react-canvas dependencies`).

## Pointer listeners (rider)

`rive/rider/scene.rml` has two `StateMachineListener`s on an invisible
`RiderHitArea` shape — the app's first interactive Rive surface:

- **Left-click** (primary) writes the `riderTapped` **boolean**; `RiveRider`
  observes it via `useViewModelInstanceBoolean`, resets it to `false`, and the
  ride HUD opens the data-ownership panel.
- **Right-click** (secondary) plays the FX-layer small burst via the
  `celebrateClick` `StateMachineTrigger` input (`ListenerTriggerChange` →
  `TransitionTriggerCondition`).

**Web-runtime button-filter bug**: `@rive-app/canvas` 2.44.1 **and 2.44.2**
ignore `pointerButtonValue` on `ListenerInputTypePointerButton` (re-verified
on 2.44.2, 2026-10-10, against a two-listener repro scene) — every mouse
button matches a *primary* listener and a *secondary* one never fires at all.
The scene still declares both listeners for editor fidelity, but in the
browser the `TapRider` listener fires on left AND right clicks; `RiveRider`
records the button from `onPointerDownCapture` and dispatches: left → host
callback (panel), right → `celebrateInput.fire()` from JS. Re-check this on
every runtime bump — when the filter works, the right-click can go back to
being pure in-scene feedback.

**Listener → VM trigger writes: works, but needs an instance default.** An
earlier note here claimed these never fire comparators — that was wrong.
The repro was missing a `ViewModelInstanceTrigger` entry for the trigger
property in the `ViewModelInstance` block; with no instance value, the
listener write lands nowhere and no comparator ever sees it. Declare
`<ViewModelInstanceTrigger propertyValue="0" viewModelPropertyId="…"/>` and
the write fires transitions correctly (verified on 2.44.1 and 2.44.2).
`riderTapped` stays a boolean anyway: the host must discriminate buttons
itself (bug above), and the write→observe→reset round-trip is proven.

Pointer-events policy: canvases stay `pointer-events-none` everywhere unless
a mount passes `onTapped` (only `ride-hud-overlay-v2.tsx` does), which also
suppresses the browser context menu over the canvas.

**`.riv` URL-cache poisoning (all wrappers)**: the web runtime caches imported
`.riv` files by URL and `react-canvas` destroys the cache entry when an
instance unmounts. Any later instance loading the same URL — a remount, or
the ride page's loading→HUD rider swap sharing `/rive/rider.riv` — gets a
file whose **state-machine trigger transitions silently stop firing** while
VM booleans and listeners keep working (verified on 2.44.1). `rive-runtime.ts`
exports `useRivSrc(base)`, which gives every instance a cache-busted URL.
React's dev-only StrictMode double-mount defeats per-component nonce values
(the remount reuses the same state), so `next.config.ts` sets
`reactStrictMode: false` — production never double-mounts; this trades a dev
lint-equivalent for Rive correctness.

**Early Access caveat**: strokes use `position="inside|outside"` (0.9.104 EA,
Rive Renderer only). Older runtimes draw them centered — safe here because we
ship both the `.riv` and the WASM, but don't open these files in older
viewers expecting identical rings.

Until a `.riv` exists here, each wrapper renders a graceful fallback (or
nothing, for the aura) so the app stays shippable.

## Rive editor contract (rider)

Build a character in the Rive editor with a **state machine named `Ride`**
bound to a view model with the properties above. The wrapper drives them
from live ride state.

| Property      | Type     | Source                  | Drives                                  |
|---------------|----------|-------------------------|-----------------------------------------|
| `isRiding`    | bool     | ride store `isActive`   | active vs idle posture                  |
| `cadence`     | number   | telemetry `cadence`     | pedal loop tier (Easy ≤70, Tempo 71–95, Fast ≥96 RPM) |
| `effort`      | number   | telemetry `effort`      | normalized 0–1 → torso lean bind (0–0.18 rad) |
| `isSprint`    | bool     | interval phase `sprint` | sprint pose, forward lean               |
| `isRecovery`  | bool     | interval phase recovery | relaxed posture, deep breath            |
| `isSpeaking`  | bool     | coaching `isSpeaking`   | mouth / gesture while coach talks       |
| `isReady`     | bool     | `ready` prop (pre-ride) | eager bounce while parked               |
| `isFatigued`  | bool     | `fatigued` prop (7-day load) | heavy sag while parked             |
| `rewardPulse` | trigger  | rewards stream tick     | small burst on reward accrual           |
| `prPulse`     | trigger  | power PR beaten         | big celebration on personal record      |
| `finishPulse` | trigger  | ride finished           | small burst — every finish celebrates   |

## Export checklist

1. Rig the character (bones, mesh) in Rive.
2. Create state machine `Ride` bound to a `Ride` view model with the properties above.
3. Wire properties to animations (blend trees / timelines).
4. Export `.riv` → save as `rider.riv` in this folder (or author `rive/rider/scene.rml` and run `pnpm rive:build`).
5. Reload the live ride page — the avatar replaces the fallback orb.

**Rotation convention**: Rive renders rotations clockwise-positive. The rider
rig was originally authored counter-clockwise-positive (every limb/crank
rotation inverted; re-posed 2026-10-08). Always check pose changes with
`rive . --screenshot` before shipping rig edits — a clean `verify` does not
catch a backwards pose.

## Submission notes (Rive Interactive Character Challenge)

- The character is part of the product: it reacts to real telemetry, interval
  phase, AI coach speech, on-chain reward streaming, and PR moments — not a
  standalone loop.
- Record the 30s+ walkthrough from the live ride page at
  `/rider/ride/[classId]` (use `?demo=true` or practice mode for telemetry).
- Tag `@rive_app` on social.
