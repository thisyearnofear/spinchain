# SpinChain: Architecture & Overview

## SpinChain Technical Architecture

SpinChain implements a **Dual-Engine Execution Model** with **Zero-Knowledge Privacy** to solve the dilemma of high-frequency fitness telemetry vs. high-value financial settlement while preserving user privacy.

### The Dual-Engine Model

| Engine | Chain | Role | Primitive |
| :--- | :--- | :--- | :--- |
| **Settlement Engine** | **Avalanche (EVM)** | High-value / Low-frequency | ERC-721, ERC-20, ENS, ZK Verifiers |
| **Performance Engine** | **Sui (Move)** | Low-value / High-frequency | Move Objects, Dynamic Fields |

#### Why Avalanche for Settlement?
- **Liquidity Depth**: Access to Ethereum-native assets and mature DeFi protocols (Uniswap v4).
- **ZK Verification**: On-chain verification of Noir proofs via `EffortThresholdVerifier`.
- **Subnet Ready**: Future-proofed for a dedicated "SpinChain Subnet" with custom gas rules.
- **Identity**: Native ENS support for Instructor branding.

#### Why Sui for Performance?
- **Parallel Execution**: Each rider's telemetry update is an independent transaction.
- **Move Safety**: Biometric objects are strongly typed and resource-oriented.
- **Latency**: 480ms finality allows for real-time reactivity in AI Instructors.

---

## Zero-Knowledge Privacy Architecture

### The Privacy Problem
Traditional fitness apps expose sensitive health data (heart rate, power, biometrics) on-chain. SpinChain solves this with **Selective Disclosure** using ZK-SNARKs.

### ZK Flow
```
Rider Telemetry → Local Oracle → Noir Circuit → ZK Proof → Avalanche Verifier → Rewards
     (Private)       (Private)      (Private)    (Public)       (On-Chain)
```

### Components

#### A. Noir Circuits (`circuits/`)
| Circuit | Purpose | Constraints | Proving Time |
|---------|---------|-------------|--------------|
| `effort_threshold` | Prove HR > threshold | 1,024 | ~500ms |
| `composite` | Prove HR + Power + Cadence | 4,096 | ~1,500ms |

**Circuit Inputs:**
- **Private**: `heart_rates[60]`, `num_points`
- **Public**: `threshold`, `min_duration`, `classId`, `riderId`

**Circuit Outputs:**
- `threshold_met`: bool
- `seconds_above`: u32
- `effort_score`: u16 (0-1000)

#### B. On-Chain Verifier (`contracts/verifiers/`)
```solidity
EffortThresholdVerifier
├── UltraVerifier (Noir-generated)
├── verifyAndRecord(proof, publicInputs) → effortScore
├── replay protection via proofHash mapping
└── batchVerify for gas efficiency
```

#### C. Selective Disclosure (`lib/zk/disclosure.ts`)
```typescript
// Prove this:
"Maintained HR > 150 for 10 minutes"

// Without revealing:
{ maxHeartRate: 172, avgPower: 245, rawDataPoints: 600 }

// Privacy score: 0-100 (based on data minimization)
```

---

## Component Breakdown

### A. Autonomous AI Instructors (Base Layer: Avalanche)
AI Agents are deployed as unique identities on Avalanche. They manage:
- **Scheduling**: Automated session creation.
- **Liquidity**: Managing pool hooks for $SPIN tokens.
- **Identity**: ENS names like `atlas.spinchain.eth`.

### B. High-Frequency Telemetry (Execution Layer: Sui)
When a ride starts:
1. The app initializes a `Session` object on Sui.
2. Riders sync their 10Hz heart rate data to personal `RiderStats` objects.
3. These objects emit `TelemetryPoint` events.

### C. Local Oracle (Privacy Layer: Browser)
```typescript
LocalOracle
├── Telemetry Buffer (10-minute rolling window)
├── ZK Proof Generation (Noir/UltraPlonk)
├── Selective Disclosure Builder
└── Walrus Backup (encrypted telemetry)
```

### D. Agentic Feedback Loop
1. AI Agents subscribe to Sui telemetry events.
2. Logic (Personality-driven) parses group average effort.
3. Agent triggers a `StoryBeat` on-chain if effort targets aren't met.
4. The 3D Visualizer (WebGL) listens to Sui events and adjusts difficulty/atmosphere in real-time.

