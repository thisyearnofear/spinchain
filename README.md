# SpinChain: Privacy-First Fitness DeFi Protocol
## HackMoney 2026 Submission Brief

---

## Executive Summary

**One-Liner**: An onchain operating system for fitness instructors that turns spin classes into programmable financial events—handling ticketing, dynamic pricing, health-based incentives, and shareable performance proofs with privacy-preserving ZK technology.

**Core Innovation**: We're not building "web3 Peloton"—we're building **DeFi-native boutique fitness infrastructure** where classes are financial primitives, instructors are micro-protocol operators, and health data becomes programmable incentives through zero-knowledge proofs.

---

## Market Positioning

### What Spin Studios Already Do:
- Run ticketed events with dynamic pricing
- Manage incentives and loyalty rewards
- Track performance metrics
- Generate shareable achievements
- Process payments and revenue splits

### What We Add:
- Financial logic moves onchain (trust-minimized)
- Health data stays private but verifiable (ZK proofs)
- Participation becomes composable DeFi objects
- Instructor autonomy over economics
- Cryptographic proof of achievement

---

## Product Architecture

### 1. Onchain Components (Ethereum L2)

#### Smart Contract Layer
Built on **Base** or **Optimism** for HackMoney compatibility

**ClassFactory.sol**
- Creates new SpinClass contracts per session
- Parameters: date/time, max riders, pricing curve, reward rules
- Emits creation events for indexing

**SpinClass.sol**
- Handles ticket minting (ERC-721 or simple NFT)
- Manages attendance confirmation
- Distributes payouts to instructor/studio
- Triggers reward mechanisms

**IncentiveEngine.sol**
- Consumes ZK proofs from riders
- Mints rewards (ERC-20 points or ERC-1155 badges)
- Applies discounts automatically for future classes
- Supports sponsor-funded reward pools

**Treasury/Splitter**
- Instructor-controlled revenue distribution
- Optional DAO fee (platform sustainability)
- Streaming payments possible (per-minute ridden)

#### Why This Fits DeFi
- **Programmable events**: Classes as smart contracts
- **Trustless settlement**: No payment processor middleman
- **Composability**: Badges/tokens can integrate with broader ecosystem
- **Sponsor pools**: External protocols can incentivize participation

---

### 2. Privacy Layer (The Critical Innovation)

#### Architecture Philosophy
**"Prove what matters, hide everything else"**

Health data NEVER goes onchain. Instead, we prove claims:
- "User maintained HR > 140 for ≥ 25 min"
- "User completed 90% of the ride"  
- "User is in top 20% effort today"
- "User burned more calories than last class"

#### Technology Stack (2026 Live Primitives)

**Option A: Aztec Network Integration** (Recommended for MVP)
- **Status**: Mainnet live since Q4 2025, transactions enabled early 2026
- **What it provides**: 
  - Fully private smart contracts with end-to-end encryption
  - Native ZK-SNARK based confidentiality
  - Bridges to Base/Optimism for interop
- **Use case**: Issue attendance NFTs privately, then selectively disclose for rewards
- **Why judges will love it**: Aztec just went live—using cutting-edge privacy L2 shows technical sophistication

**Option B: ZKsync Prividium Stack**
- **Status**: Bank-grade privacy infrastructure launched 2026
- **What it provides**:
  - Private execution with selective disclosure
  - Role-based access controls
  - Native Ethereum settlement with privacy by default
- **Use case**: Create private "instructor chains" where health data proofs are verified without exposure
- **Why judges will love it**: Enterprise-ready privacy aligns with HackMoney's institutional DeFi theme

