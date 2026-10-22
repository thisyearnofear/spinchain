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

### World system (worlds vs modes)

A **world** is a place; a **mode** is a presentation variant inside one. The rule: if a change
needs a new asset class (prop silhouette, ground treatment, sky kit, its own sound) it is a
world; if it is only palette / post / camera / reactivity it is a mode.

Schema in `app/lib/themes/world-definition.ts`; registry in `app/lib/themes/worlds/`; resolution
(`world → mode's palette → renderer default`) in `app/lib/themes/worlds/resolved.ts`. The five
legacy looks are **modes of one Tron world**, so the world slot is free for places that are
genuinely not vector-neon.

**The Cloud Kingdom is the first such world** — its own sky (the planet shader's pastel
daylight style), its own ground (a cloud sea), its own silhouette (soft bobbing puffs), its own
roadside band, and two modes (Cotton Candy / Sugar Rush). It shipped on 2026-10-22 with the
five legacy worlds pixel-identical (visual regression 10/10).

**The default world is the Cloud Kingdom, in Sugar Rush** (2026-10-22). One constant
(`DEFAULT_WORLD_ID` / `DEFAULT_WORLD_MODE_ID` in `app/lib/themes/worlds/index.ts`) decides what
a practice ride, a route with no theme, the guest demo class and the visualizer's own default
prop all resolve to. The world's *mood* is a first-class part of the route now: it travels in
the route metadata (`route.worldMode`) and through the renderer as `worldMode`.

