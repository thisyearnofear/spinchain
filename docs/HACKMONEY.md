# HackMoney 2026: SpinChain Submission

This document outlines the specific submission details for the **HackMoney 2026** hackathon.

## Submission Brief

**One-Liner**: An onchain operating system for fitness instructors that turns spin classes into programmable financial events—handling ticketing, dynamic pricing, health-based incentives, and shareable performance proofs with privacy-preserving ZK technology.

**Core Innovation**: We're not building "web3 Peloton"—we're building **DeFi-native boutique fitness infrastructure** where classes are financial primitives, instructors are micro-protocol operators, and health data becomes programmable incentives through zero-knowledge proofs.

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

### 3. Privacy-First Design (2026 Theme)
- Uses live privacy L2s (Aztec/ZKsync Prividium)
- Demonstrates ZK proofs for real use case
- Not theoretical—actually buildable today
- Aligns with Ethereum's 2026 privacy roadmap

### 4. Technical Sophistication
- Multi-layer architecture (L1/L2/offchain)
- Proper privacy primitives (not bolt-on)
- Client-side proof generation
- Upgradeable from signed claims → ZK

### 5. Clear Adoption Path
- Instructors already exist (not speculative market)
- No "web3 education" needed for users
- Viral growth via share cards (built-in marketing)
- B2B2C model (sell to studios, reach riders)

---

## MVP Scope for HackMoney (Feb 11 Deadline)

### Must Ship:
1. ✅ **Create class**: Instructor deploys SpinClass contract through ClassFactory.
2. ✅ **Sell tickets**: Riders mint attendance NFT (ERC-721) via dynamic pricing.
3. ✅ **Track attendance**: Onchain check-in mechanism for verified riders.
4. ✅ **Issue rewards**: Incentive Engine distributes SPIN tokens based on effort.
5. ✅ **Generate share card**: Automated visual highlights for social proof.
6. ✅ **Route Worlds**: 3D interactive WebGL visualization based on GPX data.

### Demo Flow (90 seconds for judges):
1. Instructor creates class → deploys contract → sets reward (10 tokens).
2. Rider buys ticket → mints NFT via dynamic pricing curve.
3. Class completes → app generates proof ("effort > 150").
4. Proof submitted → contract verifies → mints 10 SPIN tokens.
5. Share card generated → shows stats + onchain proof link.

---

## Competitive Analysis

### vs. Peloton/Strava
- **They**: Centralized, extract all data, own relationship.
- **We**: Decentralized, user-owned data, instructor-owned economics.

### vs. STEPN/Sweatcoin
- **They**: Tokenomics-first, questionable sustainability.
- **We**: Real revenue model (ticket sales), tokens as bonus.

### vs. Other Web3 Fitness
- **They**: Public health data or vague "web3 integration".
- **We**: Privacy-first architecture with live ZK primitives.

---

## Team & Execution

### Key Roles for HackMoney
- **Smart Contract Dev**: Core protocol, testing, and security.
- **Frontend Dev**: React/Next.js interface for Instructors & Riders.
- **ZK Engineer**: Privacy layer and proof generation (Noir/SP1).
- **Product Designer**: 3D visualization and mobile UX.

### Success Metrics
- End-to-end demo: Create class → Ride → Reward.
- Privacy architecture documented and defensible.
- Performance: WASM-based ZK proof generation in < 1s.
- Aesthetics: High-fidelity "Route Worlds" 3D visualization.