**Option C: Client-Side ZK Proof Generation** (Hybrid Approach - RECOMMENDED)
- **Mobile app computes health metrics locally**
- Uses lightweight ZK libraries (Succinct's SP1, or custom circuits)
- Generates proofs on-device (< 1 second with modern hardware)
- Submits only proofs to smart contracts

**Proof Schema Example**:
```json
{
  "proof_type": "effort_threshold",
  "claim": "effort_score >= 150",
  "proof": "0x...", // ZK-SNARK proof
  "class_id": "0x...",
  "rider_wallet": "0x...",
  "timestamp": 1738540800
}
```

**Privacy Guarantees**:
- Raw HR, glucose, weight NEVER transmitted
- Only boolean claims verified (true/false)
- Contracts blind to sensitive metrics
- Users control which metrics activate

---

### 3. Health Data Integration (Offchain)

**Data Sources**:
- Apple Health / Google Fit APIs
- Peloton/Strava integrations
- Bluetooth heart rate monitors
- Future: CGM devices (glucose/insulin)

**Local Processing Flow**:
```
Wearable → Phone → Local Compute → Proof Generation → Submit Proof
```

**Proof Types** (Progressive Implementation):
1. **MVP**: Signed attestations (app signs metrics, contract verifies signature)
2. **Phase 2**: ZK proofs of thresholds (HR > X, Duration > Y)
3. **Phase 3**: Comparative proofs without values ("better than average", "top quartile")

**Why This Matters**:
- HIPAA-friendly (no PHI transmitted)
- User sovereignty over health data
- Enables financial incentives without surveillance
- Regulatory compliance by design

---

### 4. User Experience Design

#### For Riders (The Dopamine Layer)

**Before Class**:
- Purchase ticket (1-click, wallet abstraction)
- See available rewards: "Complete ride → 50 $SPIN tokens"
- Preview effort targets and playlist vibe
- Connect wearable devices

**During Class**:
- **Minimal UI**: Only big numbers (HR zone, time, effort)
- No wallet interactions mid-ride
- Background proof generation

**After Class** (Critical Moment):
- **Stats Card**:
  - "45 min, 620 calories ≈ 3 donuts burned"
  - Effort percentile: "Top 15% today"
  - Streak badge: "10-class streak unlocked"
- **NFT/Badge Reveal**: Animated mint
- **Discount Unlocked**: "20% off next class"
- **Share Button**: Instagram/Twitter-ready proof card

**Share Card Features**:
- Auto-generated visual with stats
- Links to instructor profile
- Onchain verification link
- Optional sponsor branding

#### For Instructors (The Business Brain)

**Class Builder**:
- Set date/duration, ticket supply
- Dynamic pricing curves (early bird, surge, loyalty)
- Discount rules (streaks, referrals, "bring a friend")
- Reward structures (effort thresholds → token amounts)

**Live Class Dashboard**:
- Rider tiles with anonymized metrics (only aggregates visible)
- Music queue management
- Real-time aggregate stats (% hitting targets)
- Privacy-first: instructor never sees individual medical data

**Treasury Management**:
- Revenue tracking per class
- Automatic payout distribution
- Sponsor pool monitoring
- Historical earnings analytics

**Growth Tools**:
- Auto-generated promo materials
- Leaderboard (opt-in, privacy-preserving)
- Referral tracking (onchain attribution)

---

## Technical Stack (2026 Production-Ready)

### Blockchain
- **L2**: Base (Coinbase-backed, massive onboarding funnel)
- **Alternative**: Optimism (Superchain ecosystem)
- **Fallback**: Arbitrum (proven scalability)

### Smart Contracts
- **Language**: Solidity 0.8.24+
- **Framework**: Foundry
- **Testing**: Foundry tests + mainnet fork testing
- **Auditing**: Slither + manual review (post-hackathon: Spearbit/Trail of Bits)

### Privacy Infrastructure
- **Primary**: Aztec Network (privacy L2 with bridges)
- **Proof Generation**: Client-side (mobile app using Succinct SP1 or Noir)
- **Proof Verification**: Onchain via ZK verifier contracts
- **Fallback**: Signed attestations (upgradeable to ZK post-MVP)

### Frontend
- **Framework**: Next.js 14 + TypeScript
- **Wallet**: Privy (best UX, email/social login support)
- **Chain Interaction**: Wagmi + Viem
- **UI**: Tailwind + shadcn/ui

### Backend/Offchain
- **Database**: Supabase (user profiles, class metadata)
- **Indexing**: The Graph (event indexing for analytics)
- **Health Data**: Local-first architecture (never touch our servers)
- **Proofs**: Generated client-side, no server-side health data

### Mobile Integration
- **Health APIs**: Apple HealthKit, Android Health Connect
- **ZK Library**: WASM-based proof generation (runs in mobile browser or native)
- **Bluetooth**: Web Bluetooth API for live HR monitors

---

## Privacy Implementation (Detailed)

### Privacy-Aware Incentive Design

**❌ Bad Incentive**: "Highest calories burned wins"  
**✅ Good Incentive**: "Exceed your 7-day average"

**Why This Matters**:
- Doesn't penalize beginners
- No sensitive data leakage
- Fairer competition model
- Aligns with privacy primitives

**Example Incentive Structures**:
- Relative achievements (percentiles, not absolutes)
- Personal improvement (beat your baseline)
- Consistency rewards (streak maintenance)
- Effort-adjusted (accounts for individual fitness levels)

### Consent & Control UX

**Rider Controls**:
- Toggle which metrics can be used (HR only, no glucose)
- Per-class consent ("effort only this time")
- Option to ride "off-leaderboard"
- Data deletion rights

**Instructor View**:
- Only sees aggregated stats
- Cannot access individual medical data
- Dashboard shows: "80% hit effort goal" (not who)

**Legal Protection**:
- Instructors protected from liability (no PHI access)
- Platform compliant with privacy regulations
- Users maintain full data sovereignty

---

## MVP Scope for HackMoney (Feb 11 Deadline)

### Must Ship:
1. ✅ Create class (instructor deploys SpinClass contract)
2. ✅ Sell tickets (riders mint attendance NFT)
3. ✅ Track attendance (check-in mechanism)
4. ✅ Issue rewards (Incentive Engine + SPIN token mint)
5. ✅ Generate share card (automated stats + verification link)
6. ✅ Route Worlds (3D interactive visualization based on GPX)

### Stub/Simulate:
- Advanced glucose/insulin tracking (show UI, fake data)
- Full ZK circuits (use signed attestations, design for upgrade)
- Multi-chain deployment (launch on Base only)
- Complex music integration (manual playlist selection)

### Demo Flow (90 seconds for judges):
```
1. Instructor creates class → deploys contract → sets reward (10 tokens)
2. Rider buys ticket → mints NFT
3. Class completes → app generates proof ("effort > 150")
4. Proof submitted → contract verifies → mints 10 tokens
5. Share card generated → shows stats + onchain proof link
```

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

## Privacy Narrative for Judges

### The Pitch:
*"We built a privacy-preserving oracle for human effort that enables financial rewards without surveillance. Health data stays local. Only minimal ZK proofs go onchain. Contracts are blind to sensitive metrics. Users earn without revealing personal information."*

### Why This Matters:
- Most DeFi requires full transparency (bad for health data)
- Our approach: **trust-minimized finance + sovereign data**
- Enables new markets (fitness, wellness, healthcare)
- Shows ZK tech is production-ready, not just research

### Technical Depth:
- **Not just "we'll add ZK later"**—designed privacy-first
- Uses 2026 live infrastructure (Aztec mainnet, ZKsync Prividium)
- Client-side proof generation (no centralized health data lake)
- Explicit consent controls visible in UI

---

## Competitive Analysis

### vs. Peloton/Strava
- **They**: Centralized, extract all data, own relationship
- **We**: Decentralized, user-owned data, instructor-owned economics

### vs. STEPN/Sweatcoin
- **They**: Tokenomics-first, questionable sustainability
- **We**: Real revenue model (ticket sales), tokens as bonus

### vs. Other Web3 Fitness
- **They**: Public health data or vague "web3 integration"
- **We**: Privacy-first architecture with live ZK primitives

---

## Post-Hackathon Roadmap

### Phase 1 (Q1 2026) - MVP Launch
- Deploy on Base testnet → mainnet
- Onboard 5-10 pilot instructors
- **[COMPLETED]** Route Worlds: 3D visualization platform using GPX data
- Proof of concept with real classes
- Community feedback loop

### Phase 2 (Q2 2026) - Privacy Upgrade
- Migrate to full ZK circuits (Aztec contracts)
- Add glucose/insulin tracking (with privacy)
- Enhanced proof types (comparative, not just threshold)
- Mobile app launch (iOS/Android)

### Phase 3 (Q3 2026) - Ecosystem Growth
- Integrate with existing fitness platforms (Mindbody, ClassPass)
- Launch instructor DAO for governance
- Sponsor integration SDK (brands fund reward pools)
- Multi-sport expansion (yoga, boxing, running clubs)

### Phase 4 (Q4 2026) - Scale
- Launch on additional L2s (Optimism, Arbitrum)
- Enterprise partnerships (studio chains)
- Advanced analytics (privacy-preserving)
- Wellness vertical expansion

---

## Team & Execution

### Key Roles for HackMoney
- **Smart Contract Dev**: Deploy core contracts, test rigorously
- **Frontend Dev**: Build instructor + rider apps
- **ZK/Crypto Engineer**: Implement proof generation/verification
- **Product Designer**: Craft share cards, UX flows
- **Integration Specialist**: Connect health APIs, test on real devices

### Success Metrics
- Contracts deployed and verified on testnet
- End-to-end demo (create class → ride → reward)
- Privacy architecture documented and defensible
- Share card actually generates and looks good
- Judges understand the innovation in 2 minutes
