# SpinChain: Architecture

> **Purpose**: Technical reference. Foreground = the wedge (effort → visual delight). Background = everything else.
> **Discipline**: Foreground ships first. Background never blocks the ride and never appears in rider language. Wedge guardrails in [WEDGE.md](./WEDGE.md). Delight spec in [CHARACTER-SYSTEM.md](./CHARACTER-SYSTEM.md). Deploy in [OPERATIONS.md](./OPERATIONS.md).

---

## 1. Foreground: The Wedge Implementation

### Engine rules (non-negotiable)

Engines are plain TS classes in `app/engines/`, wired by `RideCoordinator` via `EventBus`. React reads Zustand via granular selectors, never engines directly. Telemetry never passes through React state at input rate.

```
BLE/Simulator → TelemetryEngine → EventBus → Zustand (gated ~1Hz) → React
                                        ↘ refs → R3F Canvas (no re-render)
```

Rules: (1) no hooks in engines, (2) no whole-store subscriptions, (3) coordinator's 1Hz timer is the only ride-clock writer, (4) probe WebGL before mounting Canvas, degrade to 2D once — never retry loop.

See postmortem: React #185 (66 commits fixing setState-in-RAF). Don't repeat it.

### Renderer system

`RideVisualization` keeps Tron (3D) + Focus (2D SVG) mounted, 220ms crossfade. `probeGpu()` sets quality only — user `viewMode` (`immersive`/`focus`) wins. Auto-degrade to Focus on <25fps ×3 via `visualization:degraded`.

| Renderer | Cost | Notes |
|----------|------|-------|
| Tron (default) | Low | Procedural neon, no textures |
| Focus (fallback) | ~Zero | Always works |
| Splat / AIGen | — | Parked. No work until wedge validated. |

`frameloop="demand"` pauses hidden renderer. Same `routeElevationProfile` drives both.

### Adaptive UX (where the wedge lives)

Single source of truth: `computePhaseTheme(phase, effort)` in `app/lib/phase-theme.ts` → `{ color, glow, intensity, pulseRate, bloom }`. HUD, background, 3D scene, particles all read it. Never add a parallel color table (see [THEME-PIPELINE.md](./THEME-PIPELINE.md)).

World reactivity (~30 params/frame): road glow 0.2→1.0, fog 20→40, FOV 50°→100° on sprint, speed lines with cadence, aura/bloom/chromatic with power+HR. Computed in `app/lib/flow-state.ts`.

Flow tiers (consistency near target over time):

| Tier | Name | Delay | Visual |
|------|------|-------|--------|
| 0 | Calm | — | 1.0x |
| 1 | Focused | 8s | 1.2x |
| 2 | Flow | 15s | 1.5x |
| 3 | Super Flow | 25s | 1.8x |
| 4 | Mastery | 35s | 2.2x |

Score = consistency 40% + trajectory 25% + duration 20% + HR zone 15%.

### Delight moments (only two — curated, not a sandbox)

No free-aim abilities. Fitness is the input:

1. **Sprint = beam.** Power > threshold holds a Nova-style column + floor burn. Dies when you die.
2. **Flow = unlock.** Tier 3+ opens the big VFX (ring snap, pillar, rim). Earned by consistency, not clicks.

Milestone popup (2s, first achievement) + `RideCompletionV2` (celebration → stats → actions) close the loop. Details in CHARACTER-SYSTEM.

### Ride states

`LOADING → ACTIVATION (3-2-1, ~2.5s, skippable) → RIDING → EXITING → COMPLETION → DONE`. One modal at a time. Reduced-motion: instant skip, no parallax. HUD: 3 focal points active (primary metric + phase badge + ghost), tap to expand.

---

## 2. Background: Infrastructure (appendix)

Rider never sees these words. Built in parallel, never blocking the ride.

| System | What | Where |
|--------|------|-------|
| Settlement (Avalanche Fuji) | ERC-721 tickets, ERC-20 SPIN, `IncentiveEngine.submitZKProofBatch()`, HonkVerifier | `contracts/evm/`, OPERATIONS §4 |
| Performance (Sui testnet) | `RiderStats` 10Hz batched PTB, `TelemetryAnchor` Walrus blob IDs | `move/spinchain/`, OPERATIONS §4 |
| ZK `effort_threshold` | Noir circuit: 60s HR private, threshold/duration public → `effort_score` 0-1000. Browser proving via `@aztec/bb.js`, chunked 60s windows | `circuits/effort_threshold/` |
| Yellow channels | Nitro off-chain accrual → single on-chain mint. Consolidated into `IncentiveEngine.submitChannelProof`. HUD ticker only. | ARCHITECTURE history |
| Storage (Walrus) | Telemetry blobs (30 epochs), ghosts/worlds (permanent), coach memory blobs | `app/lib/walrus/` |
| AI coaching | Venice → NVIDIA → Gemini fallback. Rule-based pacing cues + TTS personality. Memory via Walrus blobs. | `app/engines/coaching-engine.ts` |

Full contract addresses, deploy commands, gas benchmarks (batch 9 chunks / 45min = 364k gas, ~40-80% savings): OPERATIONS §4 + §7.

---

## 3. Performance + File Map (condensed)

Budget: <3 re-renders/s, telemetry commit 2-4Hz, probe <50ms, switch <100ms, 0 TS errors, <50MB ride growth. `frameloop="demand"`, refs for hot paths, no `setState` in RAF, granular selectors.

```
app/engines/  coordinator, telemetry, device, coaching, audio, rewards, sui, social, visualization + renderers/
app/stores/   ride, coaching, ui, sensory, ride-modal
app/lib/      flow-state, phase-theme, milestones, experience-level, context-palette, gpu-probe, themes/registry
```

*Last updated: 2026-10-03 — slimmed to foreground/background. Deleted duplicated §5 tail, collapsed chain/ZK/Yellow detail to appendix with OPERATIONS pointers.*
