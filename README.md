# SpinChain: Privacy-First Fitness DeFi Protocol

SpinChain is an onchain operating system for fitness instructors that turns spin classes into programmable financial events. It handles ticketing, dynamic pricing, health-based incentives, and shareable performance proofs with privacy-preserving technology.

---

## 🚀 Key Features

### 1. Route Worlds (3D Specialized)
- **Interactive Visualization**: High-fidelity 3D WebGL route visualization using GPX data.
- **Automated Discovery**: AI/Gradient-based detection of climbs and descents.
- **Ghost Riders**: Real-time social presence without compromising individual privacy.
- **Audio Triggers**: Synchronized acoustic cues for high-intensity intervals.

### 2. Onchain Class Engine
- **Class Factory**: Effortless deployment of session-specific smart contracts.
- **Dynamic Pricing**: Bonding-curve-inspired ticket sales to reward early supporters.
- **Attendance Proofs**: Onchain check-in system for verified participation.
- **Revenue Settlement**: Trustless payouts to instructors and studio treasuries.

### 3. Progressive Privacy
- **Sovereign Health Data**: Metrics never leave the rider's device.
- **Verifiable Proofs**: Signed attestations (MVP) upgradeable to full Zero-Knowledge Proofs.
- **Selective Disclosure**: Prove "Effort > 150" without revealing raw heart rate or biometric data.

### 4. Incentive Layer
- **Performance Rewards**: Automatic minting of SPIN tokens for hitting effort thresholds.
- **Shareable Proof Cards**: Dynamic social assets linked to onchain verification.
- **Sponsor Integration**: Reward pools funded by wellness brands and protocols.

---

## 🏗️ Technical Architecture

### Blockchain Stack
- **L2**: Base (Mainnet & Testnet)
- **Contracts**: Solidity 0.8.24+ (Foundry)
- **Identity/Wallet**: RainbowKit + Wagmi + Viem

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
- [**Roadmap**](./docs/ROADMAP.md): Future phases for privacy and scale.
- [**Contracts**](./contracts/README.md): Details on the smart contract layer.

---

## ⚖️ License
MIT © 2026 SpinChain Protocol
