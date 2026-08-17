# Rive Rider Avatar

This folder holds the Rive asset for the live ride HUD rider avatar:
`rider.riv`.

The React wrapper lives at
`app/components/features/ride/rive-rider.tsx` and is mounted inside
`app/components/features/ride/ride-hud.tsx` (desktop immersive view).

Until `rider.riv` is exported here, the HUD renders a lightweight CSS
fallback orb so the app stays shippable.

## Rive editor contract

Build a character in the Rive editor with a **state machine named `Ride`**
exposing these inputs. The wrapper drives them from live ride state.

| Input         | Type     | Source                  | Drives                                  |
|---------------|----------|-------------------------|-----------------------------------------|
| `isRiding`    | bool     | ride store `isActive`   | active vs idle posture                  |
| `cadence`     | number   | telemetry `cadence`     | pedal speed (0–200 RPM)                 |
| `effort`      | number   | telemetry `effort`      | normalized 0–1 lean / strain            |
| `isSprint`    | bool     | interval phase `sprint` | sprint pose, forward lean               |
| `isRecovery`  | bool     | interval phase recovery | relaxed posture, deep breath            |
| `isSpeaking`  | bool     | coaching `isSpeaking`   | mouth / gesture while coach talks       |
| `rewardPulse` | trigger  | rewards stream tick     | celebration burst on reward accrual     |
| `prPulse`     | trigger  | power PR beaten         | big celebration on personal record      |

## Export checklist

1. Rig the character (bones, mesh) in Rive.
2. Create state machine `Ride` with the inputs above.
3. Wire inputs to animations (blend trees / timelines).
4. Export `.riv` → save as `rider.riv` in this folder.
5. Reload the live ride page — the avatar replaces the fallback orb.

## Submission notes (Rive Interactive Character Challenge)

- The character is part of the product: it reacts to real telemetry, interval
  phase, AI coach speech, on-chain reward streaming, and PR moments — not a
  standalone loop.
- Record the 30s+ walkthrough from the live ride page at
  `/rider/ride/[classId]` (use `?demo=true` or practice mode for telemetry).
- Tag `@rive_app` on social.