---

## Data Integrity & Storage

### Walrus Storage (`lib/walrus/`)
| Data Type | Storage | Compression | Retention |
|-----------|---------|-------------|-----------|
| Raw Telemetry | Walrus Blobs | Delta encoding | 30 epochs |
| 3D Worlds | Walrus Blobs | N/A | Permanent |
| ZK Proofs | Avalanche Events | N/A | Permanent |

### Privacy Tiers
| Tier | Revealed | Hidden | Use Case |
|------|----------|--------|----------|
| High | effort_score, zone | All raw metrics | Public leaderboards |
| Medium | + duration, ranking | GPS, biometrics | Friend competitions |
| Low | Full disclosure | - | Medical/insurance |

---

## AI-Powered Route Generation

SpinChain integrates AI-driven natural language route creation to democratize instructor onboarding and enhance immersion.

### Natural Language Route Builder
- **Gemini Integration**: Instructors describe routes in plain language (e.g., "45-minute coastal climb starting from Santa Monica")
- **Automatic GPX Generation**: AI generates route geometry, elevation profiles, and story beats
- **Real-World Preview**: Integration with mapping services for Street View-style route previews
- **Accessibility**: Voice-guided route creation removes technical barriers

### Consolidated AI Architecture
All AI capabilities (instructor agents, route generation, narrative prompts) share a unified service layer:
- Single Gemini API integration point
- Shared function calling infrastructure
- Consistent error handling and rate limiting
- Server-side API key management for security

### Route Intelligence
- **Gradient Analysis**: Automatic detection of climbs, descents, and sprints from elevation data
- **Effort Mapping**: AI-suggested zone targeting based on route topology
- **Story Beat Generation**: Narrative waypoints aligned with physical route features
- **Multi-Route Series**: Generate connected training programs across days/weeks

---

## Security Considerations

### ZK Proof Security
- **Trusted Setup**: UltraPlonk uses universal SRS (no per-circuit setup).
- **Proof Replay**: Verifier contract tracks `usedProofs` mapping.
- **Front-running**: Commit-reveal scheme for claim submissions.

### Data Privacy
- **Local-First**: All biometric processing happens in browser.
- **Encrypted Backup**: Walrus storage uses rider-specific encryption.
- **Selective Disclosure**: Riders control exactly what is revealed.

### Contract Security
- **Upgradeable Verifier**: UltraVerifier can be upgraded for circuit improvements.
- **Access Control**: Only IncentiveEngine can call `verifyAndRecord`.
- **Emergency Pause**: Circuit breaker for verifier in case of bugs.

---

## HackMoney 2026: SpinChain Submission

### Submission Brief

**One-Liner**: A **Dual-Engine Fitness Protocol** that combines the liquidity depth of Avalanche with the parallel execution speed of Sui—enabling AI Agents to run autonomous spin classes with real-time biometric telemetry.

**Core Innovation**: We're not just building "web3 Peloton"—we're building a **Hybrid Architecture** where financial settlement lives on EVM (Avalanche) while high-frequency performance data runs on Sui Move. This unlocks **Agentic Finance** for fitness: AI instructors that manage their own class schedules, liquidity, and pacing in real-time.

---

## Why This Wins HackMoney

### 1. Real-World Revenue Model
- Immediate path to profitability (ticket sales)
- No token speculation required
- Solves actual instructor pain points
- Market-validated demand (boutique fitness is huge)

### 2. Novel DeFi Primitives
- **Events as Financial Objects**: Classes are smart contracts
- **Privacy-Preserving Oracles**: Proof of human effort
- **Composable Incentives**: Badges integrate with broader ecosystem
- **Micro-Protocol Operators**: Instructors as autonomous economic agents

### 3. The "Dual-Engine" Architecture
- **Settlement (Avalanche)**: For high-value, low-frequency events (Tickets, Rewards, ENS Identity).
- **Performance (Sui)**: For low-value, high-frequency events (Heart rate updates, Route telemetry).
- **Storage (Walrus)**: For decentralized 3D route assets and raw biometric logs.

