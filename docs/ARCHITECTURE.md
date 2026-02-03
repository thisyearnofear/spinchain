# SpinChain Technical Architecture

SpinChain implements a **Dual-Engine Execution Model** with **Zero-Knowledge Privacy** to solve the dilemma of high-frequency fitness telemetry vs. high-value financial settlement while preserving user privacy.

---

## 1. The Dual-Engine Model

| Engine | Chain | Role | Primitive |
| :--- | :--- | :--- | :--- |
| **Settlement Engine** | **Avalanche (EVM)** | High-value / Low-frequency | ERC-721, ERC-20, ENS, ZK Verifiers |
| **Performance Engine** | **Sui (Move)** | Low-value / High-frequency | Move Objects, Dynamic Fields |

### Why Avalanche for Settlement?
- **Liquidity Depth**: Access to Ethereum-native assets and mature DeFi protocols (Uniswap v4).
- **ZK Verification**: On-chain verification of Noir proofs via `EffortThresholdVerifier`.
- **Subnet Ready**: Future-proofed for a dedicated "SpinChain Subnet" with custom gas rules.
- **Identity**: Native ENS support for Instructor branding.

### Why Sui for Performance?
- **Parallel Execution**: Each rider's telemetry update is an independent transaction.
- **Move Safety**: Biometric objects are strongly typed and resource-oriented.
- **Latency**: 480ms finality allows for real-time reactivity in AI Instructors.

---

## 2. Zero-Knowledge Privacy Architecture

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

## 3. Component Breakdown

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

## 4. Data Integrity & Storage

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

## 5. AI-Powered Route Generation

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

## 6. Security Considerations

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
