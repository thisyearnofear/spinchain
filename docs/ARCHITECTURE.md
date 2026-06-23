# SpinChain: Architecture

> **Note**: This document covers the blockchain settlement architecture. For the **ride application architecture** (engine architecture, visualization renderer system, lessons learned, implementation plan), see [ARCHITECTURE_GUIDE.md](./ARCHITECTURE_GUIDE.md).

This document describes the intended architecture and the parts already present in the repo. Several sections below describe target architecture rather than a fully completed live deployment.

## Dual-Engine Execution Model

SpinChain implements a **Dual-Engine Execution Model** with **Zero-Knowledge Privacy** to solve high-frequency fitness telemetry vs. high-value financial settlement.

| Engine | Chain | Role | Primitive |
| :--- | :--- | :--- | :--- |
| **Settlement** | **Avalanche (EVM)** | High-value / Low-frequency | ERC-721, ERC-20, ZK Verifiers |
| **Agent Settlement**| **Kite AI (EVM)** | AI Identity / Autonomy | Agent Passport, x402 Payments |
| **Performance** | **Sui (Move)** | Low-value / High-frequency | Move Objects, Dynamic Fields |

### Why Avalanche for Settlement?
- **Liquidity Depth**: Access to Ethereum-native DeFi (Uniswap v4)
- **ZK Verification**: On-chain Noir proof verification
- **Identity**: Native ENS support for instructor branding

### Why Sui for Performance?
- **Parallel Execution**: Independent rider telemetry transactions
- **Move Safety**: Strongly typed, resource-oriented biometric objects
- **Latency**: 480ms finality for real-time AI instructor reactivity

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SPINCHAIN                                 │
├─────────────────────────────────────────────────────────────────┤
│  EVM (Avalanche)          │  EVM (Kite AI)                      │
│  ├─ SpinClass NFT         │  ├─ Agent Identity                  │
│  ├─ Ticket purchase       │  ├─ Revenue Settlement              │
│  ├─ SPIN rewards          │  ├─ Autonomy Rules                  │
│  ├─ ZK verification       │  └─ x402 Micropayments              │
│  └─ ENS Identity          │                                     │
├─────────────────────────────────────────────────────────────────┤
│  Sui (Testnet)                                                  │
│  ├─ Session (shared)      │  ├─ Telemetry events (10Hz)         │
│  ├─ RiderStats (owned)    │  ├─ Story beat events               │
│  └─ Multi-Ghost Replays   │                                     │
└─────────────────────────────────────────────────────────────────┘
                    ↓ High-frequency telemetry
              Sui: 10Hz updates, ~480ms finality
                    ↓ ZK Proof generation
              EVM: Reward distribution, verification
                    ↓ Agent Settlement
              Kite: Revenue sharing, autonomous payments
```

### Data Flow

1. **AI Instructors** deploy on Avalanche with ENS identity and settle on Kite AI
2. **Riders** purchase tickets (ERC-721) on Avalanche
3. **During Ride**: 10Hz telemetry streams to Sui `RiderStats` objects, competing against real Multi-Ghost replays
4. **Local Oracle**: browser-side proof generation chunks heart-rate samples into 60-second proof windows
5. **Settlement**: `IncentiveEngine.submitZKProofBatch(...)` verifies each chunk and mints one aggregate reward on Avalanche
6. **Agent Autonomy**: AI agents settle their portion of revenue on Kite AI to pay for their own operations (e.g., ElevenLabs API fees)

---

## Privacy Tiers

| Tier | Revealed | Hidden | Use Case |
|------|----------|--------|----------|
| High | effort_score, zone | All raw metrics | Public leaderboards |
| Medium | + duration, ranking | GPS, biometrics | Friend competitions |
| Low | Full disclosure | - | Medical/insurance |

### ZK Circuit: `effort_threshold`

The effort_threshold circuit proves HR > threshold without revealing actual values:

```rust
// Private inputs (never revealed)
heart_rates: [u16; 60],  // 60 seconds of HR data

// Public inputs
threshold: u16,          // Target HR (e.g., 150)
min_duration: u32,       // Minimum seconds required