A new world is now **mostly data**: whether a world breathes (`breathes`,
`breatheEmissive`), what its roadside band is made of (`groundCover.type`), how far the
ground's edge drops (`skirtEdgeDrop`), and how a mode presents and responds to effort
(`post`, `reactivity`) are theme/world fields, not `theme === "…"` branches. The Cloud world
cost **two** theme-name branches (the garage icon and the demo route's terrain tags).

The rest of the 53 branches are still there, and they are the next platform-sized piece of
work: each one is a decision that should be a field the world owns. Full plan, the migration
order and the scars: [WORLD-SYSTEM.md](./WORLD-SYSTEM.md).

A **world** is also where generated content enters (`hero` slot): a Mint world / World Labs
mesh / PINOC environment is a *backdrop*, never the reactive world — a splat cannot take wind,
height fog or the effort-reactivity. The `Splat / AIGen` renderer row above stays parked.

### Adaptive UX (where the wedge lives)

Single source of truth: `computePhaseTheme(phase, effort)` in `app/lib/phase-theme.ts` → `{ color, glow, intensity, pulseRate, bloom }`. HUD, background, 3D scene, particles all read it. Never add a parallel color table (see [THEME-PIPELINE.md](./THEME-PIPELINE.md)).

World reactivity (~30 params/frame): road glow 0.2→1.0, fog 20→40, FOV 50°→100° on sprint, speed lines with cadence, aura/bloom/chromatic with power+HR. Computed in `app/lib/flow-state.ts`.

Flow tiers (consistency near target over time):

| Tier | Name | Delay | Visual |
|------|------|-------|--------|
| 0 | baseline (unlabeled) | — | 1.0x |
| 1 | Focused | 8s | 1.2x |
| 2 | Flow | 15s | 1.5x |
| 3 | Super Flow | 25s | 1.8x |
| 4 | Mastery | 35s | 2.2x |

Score = consistency 40% + trajectory 25% + duration 20% + HR zone 15%.

Tier 0 is the baseline, not a named state: the HUD badge hides it (`FLOW_LABELS[0] = ""`) and the
diegetic readout prints **STEADY** on the rider's own color. Tiers 1–4 share one vocabulary
(`FLOW_LABELS` / `FLOW_COLORS` in `app/lib/flow-state.ts`) across the HUD badge, the celebration
overlay and the 3D world.

### World immersion layer (3D, shipped 2026-10-20 — spec + scar history in [RENDERING-ROADMAP.md](./RENDERING-ROADMAP.md))

Vertex-shader wind and height fog are injected into the shared prop/road materials via
`onBeforeCompile` (call order matters: `applyHeightFog` first, `applyWind` second — wind inlines
`project_vertex`, fog must never touch it). The roadside band carries instanced ground-cover tufts
driven by the same wind uniform. Speed reads as speed (roadmap): radial blur + adaptive DPR ride
the 60fps high tier. The context palette (time-of-day + season) tints the scene in `mode === "ride"`
only — preview keeps the authored look. Ambient effort audio (procedural wind/tyre noise tracking
cadence/power) starts with the ride and is gated by `sfxEnabled()`, not reduced-motion. The rank
ladder's aura tier renders as light around the rider (`rank-aura.tsx`), and the diegetic bike
computer (`bike-computer.tsx`) projects the interval target + flow tier in-world while the DOM HUD
keeps the facts. Every effect is tier-gated: `low` must degrade cleanly, never break.

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
| **Optional campaign settlement** | Deployed on Fuji (phase-5 pilot): `ClaimRegistry` + `AchievementRedeemerV2` over issuer-signed EIP-712 receipts + stable nullifier; `PilotSpinToken` campaign asset. Full record: [PHASE-5-PILOT.md](PHASE-5-PILOT.md) | "redemption confirmed" |

Receipt `verification.status` is a separate axis from where the record is stored — a receipt can be `unverified` regardless of ledger location. Cloud-save job state is separate from chain anchoring/proof state. Legacy reads are migration-only and auth-owner-scoped (phase 1, deployed) — old blobs are never retroactively declared private/deleted.

### The rank ladder (foreground, shipped 2026-10-20)

The ladder is a **game** ledger, not a settlement ledger — it never gates value, never syncs to an
account, and never touches a chain. It is device-local like the durable-progression ledger, but it
is a different thing: where "durable progression" means *the ride was recorded*, the ladder means
*what the ride earned*.

| Ledger | Contains | Key | Status vocabulary |
|--------|----------|-----|-------------------|
| **Rank ladder** | Append-only XP entries with per-component breakdowns, derived from ride telemetry | `spinchain:progression:v1` | "1.3k XP" / "Flow Rider" / "37 XP to Surge" |

Full detail: [PROGRESSION.md](PROGRESSION.md). Source: `app/lib/progression.ts`.

Two properties matter for the architecture:

1. **Derived, not duplicated.** XP is computed from data the ride already produced (duration,
   average power, average effort, flow minutes, peak flow tier, milestone count, streak). There is
   no second source of truth for effort, so the ladder can never disagree with the ride record.
2. **Backfilled, not re-asked.** A rider who was here before the ladder existed reconstructs a
   starting total from `spinchain:rides:history:v2` on first mount. The backfill only ever
   under-counts — flow and milestone history are not invented.

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

### Verification providers (phase 3, merged 2026-10-07)

`app/lib/verification/provider.ts` defines the provider interface — `verified`/`rejected`/`unavailable` decisions with a `VerifiedSession` (provider-derived `sessionId`/`classId`, provenance, duration) and a verbatim `trustStatement`. Registered providers own eligibility; `POST /api/redeem/sign` delegates to them and returns attestation metadata (provider, provenance, trust statement) alongside the EIP-712 signature. First provider `spinchain.cloud-observed.v1` approves rides observed via consented `cloud_history` sync — it attests *recorded existence*, never telemetry integrity. Studio/wearable providers register under the same interface when a partner feed exists; no CRE/zkTLS adoption before then.

### Privacy boundary (phase 1 → 2)

- Phase 1 (deployed 2026-10-04, `a3c7e37`) closes **public** publication: telemetry, ride summaries, rider profiles, coach memory, and Sui ride anchors stop being written publicly. Public world/route asset publishing stays.
- Phase 2 (implemented 2026-10-07) closes **consent transfer**: cloud history, third-party AI/voice, instructor live view, and public achievement export are separate granular consents (`app/lib/privacy/consent.ts` + `consent-server.ts`, policy version `consent-v1`, all off by default). Third-party AI/TTS calls now throw `ConsentRequiredError` without an `ai_voice` grant — the `rider_consents` migration is applied (2026-10-07); privacy-ready still requires legal review.
- Ordinary progression is not cash or transferable SPIN; tradable/cash rewards require jurisdictional legal review (EDPB privacy rules (minimization/retention/erasure — encrypted data is still personal data), Apple platform rules (3.1.1 digital goods/NFT, 5.1 health/AI consent), and jurisdictional financial review are separate concerns — see research doc §§5–7). A `RideReceiptV1` is a record, not a medical measurement or attestation certificate.

### Current vs planned chain systems

| System | Current (testnet experiment) | Planned |
|--------|------------------------------|---------|
| Avalanche Fuji | `IncentiveEngine`, ERC-20 SPIN, deployed wrapper + HonkVerifier. **Deployed wrapper is broken**: forwards wrong public-input slice (verified on-chain 2026-10-04); underlying Honk verifies fixture proofs. Corrected wrapper code exists locally, NOT deployed. **Deployed and dogfooded 2026-10-07**: `ClaimRegistry` `0x53C1F0b6…`, `AchievementRedeemerV2` `0x0F00848C…`, `PilotSpinToken` `0x3DC82882…` — issuer-signed typed receipt + stable consumed nullifier, EIP-712 domain binding, expiry, campaign/user budgets, gas-payer allowlist, pause/rotation. Pilot UI flagged live on prod (`NEXT_PUBLIC_PILOT_REDEEM_ENABLED`) for Fuji wallets. | `source-attested` provider issuers (studio/wearable) — phase-3 interface merged, external pilot pending. |
| Sui testnet | `RiderStats` PTB, `TelemetryAnchor` Walrus blob ids | Phase 1 (deployed): ALL personal ride telemetry/anchor writes DISABLED — no private on-chain writes; anchoring optional future |
| ZK `effort_threshold` | Noir circuit + `@aztec/bb.js` UltraHonk. **Only 3 public outputs** (`threshold_met`, `seconds_above`, `effort_score`); threshold/minDuration/classId/rider are attached metadata, NOT proven. Proof-hash replay key ≠ stable session nullifier. FTMS is transport, not attestation. Real-verifier benchmark measured 2026-10-07: ~1.19M gas (`Phase5Benchmark.t.sol`). | Optional privacy layer over issuer-bound commitment |
| Yellow channels | Parked until a funded use case exists | — |

Legacy gas benchmarks used MockVerifier (the "364k/9-chunk" figures are not real-verifier measurements).

---

## 3. Performance + File Map (condensed)

Budget: <3 re-renders/s, telemetry commit 2-4Hz, probe <50ms, switch <100ms, 0 TS errors, <50MB ride growth. `frameloop="demand"`, refs for hot paths, no `setState` in RAF, granular selectors.

```
app/engines/  coordinator, telemetry, device, coaching, audio, rewards, sui, social, visualization + renderers/
app/stores/   ride, coaching, ui, sensory, ride-modal
app/lib/      flow-state, phase-theme, milestones, experience-level, context-palette, progression, ambient-audio, gpu-probe, themes/registry
```

*Last updated: 2026-10-20 — added the shipped 3D world-immersion layer (§1) + flow-tier vocabulary
note; file map refreshed. P0/P1 rendering work complete — pending items live in
[RENDERING-ROADMAP.md](./RENDERING-ROADMAP.md) §4 ("Remaining-work ordering").*
