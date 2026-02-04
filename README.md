# SpinChain: The Dual-Engine Fitness Protocol

SpinChain is a hybrid fitness protocol that combines the liquidity depth of **Avalanche** with the parallel execution speed of **Sui**. It enables **AI Agents** to run autonomous spin classes with real-time biometric telemetry, turning fitness into programmable financial events.

---

## 🚀 Key Features

### 1. Route Worlds (3D Specialized)
- **Interactive Visualization**: High-fidelity 3D WebGL route visualization using GPX data.
- **AI Route Generation**: Natural language route creation via Gemini integration.
- **Automated Discovery**: AI/Gradient-based detection of climbs and descents.
- **Ghost Riders**: Real-time social presence without compromising individual privacy.
- **Audio Triggers**: Synchronized acoustic cues for high-intensity intervals.

### 2. AI Instructor Studio
- **Agentic Finance**: Deploy autonomous AI instructors (e.g., "Coach Atlas") that manage their own schedules and P&L.
- **Dual-Chain Logic**: Agents coordinate settlement on Avalanche and performance tuning on Sui Testnet.
- **Liquidity Hooks**: Automated management of class token liquidity via **Uniswap v4 hooks** (`DemandSurgeHook.sol`).

### 3. The Hybrid Architecture
- **Settlement Layer (Avalanche)**: Handling tickets, rewards, identity (ENS), and **ZK proof verification**.
- **Performance Layer (Sui Testnet)**: Processing high-frequency biometric data (10Hz).
    - **Package ID**: `0x9f693e5143b4c80e7acb4f5fb4e2c62648f036c8fe70044fdcd5688fb9f8681d`
- **Storage Layer (Walrus)**: Decentralized hosting for 3D worlds and raw session logs.

### 4. Zero-Knowledge Privacy ✅ IMPLEMENTED
- **Noir Circuits**: Production ZK circuits proving effort without revealing health data.
- **Selective Disclosure**: Prove "HR > 150" without revealing raw heart rate or biometric data.
- **On-Chain Verification**: Solidity verifier contracts on Avalanche C-Chain.
- **Local Oracle**: Browser-based proof generation (<1s) with no data leaving device.
- **Walrus Backup**: Encrypted decentralized storage for raw telemetry.

### 5. Incentive Layer
- **ZK-Based Rewards**: Automatic SPIN token distribution verified by ZK proofs.
- **Performance Rewards**: Rewards for hitting effort thresholds with privacy preserved.
- **Shareable Proof Cards**: Dynamic social assets linked to onchain ZK verification.
- **Sponsor Integration**: Reward pools funded by wellness brands and protocols.

---

## 🏗️ Technical Architecture

### Blockchain Stack
- **Settlement**: Avalanche C-Chain (EVM) with ZK Verifiers
- **Execution**: Sui (Move)
- **Contracts**: Solidity 0.8.24+ & Sui Move
- **Identity/Wallet**: RainbowKit (EVM) + Sui dApp Kit
- **ZK Proofs**: Noir (Aztec) with UltraPlonk backend

### Frontend & Visualization
- **Framework**: Next.js 16 (App Router)
- **3D Engine**: React Three Fiber + Three.js + Drei
- **Styling**: Tailwind CSS + Custom Glassmorphic System

### Privacy & ZK Stack
- **Circuits**: Noir (`circuits/effort_threshold/`)
- **Proving**: Browser-based UltraPlonk (barretenberg)
- **Verification**: `EffortThresholdVerifier.sol` on Avalanche
- **Storage**: Sui Walrus for encrypted telemetry

---

## 🛠️ Getting Started

### Installation
```bash
npm install
# or
pnpm install
```

### Environment Setup
Create a `.env` file based on `.env.example`:
```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id
NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS=0x...
```

### Compile ZK Circuits (Optional)
```bash
# Install Noir
curl -L https://noirup.dev | bash
noirup

# Compile circuits
cd circuits/effort_threshold
nargo compile
nargo test
```

### Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the protocol dashboard.

---

## 📚 Documentation
- [**Agentic Finance Implementation**](./docs/AGENTIC_FINANCE_IMPLEMENTATION.md): Deep dive into the Dual-Engine setup and Uniswap v4 Hook logic.
- [**Sui Deployment Details**](./docs/SUI_DEPLOYMENT_DETAILS.md): On-chain artifacts and Package IDs for the Performance Layer.
- [**Architecture & Overview**](./docs/ARCHITECTURE.md): Core architecture, dual-engine design, and roadmap.
- [**AI Integration**](./docs/AI_INTEGRATION_ARCHITECTURE.md): AI features, route generation, and agentic finance.
- [**ZK & Security**](./docs/ZK_INTEGRATION.md): Zero-knowledge privacy and BLE integration guides.
- [**Contracts**](./contracts/README.md): Details on the smart contract layer.

---

## 🔐 ZK Proof Quick Example

```typescript
import { useZKClaim } from '@/app/hooks/use-zk-claim';

// Generate ZK proof (browser, <1s)
const { generateProof, submitProof } = useZKClaim();

const proofResult = await generateProof(
  165,    // max heart rate
  150,    // threshold
  10      // duration (minutes)
);

// Submit to Avalanche verifier
await submitProof(params, proofResult.proof);
// → Verifies without revealing actual HR data!
```

---

## ⚖️ License
MIT © 2026 SpinChain Protocol
