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

## 2. Background: Ledgers, State, and Interfaces

Rider never sees these words. Built in parallel, never blocking the ride. Direction approved 2026-10-04: **receipt-first** — evidence and the phased plan live in [plans/wedge-contract-research.md](../plans/wedge-contract-research.md); recovery flow in [plans/journey-claim-flow.md](../plans/journey-claim-flow.md).

### Three separate ledgers — never interchangeable

| Ledger | Contains | Status vocabulary |
|--------|----------|-------------------|
| **Local runtime** | Transient in-memory engine state (telemetry, flow, world) | — |
| **Durable progression** | Completed ride record + `RideReceiptV1` — device-local first (localStorage, NOT encrypted), then session-gated Supabase account sync behind the `cloud_history` consent via a durable outbox (`app/lib/sync/outbox.ts`, phase 2) | "saved on device" / "cloud save pending" / "saved to account" |
| **Optional campaign settlement** | Future bounded, funded redeemer over a signed receipt + nullifier | "redemption confirmed" |

Receipt `verification.status` is a separate axis from where the record is stored — a receipt can be `unverified` regardless of ledger location. Cloud-save job state is separate from chain anchoring/proof state. Legacy reads are migration-only and auth-owner-scoped (phase 1, deployed) — old blobs are never retroactively declared private/deleted.

### RideReceiptV1 (deployed: `app/lib/analytics/ride-receipt.ts`, release `a3c7e37`)

```ts
type RideReceiptV1 = {
  version: 1;
  receiptId: string;      // saved summary id (legacy formats preserved on read)
  sessionId: string;      // stable ride-session id
  riderId: string;        // account/wallet id
  classId: string;
  completedAt: number;
  durationSec: number;
  policyVersion: 'ride-record-v1';
  provenance: 'simulated' | 'device-observed' | 'estimated';
  progression: { rideRecorded: true };
  verification: { status: 'unverified'; issuer: null };
  redemption: { status: 'unavailable'; reason: 'redemption-not-enabled' };
  telemetryCommitment: null;
};
```

Derived from the saved summary + stable session id; carried as an optional field on `RideSummary`. V1 carries **no** raw samples, score proof, or cryptographic attestation — it is a record, not a certificate. `source-attested` provenance is reserved and cannot be client-declared. No issuer secret (e.g. EIP-712 key) ever lives on the client.

### Privacy boundary (phase 1 → 2)

- Phase 1 (deployed 2026-10-04, `a3c7e37`) closes **public** publication: telemetry, ride summaries, rider profiles, coach memory, and Sui ride anchors stop being written publicly. Public world/route asset publishing stays.
- Phase 2 (implemented 2026-10-07) closes **consent transfer**: cloud history, third-party AI/voice, instructor live view, and public achievement export are separate granular consents (`app/lib/privacy/consent.ts` + `consent-server.ts`, policy version `consent-v1`, all off by default). Third-party AI/TTS calls now throw `ConsentRequiredError` without an `ai_voice` grant — privacy-ready still requires the production `rider_consents` migration and legal review.
- Ordinary progression is not cash or transferable SPIN; tradable/cash rewards require jurisdictional legal review (EDPB privacy rules (minimization/retention/erasure — encrypted data is still personal data), Apple platform rules (3.1.1 digital goods/NFT, 5.1 health/AI consent), and jurisdictional financial review are separate concerns — see research doc §§5–7). A `RideReceiptV1` is a record, not a medical measurement or attestation certificate.

### Current vs planned chain systems

| System | Current (testnet experiment) | Planned |
|--------|------------------------------|---------|
| Avalanche Fuji | `IncentiveEngine`, ERC-20 SPIN, deployed wrapper + HonkVerifier. **Deployed wrapper is broken**: forwards wrong public-input slice (verified on-chain 2026-10-04); underlying Honk verifies fixture proofs. Corrected wrapper code exists locally, NOT deployed. | `AchievementRedeemerV2`: issuer-signed typed receipt + stable consumed nullifier, EIP-712 domain binding, expiry, campaign/user budgets, gas-payer allowlist, pause/rotation. Design phase 4 — no redeploy/adapter now. |
| Sui testnet | `RiderStats` PTB, `TelemetryAnchor` Walrus blob ids | Phase 1 (deployed): ALL personal ride telemetry/anchor writes DISABLED — no private on-chain writes; anchoring optional future |
| ZK `effort_threshold` | Noir circuit + `@aztec/bb.js` UltraHonk. **Only 3 public outputs** (`threshold_met`, `seconds_above`, `effort_score`); threshold/minDuration/classId/rider are attached metadata, NOT proven. Proof-hash replay key ≠ stable session nullifier. FTMS is transport, not attestation. | Optional privacy layer over issuer-bound commitment; real-verifier benchmarks in phase 5 |
| Yellow channels | Parked until a funded use case exists | — |

Legacy gas benchmarks used MockVerifier (the "364k/9-chunk" figures are not real-verifier measurements).

---

## 3. Performance + File Map (condensed)

Budget: <3 re-renders/s, telemetry commit 2-4Hz, probe <50ms, switch <100ms, 0 TS errors, <50MB ride growth. `frameloop="demand"`, refs for hot paths, no `setState` in RAF, granular selectors.

```
app/engines/  coordinator, telemetry, device, coaching, audio, rewards, sui, social, visualization + renderers/
app/stores/   ride, coaching, ui, sensory, ride-modal
app/lib/      flow-state, phase-theme, milestones, experience-level, context-palette, gpu-probe, themes/registry
```

*Last updated: 2026-10-04 — slimmed to foreground/background. Deleted duplicated §5 tail, collapsed chain/ZK/Yellow detail to appendix with OPERATIONS pointers.*
