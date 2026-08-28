# SpinChain: Operations

> **Purpose**: How to set up, deploy, test, and run SpinChain in production.
> **See also**: [WEDGE.md](./WEDGE.md) for feature discipline, [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) for the current implementation plan, [ARCHITECTURE.md](./ARCHITECTURE.md) for technical reference.
>
> **Supersedes**: GETTING_STARTED.md, DEPLOYMENT.md, PRODUCTION_ROADMAP.md (roadmap sections only), FEATURES.md (product state sections only)

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Environment Setup](#2-environment-setup)
3. [Current User Flows](#3-current-user-flows)
4. [Smart Contracts](#4-smart-contracts)
5. [Frontend Deployment](#5-frontend-deployment)
6. [Mobile App](#6-mobile-app)
7. [Testing](#7-testing)
8. [Security](#8-security)
9. [Troubleshooting](#9-troubleshooting)
10. [Production Roadmap](#10-production-roadmap)
11. [Current Product State](#11-current-product-state)

---

## 1. Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Foundry (for contract deployment/testing)
- Sui CLI (for Sui package deployment)
- Noir (for ZK circuit compilation)

### Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.local.template .env.local

# Start development server
pnpm run dev
```

Open [http://localhost:3210](http://localhost:3210) (dev server is pinned to port 3210)

### Current Status (2026-08-17)

- The app is in testnet/pre-launch stage
- Demo content gated behind `NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG` — off by default
- Real Noir ZK circuit deployed: HonkVerifier on Fuji, UltraHonk proving in-browser via `@aztec/bb.js`
- Supabase code is complete but no instance is provisioned yet — persistence/auth fall back to localStorage
- Do not treat this repo as production-ready without completing the launch checklist below

---

## 2. Environment Setup

### Required Variables

```env
# WalletConnect (get from cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id

# Venice AI (default - privacy-first, get from venice.ai)
VENICE_API_KEY=your_key

# Optional: Gemini 3 (fallback - BYOK from aistudio.google.com)
GEMINI_API_KEY=your_key

# Optional: ElevenLabs (voice synthesis)
ELEVENLABS_API_KEY=your_key

# Sui Wallet (for instructor session creation)
SUI_WALLET_ADDRESS=<your_sui_address>
SUI_PRIVATE_KEY=your_key
```

### Optional Variables

```env
# Deployed Contracts (see deployment section)
NEXT_PUBLIC_SUI_PACKAGE_ID=<your_package_id>
NEXT_PUBLIC_ULTRA_VERIFIER_ADDRESS=<contract_address>
NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS=<contract_address>
NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS=<contract_address>

# Tatum Sui RPC (optional)
# When set, Sui JSON-RPC traffic routes through Tatum's gateway.
# Free key at https://dashboard.tatum.io
NEXT_PUBLIC_TATUM_API_KEY=

# Walrus network (optional, defaults to testnet)
NEXT_PUBLIC_WALRUS_NETWORK=testnet

# EVM Contracts (all deployed to Avalanche Fuji — 2026-06-22)
NEXT_PUBLIC_SPIN_PACK_ADDRESS=0x2C8443584daFA864Caa967cBDD7ec3D17157618B
NEXT_PUBLIC_SPIN_TOKEN_ADDRESS=0x4c0E965B809452F2C914a74d1D0e9C3375543392
NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS=0x69800d3ABda003b7aA6038831715a4aCb736403d
NEXT_PUBLIC_CLASS_FACTORY_ADDRESS=0x035026f85CCbC273160669FBe9Ba5Dc147D0Bd9b
NEXT_PUBLIC_ULTRA_VERIFIER_ADDRESS=0xF2a33f6e9a5e935Db5d682E226A7e1a0249A641B
NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS=0xBbc32cc3b8AF9BaeD8D77E3bf4fC69141b0c9dA4
NEXT_PUBLIC_TREASURY_SPLITTER_ADDRESS=0x00a1e5688AF26c724155BfEe100fF23d387850AB
NEXT_PUBLIC_BIOMETRIC_ORACLE_ADDRESS=0x038fca8A26F9065f12F831C0600f30d8C90AFCFD
```

---

## 3. Current User Flows

### 1. Welcome Modal
New users see a 3-step intro focused on the product concept. This is onboarding copy, not proof that all reward and privacy flows are fully live end-to-end.

### 2. Guest Mode
- Skip wallet connection → "Explore as Guest"
- Access demo/practice flows without wallet connection
- Useful for local testing and product walkthroughs

### 3. First Ride Checklist
- [ ] Connect Wallet (RainbowKit)
- [ ] Link Device (BLE or Simulator)
- [ ] Complete a ride flow in demo or testnet mode

### Input Modes

**BLE Device** (Native Mobile)
- Connects to Schwinn IC4, Bowflex C6, HR monitors
- Uses Capacitor BLE plugin (`@capacitor-community/bluetooth-le`)
- Works on iOS, Android, Desktop Chrome

**Pedal Simulator** (No Hardware)
- Keyboard controls: Arrow keys (← / →) to pedal
- Animated crank with cadence zones
- Haptic feedback on mobile
- Generates valid telemetry for testing

---

## 4. Smart Contracts

### Avalanche (EVM) — Fuji Testnet

#### Prerequisites
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

#### Deploy to Fuji

**Option A: Full deployment with real HonkVerifier**
```bash
cd contracts/evm
export AVALANCHE_PRIVATE_KEY=your_deployer_key

# 1. Compile Noir circuit
nargo compile  # in circuits/effort_threshold/

# 2. Generate HonkVerifier from Noir circuit
BB=$(find node_modules -path '*@aztec/bb.js*dest/node/bin/index.js' | head -1)
node $BB write_vk -b circuits/effort_threshold/target/effort_threshold.json -o circuits/effort_threshold/target/vk_evm -t evm
node $BB write_solidity_verifier -k circuits/effort_threshold/target/vk_evm/vk -o contracts/evm/src-honk/HonkVerifier.sol -t evm

# 3. Deploy HonkVerifier (must use honk profile — no via_ir)
FOUNDRY_PROFILE=honk forge create src-honk/HonkVerifier.sol:HonkVerifier \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --private-key $AVALANCHE_PRIVATE_KEY --broadcast

# 4. Deploy remaining contracts with HonkVerifier address
export ULTRA_VERIFIER_ADDRESS=<deployed_honkverifier_address>
forge script src/deploy.s.sol:DeployScript \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast -vvvv
```

**Option B: Quick deployment with mock verifier (testing only)**
```bash
cd contracts/evm
export AVALANCHE_PRIVATE_KEY=your_deployer_key
export ALLOW_MOCK_VERIFIER=true
forge script src/deploy.s.sol:DeployScript --rpc-url https://api.avax-test.network/ext/bc/C/rpc --broadcast -vvvv
```

#### Deployed Contracts (Fuji — 2026-06-22)

| Contract | Address |
|----------|---------|
| `SpinPack` (ERC-1155) | `0x2C8443584daFA864Caa967cBDD7ec3D17157618B` |
| `SpinToken` (ERC-20) | `0x4c0E965B809452F2C914a74d1D0e9C3375543392` |
| `IncentiveEngine` | `0x69800d3ABda003b7aA6038831715a4aCb736403d` |
| `ClassFactory` | `0x035026f85CCbC273160669FBe9Ba5Dc147D0Bd9b` |
| `HonkVerifier` (real ZK) | `0xF2a33f6e9a5e935Db5d682E226A7e1a0249A641B` |
| `EffortThresholdVerifier` | `0xBbc32cc3b8AF9BaeD8D77E3bf4fC69141b0c9dA4` |
| `TreasurySplitter` | `0x00a1e5688AF26c724155BfEe100fF23d387850AB` |
| `BiometricOracle` | `0x038fca8A26F9065f12F831C0600f30d8C90AFCFD` |

> `HonkVerifier` is a real UltraHonk Solidity verifier generated from the Noir circuit via `bb.js 5.0.0-rc.1`. ZK proofs are cryptographically verified on-chain.
>
> `BiometricOracle` is deployed with the deployer as the CRE forwarder (placeholder). CRE deployment pending Chainlink Early Access approval.
>
> `YellowSettlement` was consolidated into `IncentiveEngine` as `submitChannelProof` / `batchSubmitChannelProof`.

#### Verify on Snowtrace
```bash
export SNOWTRACE_API_KEY=your_api_key
forge script src/deploy.s.sol:DeployScript \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast --verify -vvvv
```

### Sui Package (Testnet)

#### Setup
```bash
brew install sui
sui client new-address ed25519
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet
sui client faucet
```

#### Deploy
```bash
cd move/spinchain
sui move build
sui client publish --gas-budget 100000000
```

**Save:** Package ID → `NEXT_PUBLIC_SUI_PACKAGE_ID`

#### Current Deployment
| Field | Value |
|-------|-------|
| **Package ID** | `0x51542d1d4b43763d58e6f91f845f63157d5fc59bd95ead54dc370b0898d1185c` |
| **Version** | 2 (upgraded — includes `TelemetryAnchor`, `anchor_telemetry_blob`, `spin_token` module) |

**v2 upgrade contents** (additive):
- `spinsession::anchor_telemetry_blob` entry function (Walrus-as-memory anchoring)
- `spinsession::TelemetryAnchor` struct + `TelemetryBlobAttached` event
- `spin_token` module (`TreasuryManager` shared object with buyback/burn/deposit entry functions)

### ZK Verifier (Noir)

#### Setup
```bash
curl -L https://noirup.dev | bash
noirup
```

#### Compile & Test Circuit
```bash
cd circuits/effort_threshold
nargo compile
nargo test
```

#### Generating the Real Solidity Verifier

```bash
# In circuits/effort_threshold/
nargo compile
BB=$(find node_modules -path '*@aztec/bb.js*dest/node/bin/index.js' | head -1)
node $BB write_vk -b target/effort_threshold.json -o target/vk_evm -t evm
node $BB write_solidity_verifier -k target/vk_evm/vk -o ../../contracts/evm/src-honk/HonkVerifier.sol -t evm
```

**Note:** `HonkVerifier.sol` must be compiled without `via_ir` (stack-too-deep error). It lives in `contracts/evm/src-honk/` and is compiled via `FOUNDRY_PROFILE=honk`.

---

## 5. Frontend Deployment

### Vercel

```bash
pnpm add -g vercel
vercel
vercel --prod
```

### Environment Variables for Vercel

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
VENICE_API_KEY=...
NVIDIA_API_KEY=...  # Optional fallback
GEMINI_API_KEY=...  # Optional fallback
ELEVENLABS_API_KEY=...
NEXT_PUBLIC_SUI_PACKAGE_ID=0x51542d1d4b43763d58e6f91f845f63157d5fc59bd95ead54dc370b0898d1185c
NEXT_PUBLIC_SPIN_PACK_ADDRESS=0x2C8443584daFA864Caa967cBDD7ec3D17157618B
NEXT_PUBLIC_SPIN_TOKEN_ADDRESS=0x4c0E965B809452F2C914a74d1D0e9C3375543392
NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS=0x69800d3ABda003b7aA6038831715a4aCb736403d
NEXT_PUBLIC_CLASS_FACTORY_ADDRESS=0x035026f85CCbC273160669FBe9Ba5Dc147D0Bd9b
NEXT_PUBLIC_ULTRA_VERIFIER_ADDRESS=0xF2a33f6e9a5e935Db5d682E226A7e1a0249A641B
NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS=0xBbc32cc3b8AF9BaeD8D77E3bf4fC69141b0c9dA4
NEXT_PUBLIC_TREASURY_SPLITTER_ADDRESS=0x00a1e5688AF26c724155BfEe100fF23d387850AB
NEXT_PUBLIC_BIOMETRIC_ORACLE_ADDRESS=0x038fca8A26F9065f12F831C0600f30d8C90AFCFD
NEXT_PUBLIC_REWARD_VERIFICATION_MODE=zk
```

### Supabase (Required)

Create a Supabase project, run `app/lib/supabase/schema.sql`, then set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Without these, persistence/auth silently fall back to localStorage.

---

## 6. Mobile App

### Capacitor Setup

```bash
npx cap init
npx cap add ios
npx cap add android
pnpm add @capacitor-community/bluetooth-le
```

### Build & Deploy

```bash
pnpm run build
npx cap sync
npx cap open ios    # Xcode
npx cap open android # Android Studio
```

### Browser Compatibility

| Browser | BLE Support | Notes |
|---------|-------------|-------|
| Chrome Desktop | ✅ Full | Works great |
| Safari macOS | ❌ None | Use native app |
| Safari iOS 16+ | ⚠️ Partial | Limited |
| Chrome Android | ⚠️ Partial | Varies |
| Firefox Mobile | ❌ None | Use native app |

---

## 7. Testing

### Unit Tests (Foundry)

```bash
# Run all tests
cd contracts/evm
forge test -vvv

# BiometricOracle tests (verbose)
forge test --match-path test/BiometricOracle.t.sol -vv

# ZK claim tests only
forge test --match-path test/ZKBatchRewards.t.sol -vvv
```

### ZK Circuits (Noir)

```bash
cd circuits/effort_threshold
nargo compile
nargo test
```

### End-to-End Simulation

```bash
# ZK Live Loop validation
npx ts-node --esm scripts/e2e-live-loop.ts

# Gas benchmarks
cd contracts/evm && forge test --match-contract ZKGasBenchmark -vvv --gas-report

# E2E deployment verification (forks Fuji)
cd contracts/evm && forge test --match-contract E2EFujiDeployment --fork-url fuji -vvv

# Manual verification script
./scripts/e2e-verify-fuji.sh
```

### Gas Benchmark Results

| Chunks | Ride Duration | Gas (batch) | Gas (individual) | Savings | Fuji Block Headroom |
|--------|--------------|-------------|-------------------|---------|---------------------|
| 1 | 5 min | 159k | 159k | — | 98% |
| 3 | 15 min | 95k | ~477k | 80% | 99% |
| 6 | 30 min | 299k | — | — | 96% |
| 9 | 45 min | 364k | 492k | 40% | 95% |
| 12 | 60 min | 442k | — | — | 94% |

- Per-chunk cost stabilizes at ~28k gas for batches of 3-9 chunks
- 45-min session (9 chunks): 364k gas, avg effort 716, reward 71.47 SPIN
- All batch sizes fit comfortably within Fuji's 8M block gas limit
- **Recommendation**: Use batch submission for rides >= 3 chunks

---

## 8. Security

### Pre-Commit Hook

Blocks accidental secret commits.

**What It Blocks:**
- Private keys (Sui `suiprivkey1...`, ETH 64-char hex)
- API keys (Google `AIza...`, GitHub `ghp_...`, AWS `AKIA...`)
- High-entropy `KEY=`, `SECRET=`, `TOKEN=` patterns
- `.env.local`, `.env.production`, `.env.development`

**Bypass (Emergency Only):**
```bash
git commit --no-verify
```

---

## 9. Troubleshooting

### "Wallet not connected"
- Ensure `.env.local` has `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- Check RainbowKit provider in `app/providers.tsx`

### "BLE device not found"
- Use Chrome/Edge (Firefox/Safari unsupported on web)
- Grant Bluetooth permissions in browser settings
- Ensure device is in pairing mode

### "ZK proof failed"
- Check `NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS` is set
- Verify contract deployed to correct network (Fuji)
- Ensure proof hasn't been used (replay protection)

### "Sui transaction failed"
- Check testnet SUI balance: `sui client gas`
- Request faucet: `sui client faucet`
- Verify package ID in `.env.local`

### "Honk verifier stack overflow"
- Compile with `FOUNDRY_PROFILE=honk` (no `via_ir`)
- HonkVerifier lives in `contracts/evm/src-honk/`

### Insufficient gas (Sui)
- `sui client faucet`

### ZK circuit not found
- `nargo compile` in circuit dir

---

## 10. Production Roadmap

### Current State

SpinChain has a working ride engine: BLE telemetry, 3D visualization, AI coaching (rule-based + LLM), ZK proof rewards, Walrus-anchored telemetry, on-chain class contracts, Supabase-backed persistence (pending provisioning), instructor-rider loop, and personalized onboarding flow. Codebase is clean (0 TS errors, 1 lint warning, 132 tests passing, CI green).

**What's done**: Phases 0–3 complete, real ZK batch claims on Fuji, all 8 EVM contracts deployed + verified, Sui package v2 on testnet, Walrus persistence, ride history/analytics/badges, gym registry + calibration, ghost racing.

**What's missing for users**: Vercel redeploy (live build is stale), Supabase provisioning on Vercel, browser-level E2E tests, testnet soft-launch validation.

### Scale Risks (Must Fix Before Features)

| Risk | Severity | Detail |
|------|----------|--------|
| localStorage as primary store | **High** | Ride history, profile, panel state, analytics — all in localStorage. 200-ride cap is arbitrary. Data lost on browser clear. |
| Mocked instructor analytics | **High** | `attendanceRate: 0.85`, `repeatRiderRate: 0.35` — hardcoded |
| No backend | **High** | API routes exist for AI but no persistent backend for rider-instructor relationships |
| No auth | Medium | Wallet address is the only identity. No sessions, no access control |

### Pre-Launch Checklist

- [ ] **Redeploy Vercel from HEAD** — live site ships broken Noir import (`@noir-lang/backend_barretenberg`), causes `[NoirProver] Initialization failed` for every ride start
- [ ] **Provision Supabase** — create project, run `app/lib/supabase/schema.sql`, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` on Vercel
- [ ] **Verify `NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG` stays unset on Vercel** (defaults to off; `.env.local` has it true for dev)
- [ ] **Browser-level E2E tests** — wallet connect → class join → ride → ZK proof → claim; Supabase auth (nonce → sign → JWT); API routes
- [ ] **Testnet soft-launch validation** — real users through the full loop on Fuji + Sui testnet
- [ ] Chainlink CRE — blocked on Early Access approval (ZK path is independent, not a blocker)
- [ ] Rive rider asset — export `rider.riv` per `public/rive/README.md`
- [ ] Load testing — pending testnet deployment
- [ ] Security audit — pre-mainnet

### Mainnet Migration Path (post-testnet)

- [ ] Publish `spinsession.move` package to Sui mainnet → update `NEXT_PUBLIC_SUI_PACKAGE_ID`
- [ ] Flip Walrus to mainnet: `NEXT_PUBLIC_WALRUS_NETWORK=mainnet`
- [ ] Deploy `IncentiveEngine.sol` + supporting contracts to Avalanche C-Chain mainnet → update all `NEXT_PUBLIC_*_ADDRESS` env vars
- [ ] Re-run the full claim flow end-to-end on mainnet (single + batched ZK proofs)
- [ ] Security audit of contracts before real-value deployment

### Session Log

#### 2026-08-17 — Launch-prep: production bug fixes + UI/UX pass

**Production bugs:**
- ✅ NoirProver init failure — root cause: Vercel build predates `bfa6d6c6e` (old `@noir-lang/backend_barretenberg` import). Current HEAD uses `@aztec/bb.js` UltraHonk. **Fix: redeploy Vercel from HEAD.**
- ✅ Walrus 400 spam — practice/demo classes carried fake blob IDs sent to aggregator 3×. `resolveRouteForMetadata` now skips fetch for `practice-*` / `demo-*` blob IDs.
- ✅ NaN tangent poisoning — `getTangentAt` can return NaN near closed curve's degenerate segments, permanently breaking camera follow lerp. Both paths now guard with `Number.isFinite`.

**Demo data out of production:**
- ✅ `DEMO_MODE` flag in `app/config.ts` driven by `NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG` (defaults to **off**)
- ✅ Curated fake classes no longer show when the chain has no classes
- ✅ Instructor live page: hardcoded metrics, benchmark, revenue, fake leaderboard all gated

**UI/UX polish:**
- ✅ `tabular-nums` on every live-updating number
- ✅ MetricCard value: `transition-all` → `transition-colors`
- ✅ Mobile compact HUD: tap now expands/collapses, swipe still cycles metric
- ✅ Landing page: mousemove gradient writes straight to DOM (no React re-renders)
- ✅ `<MotionConfig reducedMotion="user">` app-wide
- ✅ Ghost gap label bumped 7px → 9px

---

## 11. Current Product State

### Implemented or Partially Implemented

- Landing, rider, instructor, analytics, and route-builder screens
- Wallet connection and testnet-oriented contract configuration
- Guest/demo ride flows
- BLE/mobile scaffolding and simulator-oriented ride inputs
- Route visualization and themed ride cards
- Early AI endpoints and route-generation flows
- Noir effort-threshold circuit with real Barretenberg backend — browser-side ZK proof generation
- Chunked ZK reward claims that batch 60-second proofs into one `IncentiveEngine` submission

### Not Yet Launch-Ready

- Fully validated production-safe reward settlement (ZK batch claims verified on Fuji; browser-level E2E of the full claim loop still missing)
- Supabase backend provisioned — schema + client code complete, but no instance/env vars exist yet; persistence silently falls back to localStorage
- Live Vercel deployment is stale — ships the pre-UltraHonk bundle that fails Noir init; redeploy from HEAD
- SpinPack ERC-1155 contract is deployed on Fuji, but UI flows around it still carry "Preview" labels
- Finalized launch verification and operational monitoring
- Demo/mock content is now gated behind `NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG` (off by default)

### AI Integration

**Multi-Provider AI with Fallback Chain**: Venice AI (primary) → NVIDIA NIM / MiniMax-M3 (middle fallback) → Gemini 3.0 Flash (last resort, BYOK)

All providers handle: route generation, narrative creation, chat, coaching, and agent reasoning. Personality-aware coaching prompts (drill-sergeant, zen, data) across all providers.

### Key Features

- **Natural Language Route Generation** — "45-minute coastal climb with ocean views" returns GPX, elevation, story beats, 3D preview
- **Voice Input** — Web Speech API, hands-free
- **Real-Time AI Coaching** — Data-driven feedback, personality logic (drill sergeant pushes, zen master advises recovery, quant analyst fine-tunes resistance)
- **W'bal Physiological Modeling** — Anaerobic energy tracking, dynamic recovery, red zone protection
- **Virtual Shifting System** — 22-speed drivetrain simulated, keyboard/UI shifting, physics-based speed
- **Ghost Rider & TCX Export** — Historical/live data ghost pacer, industry standard export
- **Agent Reasoning** — AI instructors make explainable decisions, dynamic pricing, confidence-scored actions
- **Route Worlds (3D)** — WebGL rendering from GPX, theme support (Neon, Alpine, Mars), ghost riders, audio triggers, street view previews

### Privacy Features

- **Selective Disclosure** — ZK proofs reveal only `effortScore`, `zone`, `duration` — hide `maxHeartRate`, raw data
- **Privacy Policies** — HIGH (effort_score only), MEDIUM (+ duration, ranking), LOW (full disclosure)
- **Local Oracle** — Browser-based proof generation using real Noir circuit + Barretenberg WASM, 10-minute rolling telemetry buffer, no data leaves device without consent

---

*Last updated: 2026-08-17*