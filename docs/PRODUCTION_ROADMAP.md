# SpinChain Production Readiness Roadmap

**Created**: 2026-03-17  
**Status**: Pre-Launch Remediation  
**Target**: Production Launch

---

## Executive Summary

SpinChain has a promising prototype, but the app is still demo/testnet-stage and not ready for general users. The current work is launch remediation: remove misleading demo behavior, replace placeholders, and make release verification trustworthy.

**Critical Blockers**:
1. ~~User-facing screens still rely on mock/demo fallbacks in some production paths~~ **Partially resolved (2026-06-22):** Instructor live page demo data now labeled as "Preview Mode"; fake numbers hidden when no ride is active. Phase tags removed from UI.
2. ZK claims support chunked batch submission with 16 Foundry tests passing; real on-chain Honk verifier deployed to Fuji; browser-side Noir prover uses real Barretenberg backend (not mock)
3. Runtime and deployment config still contain some placeholders (SpinPack contract, Kite agent passport)
4. Release verification is not yet a dependable gate
5. Reward settlement and ride-summary anchoring must remain distinct in implementation and reporting

---

## Part 1: Mock/TODO Code Audit

### P0 - Critical (Must Fix Before Mainnet)

| ID | File | Line | Issue | Resolution |
|----|------|------|-------|------------|
| P0-1 | `app/api/rides/sync/route.ts` | 15-20 | Fake transaction hash returned | Implement real ride-summary relay/anchoring flow; keep reward settlement separate from anchoring state |
| P0-2 | `app/hooks/evm/use-class-data.ts` | 124 | Uses mock state instead of contract reads | Wire up to `SpinClassNFT.sol` view functions |
| P0-3 | `circuits/effort_threshold/src/main.nr` | 6 | `MAX_DATA_POINTS = 60` (1 minute max) | ✅ Resolved (2026-06-22): Real Noir circuit compiled and served from `/public/circuits/`. `NoirProver` uses `BarretenbergBackend` for real UltraPlonk proofs. Chunked proof batching handles longer sessions. |
| P0-4 | `app/config.ts` | 51, 57 | Zero addresses for verifier & forwarder | Deploy contracts, update env variables |
| P0-5 | `app/lib/ai-service.ts` | 4 | HACKATHON_STRATEGY logic | Review and implement production-safe AI logic |

### P1 - High Priority (Feature Gaps)

| ID | File | Line | Issue | Resolution |
|----|------|------|-------|------------|
| P1-1 | `app/rider/ride/[classId]/page.tsx` | 443 | Ghost pacer uses random mock data | Fetch real historical rider performance from Sui |
| P1-2 | `contracts/evm/src/deploy.s.sol` | 20 | Production deployments cannot rely on `MockUltraVerifier` | ✅ Resolved: deploy script now disables ZK claims unless a real verifier is supplied, with Chainlink/off-chain fallback documented |
| P1-3 | `app/api/ai/generate-route/route.ts` | 5 | ~~HACKATHON_STRATEGY shortcuts~~ | ✅ Production-ready with strict schema validation |
| P1-4 | `app/instructor/yellow/page.tsx` | 273 | Telemetry sparkline is placeholder | Integrate live Sui telemetry stream |

### P2 - Cleanup (Developer Experience)

| ID | File | Line | Issue | Resolution |
|----|------|------|-------|------------|
| P2-1 | `scripts/simulate-cre-flow.ts` | 22 | ~~Hardcoded mock addresses~~ | ✅ Now uses env/config imports |
| P2-2 | `app/lib/gemini-client.ts` | 5 | ~~HACKATHON_ENHANCEMENTS tags~~ | ✅ Production-ready documentation |

---

## Part 2: ZK Circuit Scaling Strategy

### Current Architecture

```
Device (BLE) → Frontend (Telemetry Store) → Noir JS + Barretenberg WASM (Local Prover) → Chunked proofs → Avalanche (`submitZKProofBatch`)
```