// Outputs
threshold_met: bool,     // Did they meet the goal?
effort_score: u16,       // 0-1000 calculated score
```

Current launch path: the app generates real Noir proofs via Barretenberg WASM backend in the browser, batches 60-second proofs per ride, and submits them on-chain. The HonkVerifier (`0xF2a33f6e9a5e935Db5d682E226A7e1a0249A641B`) cryptographically verifies proofs on Fuji. Remaining work: gas/performance validation and end-to-end operational testing.

---

## Physiological Intelligence

SpinChain implements industry-standard sports science models to drive the AI Coach:

### 1. Skiba W'bal (Differential Model)
Tracks the depletion and recovery of anaerobic work capacity (W').
- **Depletion**: When Power > Critical Power (CP).
- **Recovery**: Proportional to the remaining capacity and the difference between CP and current Power.
- **AI Integration**: Personalities adjust resistance to protect or utilize this "fuel tank."

### 2. Virtual Drivetrain
Simulates real-world gearing for fixed-resistance spin bikes.
- **Ratio Mapping**: Front/Rear combinations from 11-28 cassettes.
- **Physics HUD**: Calculates virtual speed based on gear ratio and cadence (RPM).

### 3. Physics-Based Speed Model
Fallback speed calculation using aerodynamic drag and gravity:
- **Drag**: $0.5 \cdot \rho \cdot CdA \cdot v^3$
- **Gravity**: $Weight \cdot g \cdot (Gradient + Crr)$
- Used to provide realistic pacer and route progress metrics.

---

## Storage Layers

| Data Type | Storage | Compression | Retention |
|-----------|---------|-------------|-----------|
| Raw Telemetry | Walrus Blobs | Delta encoding | 30 epochs |
| Ghost Replays | Walrus Blobs | N/A | Permanent |
| 3D Worlds | Walrus Blobs | N/A | Permanent |
| ZK Proofs | Avalanche Events | N/A | Permanent |
| Agent Audits | Kite AI Events | N/A | Permanent |

---

## Chainlink Runtime Environment (CRE)

SpinChain is designed to use **Chainlink CRE** for decentralized biometric verification. The on-chain contracts (`BiometricOracle.sol`) are deployed and tested, but the CRE workflow itself is **not yet running** — deployment requires Chainlink Early Access approval.

**Status**: `BiometricOracle.sol` deployed to Fuji with 5 Foundry tests passing. CRE workflow code exists in `app/lib/chainlink/cre/` but uses placeholder config (zero-address forwarder, fake workflow ID). Early Access request pending.

**Intended architecture** (once CRE is approved):
- **Decentralized Orchestration**: CRE monitors `VerificationRequested` events
- **Confidential HTTP**: Securely fetches private HR data from wearable APIs
- **Off-Chain Computation**: "Qualifying Minutes" calculated in trusted execution
- **Low-Latency Settlement**: Verified reports written to `BiometricOracle.sol`

### Simulator-to-Chainlink Pipeline

For testing without BLE hardware:
1. **Pedal Simulator**: Generate telemetry via keyboard (Guest Mode)
2. **Simulator API**: Simulator data accessible via standard API
3. **CRE Workflow**: Would fetch, verify, and report effort scores on-chain (not yet deployed)

---

## Competitive Analysis

| Competitor | Model | Data Ownership | Economics |
|------------|-------|----------------|-----------|
| Peloton/Strava | Centralized | Platform-owned | Extractive |
| STEPN/Sweatcoin | Token-first | User-owned | Speculative |
| **SpinChain** | **Dual-Engine** | **User-owned** | **Revenue + Tokens** |

---

## Tech Stack

### Blockchain
- **Settlement**: Avalanche C-Chain (EVM) with ZK Verifiers
- **Agent Autonomy**: Kite AI Testnet (EVM)
- **Execution**: Sui Testnet (Move)
- **Package ID**: `0x51542d1d4b43763d58e6f91f845f63157d5fc59bd95ead54dc370b0898d1185c`
- **Identity/Wallet**: RainbowKit (EVM) + Sui dApp Kit
- **ZK Proofs**: Noir (Aztec) with UltraPlonk backend

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Native Bridge**: Capacitor 5.7 (iOS/Android/Web)
- **3D Engine**: React Three Fiber + Three.js + Drei
- **Styling**: Tailwind CSS + Glassmorphic System
- **Haptics**: Native Vibration API

---

## Implementation Notes

- Avalanche usage is still testnet-oriented by default
- Sui usage is still testnet-oriented by default
- Some rider and class flows fall back to curated demo data when on-chain contract data is unavailable
- Contract/runtime configuration still includes some placeholder values (SpinPack, Kite agent) that must be resolved before public launch
- The shared rewards hook and explicit ride claim flow both use the on-chain batch ZK claim path now

## Roadmap

See [PRODUCTION_ROADMAP.md](./PRODUCTION_ROADMAP.md) for the full phased plan.

**Summary**: Phase 0 (backend infrastructure + Supabase migration) → Phase 1 (foundation: lint, biometric profile, adaptive difficulty) → Phase 2 (instructor-rider loop: homework, roster, progress tracking) → Phase 3 (agentic intelligence: post-ride AI analysis, training plans) → Phase 4 (scale: real contract data, cross-gym, load testing, security audit).