### 4. Prize-Winning Integrations
- **Sui ($10k)**: Uses Dynamic Objects and PTBs for real-time rider stats.
- **Avalanche C-Chain**: Deployed on C-Chain for fast finality and future Subnet expansion.
- **Uniswap v4 ($10k)**: AI Agents use custom Hooks to manage class token liquidity.
- **ENS ($5k)**: Every AI Instructor has a sovereign `.eth` identity.

### 5. Clear Adoption Path
- Instructors already exist (not speculative market)
- No "web3 education" needed for users
- Viral growth via share cards (built-in marketing)
- B2B2C model (sell to studios, reach riders)

---

## MVP Scope for HackMoney (Feb 11 Deadline)

### Must Ship:
1. ✅ **Hybrid Stack**: App connects to both Avalanche (EVM) and Sui wallets simultaneously.
2. ✅ **AI Instructor Studio**: Instructors deploy autonomous agents with dual-chain capabilities.
3. ✅ **Sell tickets (Avalanche)**: Riders mint attendance NFT (ERC-721) via dynamic pricing.
4. ✅ **Track Effort (Sui)**: Real-time telemetry simulated via Move objects.
5. ✅ **Issue rewards**: Incentive Engine distributes SPIN tokens based on effort proofs.
6. ✅ **Route Worlds**: 3D interactive WebGL visualization based on GPX data.

### Demo Flow (90 seconds for judges):
1. **Configure Agent**: Deploy "Coach Atlas" (AI) on Avalanche + Sui.
2. **Buy Ticket**: Rider purchases access on Avalanche C-Chain.
3. **Ride**: 3D Visualizer runs, simulating biometric data syncing to Sui.
4. **Claim**: Rider submits proof of effort; contract on Avalanche mints rewards.
5. **Analyze**: AI Agent reviews session performance via Walrus logs.

---

## Competitive Analysis

### vs. Peloton/Strava
- **They**: Centralized, extract all data, own relationship.
- **We**: Decentralized, user-owned data, instructor-owned economics.

### vs. STEPN/Sweatcoin
- **They**: Tokenomics-first, questionable sustainability.
- **We**: Real revenue model (ticket sales), tokens as bonus.

### vs. Other Web3 Fitness
- **They**: Single-chain bottlenecks (gas costs for frequent updates).
- **We**: Dual-Engine (Avalanche + Sui) for unlimited scale and speed.

---

## Team & Execution

### Key Roles for HackMoney
- **Smart Contract Dev**: Solidity (Avalanche) + Move (Sui).
- **Frontend Dev**: React/Next.js with dual-wallet providers.
- **AI Engineer**: Agent logic and "Route World" generation.
- **Product Designer**: 3D visualization and mobile UX.

### Success Metrics
- End-to-end demo: Create Agent → Buy Ticket (Avax) → Ride (Sui).
- Architecture documented: clear distinction between Settlement & Execution layers.
- Performance: <1s latency on route visualization and telemetry.
- Aesthetics: High-fidelity "Route Worlds" 3D visualization.

---

## Roadmap

### Phase 1: HackMoney MVP (COMPLETED ✅)
Focus: Core protocol logic, immersive visualization, and live session mechanics.

#### Protocol Layer
- [x] Wallet Integration (RainbowKit + Wagmi) on Avalanche C-Chain.
- [x] **Smart Contract Factory**: Instructors can deploy session-specific contracts.
- [x] **Dynamic Ticketing**: ERC-721 based access with bonding curve pricing.
- [x] **Attendance Check-in**: Onchain verification of participation.
- [x] **Incentive Engine**: Automated SPIN token rewards for effort.

#### Immersive Layer (Route Worlds)
- [x] **3D Visualization**: Interactive WebGL route rendering from GPX.
- [x] **Story Sync**: Automated detection of climbs and descents as "Story Beats".
- [x] **Social Presence**: Ghost riders for shared class energy.
- [x] **Acoustic Feedback**: Synchronized audio triggers for performance cues.
- [x] **AI Route Generation**: Natural language route creation via Gemini integration.
- [x] **Consolidated AI Service**: Unified AI architecture for agents and route intelligence.

#### UX & Social
- [x] **Instructor Dashboard**: Class builder with economic controls.
- [x] **Rider HUD**: Real-time glassmorphic overlay for HR/Power/Cadence.
- [x] **Social Proof**: One-click generation of shareable effort cards.