**Circuit**: `effort_threshold`
- **Inputs**: Private heart rates array (`u16[60]`), private num_points, public threshold/duration
- **Outputs**: `threshold_met` (bool), `seconds_above` (u32), `effort_score` (0-1000)
- **Backend**: `BarretenbergBackend` (UltraPlonk proving) loaded as WASM in browser
- **On-chain verification**: `HonkVerifier` deployed to Fuji (`0xF2a33f6e9a5e935Db5d682E226A7e1a0249A641B`)
- **Constraint**: `MAX_DATA_POINTS = 60` (~1 minute at 1Hz), handled via chunked batching

### Current Launch Path

The repo no longer assumes a single proof covers an entire ride. The current path is:
- collect ride heart-rate samples client-side
- split samples into 60-second windows
- generate one proof per qualifying window
- submit all proofs to `IncentiveEngine.submitZKProofBatch(...)`
- aggregate `secondsAbove` and weighted effort score on-chain for a single mint

This makes normal-length rides claimable without inflating the Noir circuit itself.

### Remaining Limitation

The circuit still only proves 60 seconds per chunk. That is acceptable for the current batch-claim design, but it still leaves open questions around:
- proving latency on lower-end devices
- gas cost as proof count grows
- final UX for long classes with many proof windows

### Recommended Approach: Recursive Proof Aggregation

#### Strategy Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     45-Minute Workout Session                    │
├─────────────────────────────────────────────────────────────────┤
│  Chunk 1 (0-60s)  │  Chunk 2 (60-120s)  │  ...  │ Chunk 45     │
│  Proof P1         │  Proof P2           │       │ Proof P45    │
│  effort=720       │  effort=680         │       │ effort=750   │
└────────┬──────────┴────────┬────────────┴───────┴──────┬───────┘
         │                   │                          │
         ▼                   ▼                          ▼
    ┌─────────────────────────────────────────────────────────┐
    │              Aggregator Circuit (new)                    │
    │  Inputs: [P1, P2, ..., P45], accumulated_effort         │
    │  Output: session_proof, total_effort_score              │
    └─────────────────────────────────────────────────────────┘
```

#### Implementation Phases

**Phase 1: Streaming Proofs (During Workout)**
- Generate 1-minute proofs in the background every 60 seconds
- Store proofs locally in IndexedDB/device storage
- User sees real-time effort score without waiting

**Phase 2: Aggregation (End of Workout)**
- New `session_aggregator.nr` circuit accepts array of chunk proofs
- Validates each chunk proof's public inputs
- Outputs: `total_duration`, `average_effort`, `session_valid`

**Phase 3: Single Submission**
- Submit one aggregated proof to `IncentiveEngine.sol`
- Gas-efficient: one verification vs 45 separate verifications

### Code Changes Required

#### 1. New Aggregator Circuit (`circuits/session_aggregator/src/main.nr`)

```rust
global MAX_CHUNKS: u32 = 60; // Up to 60-minute sessions

struct ChunkProof {
    threshold_met: bool,
    seconds_above: u32,
    effort_score: u32,
    chunk_index: u32,
}

fn main(
    // Each chunk's verified outputs (would be actual proof verification in recursive setting)
    chunk_outputs: [ChunkProof; MAX_CHUNKS],
    num_chunks: u32,
    min_session_duration: u32, // Public: minimum seconds required
    threshold: u16,            // Public: same threshold for all chunks
) -> pub bool, pub u32, pub u32 {
    
    let mut total_seconds: u32 = 0;
    let mut total_effort: u32 = 0;
    let mut valid_chunks: u32 = 0;
    
    for i in 0..num_chunks {
        let chunk = chunk_outputs[i];
        
        // Verify threshold was met in this chunk
        assert(chunk.threshold_met);
        assert(chunk.effort_score <= 1000);
        
        total_seconds += chunk.seconds_above;
        total_effort += chunk.effort_score;
        valid_chunks += 1;
    }
    
    // Session validity
    let session_valid = total_seconds >= min_session_duration;
    let average_effort = total_effort / valid_chunks;
    
    (session_valid, total_seconds, average_effort)
}
```

#### 2. Frontend Proof Scheduler (`app/lib/zk/proof-scheduler.ts`)

```typescript
interface ProofChunk {
  proof: Uint8Array;
  publicInputs: string[];
  effortScore: number;
  timestamp: number;
}

