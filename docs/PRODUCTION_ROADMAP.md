# SpinChain Production Readiness Roadmap

**Created**: 2026-03-17  
**Status**: Pre-Launch Remediation  
**Target**: Production Launch

---

## Executive Summary

SpinChain has a promising prototype, but the app is still demo/testnet-stage and not ready for general users. The current work is launch remediation: remove misleading demo behavior, replace placeholders, and make release verification trustworthy.

**Critical Blockers**:
1. User-facing screens still rely on mock/demo fallbacks in some production paths
2. ZK claims now support chunked batch submission, but configured end-to-end verification is still incomplete
3. Runtime and deployment config still contain placeholders or mock components
4. Release verification is not yet a dependable gate

---

## Part 1: Mock/TODO Code Audit

### P0 - Critical (Must Fix Before Mainnet)

| ID | File | Line | Issue | Resolution |
|----|------|------|-------|------------|
| P0-1 | `app/api/rides/sync/route.ts` | 15-20 | Fake transaction hash returned | Implement real Avalanche anchoring via `IncentiveEngine.sol` |
| P0-2 | `app/hooks/evm/use-class-data.ts` | 124 | Uses mock state instead of contract reads | Wire up to `SpinClassNFT.sol` view functions |
| P0-3 | `circuits/effort_threshold/src/main.nr` | 6 | `MAX_DATA_POINTS = 60` (1 minute max) | Use chunked proof batching for launch; keep longer-session aggregation as a follow-on optimization |
| P0-4 | `app/config.ts` | 51, 57 | Zero addresses for verifier & forwarder | Deploy contracts, update env variables |
| P0-5 | `app/lib/ai-service.ts` | 4 | HACKATHON_STRATEGY logic | Review and implement production-safe AI logic |

### P1 - High Priority (Feature Gaps)

| ID | File | Line | Issue | Resolution |
|----|------|------|-------|------------|
| P1-1 | `app/rider/ride/[classId]/page.tsx` | 443 | Ghost pacer uses random mock data | Fetch real historical rider performance from Sui |
| P1-2 | `contracts/evm/src/deploy.s.sol` | 20 | Deploy script uses `MockUltraVerifier` | Switch to generated `UltraVerifier.sol` from Noir compilation |
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
Device (BLE) → Frontend (Telemetry Store) → Noir JS (Local Prover) → Chunked proofs → Avalanche (`submitZKProofBatch`)
```

**Circuit**: `effort_threshold`
- **Inputs**: Private heart rates array (`u16[]`), Public threshold/duration
- **Outputs**: `threshold_met` (bool), `seconds_above` (u32), `effort_score` (0-1000)
- **Constraint**: `MAX_DATA_POINTS = 60` (~1 minute at 1Hz)

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
- [x] Implement real anchoring in `rides/sync/route.ts` (P0-1) ✅ 2026-03-17
- [x] Wire up contract reads in `use-class-data.ts` (P0-2) ✅ 2026-03-17
- [x] Review and fix AI service hackathon code (P0-5) ✅ 2026-03-17

### Sprint 2: ZK Aggregation MVP (Week 3-4)
- [x] Implement chunked proof generation from heart-rate samples
- [x] Add `submitZKProofBatch(...)` to `IncentiveEngine.sol`
- [x] Wire rider and shared rewards hooks to batch claim submission
- [ ] Add contract and app coverage for replay protection, mismatched batches, and threshold failures
- [ ] Run configured Fuji end-to-end claim tests with a real verifier deployment

### Sprint 3: Feature Completion (Week 5-6)
- [x] Real ghost pacer data (P1-1) ✅ 2026-03-17
- [ ] Live telemetry integration (P1-4)
- [x] Production verifier in deploy script (P1-2) ✅ 2026-03-17 - Created deploy-production.s.sol

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

- [ ] All P0 items resolved
- [ ] ZK proofs work for 45-minute sessions (<30s proving time total)
- [ ] Real contract integration on all frontend hooks
- [ ] Successful testnet run with 10+ concurrent users
- [ ] Zero hackathon/mock code in production paths

---

## Appendix: File Reference

### Key Files to Modify
- `circuits/effort_threshold/src/main.nr` - Circuit constraints
- `app/api/rides/sync/route.ts` - Anchoring logic
- `app/hooks/evm/use-class-data.ts` - Contract reads
- `app/config.ts` - Contract addresses
- `app/lib/ai-service.ts` - AI safety logic
- `contracts/evm/src/IncentiveEngine.sol` - Reward claims

### New Files to Create
- `circuits/session_aggregator/src/main.nr` - Aggregation circuit
- `app/lib/zk/proof-scheduler.ts` - Background proving
- `app/lib/zk/aggregator.ts` - Proof aggregation logic

---

*Generated by AdaL on 2026-03-17*