---

### Phase 2: Privacy Upgrade (Q2 2026) - IN PROGRESS 🚧
Focus: Cryptographic Zero-Knowledge Proofs and decentralized storage.

#### ZK Circuits (Noir) - COMPLETED ✅
- [x] **effort_threshold Circuit**: Proves HR > threshold without revealing actual values.
- [x] **UltraPlonk Backend**: Browser-compatible proof generation (~500ms).
- [x] **Witness Generation**: Converts telemetry to circuit inputs.
- [x] **Circuit Tests**: Validated threshold met/not met scenarios.

#### On-Chain Verification (Avalanche) - COMPLETED ✅
- [x] **EffortThresholdVerifier.sol**: Solidity verifier contract.
- [x] **UltraVerifier Integration**: Uses Noir-generated verifier.
- [x] **Replay Protection**: Proof hash tracking prevents double-claims.
- [x] **Batch Verification**: Gas-efficient multiple proof verification.
- [x] **Audit Events**: `ProofVerified` events for transparency.

#### Selective Disclosure - COMPLETED ✅
- [x] **DisclosureBuilder**: Configurable privacy policies.
- [x] **Privacy Scoring**: 0-100 score based on data minimization.
- [x] **Statement Templates**: "HR > 150 for 10 min" without raw data.
- [x] **Verifier Service**: On-chain verification of disclosures.

#### Walrus Storage - COMPLETED ✅
- [x] **WalrusClient**: HTTP client for Sui Walrus aggregators.
- [x] **AssetManager**: Domain-specific storage (3D worlds, telemetry).
- [x] **Compression**: Delta encoding for telemetry data.
- [x] **Redundancy**: Multi-aggregator failover.

#### Local Oracle - COMPLETED ✅
- [x] **Browser Prover**: On-device proof generation.
- [x] **Telemetry Buffer**: 10-minute rolling window.
- [x] **Session Management**: Start/stop/intermediate proofs.
- [x] **Auto-Backup**: Secure storage to Walrus.

#### Remaining Phase 2 Items
- [ ] **Voice-Guided Rides**: Real-time conversational control during sessions.
- [ ] **Multi-Route Training Programs**: AI-generated series across multiple days/locations.
- [ ] **Street View Integration**: Real-world route previews for enhanced immersion.
- [ ] **Privacy Subnet**: Dedicated regulatory-compliant subnet for health data.

---

### Phase 3: Ecosystem Growth (Q3 2026)
Focus: Scaling the business model and onboarding the fitness industry.

- [ ] **DeepBook Integration**: AI Agents execute limit orders for class token liquidity on Sui.
- [ ] **Sponsor SDK**: Allow wellness brands to fund reward pools for specific routes.
- [ ] **Mindbody/ClassPass Bridge**: Connect legacy fitness booking to onchain tickets.
- [ ] **Instructor DAO**: Self-governing body for protocol fees and route standards.
- [ ] **Multi-Sport Vertical**: Expand logic to yoga, rowing, and outdoor running clubs.

### Phase 4: Enterprise Scale (Q4 2026)
Focus: Institutional partnerships and planetary scale.

- [ ] **Studio Chain Integration**: White-label infrastructure for global boutique chains.
- [ ] **Privacy-Preserving Analytics**: Aggregate fitness trends for research without user exposure.
- [ ] **Dedicated Subnets**: Launch high-performance AppChains for biometric throughput.
- [ ] **Cross-Chain Rewards**: Composable SPIN utility via Avalanche Warp Messaging.
- [ ] **Wellness Vertical**: Insurance-integrated effort verification.

---

## Implementation Notes

### ZK Circuit Deployment
```bash
# Compile circuit
cd circuits/effort_threshold
nargo compile

# Generate verifier
nargo codegen-verifier

# Run tests
nargo test
```

### Contract Deployment
1. Deploy `UltraVerifier` (generated by Noir)
2. Deploy `EffortThresholdVerifier` with UltraVerifier address
3. Update `NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS` in environment

### Package Installation (for Noir support)
```bash
npm install @noir-lang/backend_barretenberg @noir-lang/noir_js
```