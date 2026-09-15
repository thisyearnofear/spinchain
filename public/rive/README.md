# SpinChain Rive assets (CLI-built)

Sources live in `rive/<name>/scene.rml`; shipped files here are built with
`pnpm rive:build` (verify: `pnpm rive:verify`). All state machines are driven
by **view-model properties** (legacy `StateMachine*` inputs are deprecated and
not used). Wrappers use `autoBind: true` + the `useViewModel*` hooks from
`@rive-app/react-canvas`.

| Asset | State machine / view model | Properties |
|---|---|---|
| `rider.riv` | `Ride` / `Ride` | `isRiding`, `cadence`, `effort` (0–1), `isSprint`, `isRecovery`, `isSpeaking`, `isReady`, `isFatigued` (booleans/numbers), `rewardPulse`, `prPulse`, `finishPulse` (triggers) |
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

## Submission notes (Rive Interactive Character Challenge)

- The character is part of the product: it reacts to real telemetry, interval
  phase, AI coach speech, on-chain reward streaming, and PR moments — not a
  standalone loop.
- Record the 30s+ walkthrough from the live ride page at
  `/rider/ride/[classId]` (use `?demo=true` or practice mode for telemetry).
- Tag `@rive_app` on social.