export class ProofScheduler {
  private chunks: ProofChunk[] = [];
  private provingQueue: Promise<void> = Promise.resolve();
  
  // Called every 60 seconds during workout
  async submitHeartRates(heartRates: number[], threshold: number): Promise<void> {
    this.provingQueue = this.provingQueue.then(async () => {
      const proof = await generateChunkProof(heartRates, threshold);
      this.chunks.push({
        proof: proof.proof,
        publicInputs: proof.publicInputs,
        effortScore: proof.effortScore,
        timestamp: Date.now()
      });
    });
    return this.provingQueue;
  }
  
  // Called at workout end
  async generateSessionProof(): Promise<AggregatedProof> {
    await this.provingQueue; // Wait for all pending proofs
    return aggregateProofs(this.chunks);
  }
}
```

#### 3. Contract Update (`contracts/evm/src/IncentiveEngine.sol`)

```solidity
// Add session-level verification
function claimSessionReward(
    bytes calldata sessionProof,
    SessionOutput calldata output,
    uint256 classId
) external returns (uint256 reward) {
    // Verify aggregated proof
    require(sessionVerifier.verify(sessionProof, output), "Invalid session proof");
    
    // Calculate reward based on total effort and duration
    reward = (output.totalSeconds * output.averageEffort * baseRewardRate) / 1000;
    
    // Mint SPIN tokens
    SPIN_TOKEN.mint(msg.sender, reward);
    
    emit SessionRewarded(msg.sender, classId, reward, output.totalSeconds);
}
```

### Alternative: Chainlink CRE Path (For Low-End Devices)

For users without WebGPU or with older phones, offer an alternative verification path:

```
Device → Chainlink Functions (TEE) → BiometricOracle.sol → Rewards
```

**Trade-offs**:
- ✅ No client-side proving (works on any device)
- ✅ Faster UX
- ❌ Trust assumption in Chainlink TEE
- ❌ Higher latency (network round-trip)

**Recommendation**: Support both paths. Default to ZK for privacy-conscious users, fallback to CRE for device compatibility.

---

## Implementation Timeline

### Sprint 1: Critical Fixes (Week 1-2)
- [x] Deploy verifier contracts, update `app/config.ts` (P0-4) ✅ 2026-03-17
- [x] Implement real ride-summary anchoring in `rides/sync/route.ts` (P0-1) ✅ 2026-03-17
- [x] Wire up contract reads in `use-class-data.ts` (P0-2) ✅ 2026-03-17
- [x] Review and fix AI service hackathon code (P0-5) ✅ 2026-03-17

### Sprint 2: ZK Aggregation & Kite AI (Week 3-4)
- [x] Implement chunked proof generation from heart-rate samples
- [x] Add `submitZKProofBatch(...)` to `IncentiveEngine.sol`
- [x] Wire rider and shared rewards hooks to batch claim submission
- [x] Integrate Kite AI Testnet for autonomous agent settlement
- [x] Implement `AIAgentInstructor.settleOnKite()` for verifiable revenue sharing
- [x] Add contract tests for replay protection, mismatched batches, threshold failures, disabled-verifier guards, and single-proof claims (16 tests passing)
- [x] Run configured Fuji end-to-end claim tests with a real verifier deployment ✅ 2026-06-22: HonkVerifier deployed, NoirProver uses real Barretenberg backend

### Sprint 3: Feature Completion (Week 5-6)
- [x] Real ghost pacer data (P1-1) ✅ 2026-03-17
- [x] Implement Multi-Ghost racing system (Sui/Walrus) ✅ 2026-04-07
- [x] Real on-chain instructor aggregation (Avalanche) ✅ 2026-04-07
- [ ] Live telemetry integration (P1-4)
- [x] Consolidate production deployment into `src/deploy.s.sol` ✅ 2026-04-03
- [x] Safe fallback when no real verifier exists (disable ZK, use Chainlink path) ✅ 2026-04-03

### Sprint 4: Polish & Testing (Week 7-8)
- [ ] End-to-end testing on Fuji testnet with real verifier + engine addresses
- [ ] Load testing for concurrent classes
- [ ] Security audit preparation
- [ ] Documentation updates

---

## Monitoring Requirements

Before mainnet, implement:

| Component | Tool | Purpose |
|-----------|------|---------|
| Error Tracking | Sentry | Catch JS errors, failed proofs |
| Transaction Monitoring | Tenderly | Track Avalanche contract calls |
| Telemetry Pipeline | Grafana + Prometheus | Monitor Sui data ingestion |
| AI API Costs | Custom dashboard | Track Venice/Gemini usage |

---

## Success Criteria

- [x] All P0 items resolved ✅ 2026-06-22
- [x] ZK proofs work with real Noir circuit + Barretenberg backend (browser-side WASM) ✅ 2026-06-22
- [ ] ZK proofs work for 45-minute sessions (<30s proving time total) — chunked batching implemented, needs load testing
- [ ] Real contract integration on all frontend hooks
- [ ] Successful testnet run with 10+ concurrent users
- [ ] Zero hackathon/mock code in production paths
- [x] All 8 contracts verified on Snowtrace ✅ 2026-04-03
- [x] Resolve Honk verifier stack depth limitation for mainnet ✅ 2026-06-22: HonkVerifier deployed to Fuji
- [ ] Keep reward settlement and ride-summary anchoring status distinct across UI, storage, and relay flows

## Active Workstream: Hackathon Submissions

The Sui Overflow 2026 (Walrus Track) and Tatum × Walrus hackathons are running concurrently with the launch remediation above. They share the same code, the same testnet posture, and the same Core Principles — every hackathon-related change in `HACKATHON_PLAN.md` is additive to existing modules (`app/sui-provider.tsx`, `app/lib/walrus/`, `SuiEngine`, `RiderStats` Move struct). There is no new Sui client, no new Walrus client, and no new abstraction layer.

Key posture decisions that overlap with this roadmap:

- **Testnet stays the submission target.** Mainnet is a separate phase in the hackathon plan that is staged *after* the build period to avoid blocking the submission deadline.
- **~~`MockUltraVerifier` posture is unchanged.~~** **Updated (2026-06-22):** Real `HonkVerifier` deployed to Fuji (`0xF2a33f6e9a5e935Db5d682E226A7e1a0249A641B`). Browser-side `NoirProver` uses real `BarretenbergBackend`. `MockUltraVerifier` contract remains as a local dev/test fallback only.
- **Reward settlement and ride-summary anchoring remain distinct.** The hackathon's "Walrus as agent memory" work adds a third concept (anchor `walrus_blob_id` on `RiderStats`) that is separate from both settlement and ride-summary sync.

See `docs/HACKATHON_PLAN.md` for the file-level change list, phases, and risk register.

---

## Rider-as-Hero: Product Design Roadmap

**Goal**: Make the rider feel like the protagonist of the experience. Today, all ride UI is class-centric. The rider is anonymous during the ride — no name, no avatar, no streak, no progression. This roadmap shifts the center of gravity from "class" to "rider."

### Phase 1: Identity in the Ride (hackathon-feasible)

| Item | Description | Status |
|------|-------------|--------|
| Rider identity in top bar | Show rider name, avatar, streak flame in the ride HUD top bar (uses existing `useProfile()` + `getStreakStats()`) | In progress |
| Personalized coach greeting | Coach says "Welcome back, {name}. Day {N} streak — let's keep it alive." on ride start (uses existing `speak()` + `getStreakStats()`) | Planned |
| PR pursuit callouts | Live "12W above your best power PR!" during ride (uses existing `getPRs()`) | Planned |

### Phase 2: Progression & Celebration (post-hackathon)

| Item | Description |
|------|-------------|
| XP / Level system | Derive level from total rides, effort, SPIN earned. Level-up celebration overlay. |
| Streak mechanics | Visible streak counter in HUD. "Ride to extend" prompt pre-ride. Streak freeze items. |
| Victory screen | Post-ride: confetti, animated badge unlocks, PR notifications, streak extended. |
| Share card | Generated image with rider stats, route, badge — social-shareable. |

### Phase 3: Route Ownership (post-hackathon)

| Item | Description |
|------|-------------|
| GPX import | Rider uploads a GPX file → we parse elevation + coordinates → generate a class from their real route. |
| Route library | "Your routes" section — saved, imported, curated. Rider owns their route collection. |
| Pre-ride route preview | Elevation profile + difficulty rating before starting (inspired by bike-router pattern). |

### Phase 4: Adaptive Personalization (post-hackathon)

| Item | Description |
|------|-------------|
| Rider preferences | Difficulty, route type, coach personality, music — stored on Walrus as "rider memory." |
| Adaptive coaching | AI coach references past rides: "Last time you hit 280W on this climb — try for 300 today." Uses Walrus-stored summaries. |
| Walrus-as-rider-memory | Rider identity, preferences, and ride history as verifiable Walrus blobs anchored on Sui. Portable across devices. |

### Inspiration References

- **bike-game** (wcoolers): Simple canvas bike game — progression mechanics, minimal but engaging.
- **streetmix**: Collaborative street design — excellent visual asset quality, drag-and-drop UX patterns.
- **bike-router** (Hasan-aga): Route planning with elevation chart + difficulty visualization — we promise this on our homepage.
- **RallyGPXMerger** (SebastianHanfland): GPX merging tool — relevant for multi-segment route composition and GPX parsing.

---

## Personalization & Onboarding Overhaul

**Problem**: The homepage was identical for first-time visitors and returning riders with 20+ rides. The welcome modal was a passive 3-slide feature explainer that collected zero user data. The nav bar showed no rider identity. The app felt impersonal — the user was never the hero.

**Solution**: Interactive onboarding quiz, Coachy mascot, personalized homepage, and rider identity in the nav bar.

### What was built

| Component | File | Description |
|-----------|------|-------------|
| Rider profile store | `app/stores/rider-profile-store.ts` | localStorage-backed store for goal, experience, frequency, motivation, coach personality |
| Coachy mascot | `app/components/ui/coachy-mascot.tsx` | SVG character with 6 moods (welcoming, cheering, coaching, celebrating, thinking, resting), animated with Framer Motion |
| Rider quiz | `app/components/features/common/rider-quiz.tsx` | 5-step interactive questionnaire replacing the welcome modal — collects goal, experience, frequency, motivation, coach personality. Shows personalized ride plan summary on completion. |
| Personalized hero | `app/components/features/home/personalized-hero.tsx` | Replaces the generic hero for returning riders — shows "Welcome back {name}", streak, total rides, best power/effort, and recommended ride based on profile |
| Nav identity chip | `app/components/layout/nav.tsx` | Avatar (ENS or initials), display name, streak flame in the global nav bar — visible on every page |

### Onboarding flow (new)

1. First visit → Rider quiz appears (Coachy mascot greets user)
2. 5 questions: goal, experience, frequency, motivation, coach personality
3. Summary screen: "Your ride plan is ready!" with recommended difficulty, duration, coach style
4. One click → demo ride matching their profile
5. Returning visit → Personalized hero with stats, streak, and recommended ride

### Lessons from competitor analysis

Patterns stolen from high-converting apps (Duolingo, study apps, dog training apps):
- **Mascot**: Coachy creates emotional connection and brand memorability
- **Interactive questionnaire**: Collects real user data, builds personalization, gets emotional investment before commitment
- **Personalized plan from answers**: "Based on your answers..." — makes user feel the app was made for them
- **Homepage that recognizes you**: Returning users see their stats, not generic marketing copy
- **Identity everywhere**: Nav bar shows rider identity on every page, not just in the ride

---

## Appendix: File Reference

### Key Files to Modify
- `circuits/effort_threshold/src/main.nr` - Circuit constraints
- `app/api/rides/sync/route.ts` - Ride-summary anchoring logic
- `app/hooks/evm/use-class-data.ts` - Contract reads
- `app/config.ts` - Contract addresses
- `app/lib/ai-service.ts` - AI safety logic
- `contracts/evm/src/IncentiveEngine.sol` - Reward settlement claims

### New Files to Create
- `circuits/session_aggregator/src/main.nr` - Aggregation circuit
- `app/lib/zk/proof-scheduler.ts` - Background proving
- `app/lib/zk/aggregator.ts` - Proof aggregation logic

---

*Generated by AdaL on 2026-03-17*
