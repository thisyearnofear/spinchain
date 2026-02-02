# SpinChain: The Dual-Engine Fitness Protocol

SpinChain is a hybrid fitness protocol that combines the liquidity depth of **Avalanche** with the parallel execution speed of **Sui**. It enables **AI Agents** to run autonomous spin classes with real-time biometric telemetry, turning fitness into programmable financial events.

---

## 🚀 Key Features

### 1. Route Worlds (3D Specialized)
- **Interactive Visualization**: High-fidelity 3D WebGL route visualization using GPX data.
- **Automated Discovery**: AI/Gradient-based detection of climbs and descents.
- **Ghost Riders**: Real-time social presence without compromising individual privacy.
- **Audio Triggers**: Synchronized acoustic cues for high-intensity intervals.

### 2. AI Instructor Studio
- **Agentic Finance**: Deploy autonomous AI instructors (e.g., "Coach Atlas") that manage their own schedules and P&L.
- **Dual-Chain Logic**: Agents coordinate settlement on Avalanche and performance tuning on Sui.
- **Liquidity Hooks**: Automated management of class token liquidity via Uniswap v4 hooks.

### 3. The Hybrid Architecture
- **Settlement Layer (Avalanche)**: Handling tickets, rewards, and identity (ENS).
- **Performance Layer (Sui)**: Processing high-frequency biometric data (10Hz) via parallel Move objects.
- **Storage Layer (Walrus)**: Decentralized hosting for 3D worlds and raw session logs.

### 4. Progressive Privacy
- **Sovereign Health Data**: Metrics never leave the rider's device.
- **Verifiable Proofs**: Signed attestations (MVP) upgradeable to full Zero-Knowledge Proofs.
- **Selective Disclosure**: Prove "Effort > 150" without revealing raw heart rate or biometric data.

### 5. Incentive Layer
- **Performance Rewards**: Automatic minting of SPIN tokens for hitting effort thresholds.
- **Shareable Proof Cards**: Dynamic social assets linked to onchain verification.
- **Sponsor Integration**: Reward pools funded by wellness brands and protocols.

---

## 🏗️ Technical Architecture

### Blockchain Stack
- **Settlement**: Avalanche C-Chain (EVM)
- **Execution**: Sui (Move)
- **Contracts**: Solidity 0.8.24+ & Sui Move
- **Identity/Wallet**: RainbowKit (EVM) + Sui dApp Kit

### Frontend & Visualization
- **Framework**: Next.js 14 (App Router)
- **3D Engine**: React Three Fiber + Three.js + Drei
- **Styling**: Tailwind CSS + Custom Glassmorphic System

### Privacy & Data
- **Attestations**: Browser-native EIP-712 signing
- **Data Source**: GPX Parsers + Mock Health APIs (MVP)
- **ZK Path**: Aztec / Noir / Succinct SP1 (Roadmap)

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
```

### Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the protocol dashboard.

---

## 📚 Documentation
- [**HackMoney 2026 Submission**](./docs/HACKMONEY.md): Detailed hackathon-specific brief.
- [**Architecture**](./docs/ARCHITECTURE.md): Deep dive into the Dual-Engine design.
- [**Roadmap**](./docs/ROADMAP.md): Future phases for privacy and scale.
- [**Contracts**](./contracts/README.md): Details on the smart contract layer.

---

## ⚖️ License
MIT © 2026 SpinChain Protocol
