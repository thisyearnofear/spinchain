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

### Current Status (2026-10-04, verified)

- Testnet/pre-launch. Live at https://spinchain.vercel.app/ (application release `a3c7e37` live 2026-10-04). **Direction approved 2026-10-04: receipt-first** — progression is independent of any chain; optional settlement is a future phase. See `plans/wedge-contract-research.md`.
- Demo content gated behind `NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG` — off by default.
- Production verifier state (read-only `eth_call` preflight 2026-10-04): deployed `EffortThresholdVerifier` `0xBbc32cc3…c9dA4` **rejects real proofs** (revert `0xfa066593` — wrong public-input slice); underlying `HonkVerifier` `0xF2a33f6e…641B` accepts the committed fixture proof. Corrected wrapper exists locally, **not deployed**; no adapter/redeploy is the next step — `AchievementRedeemerV2` design (phase 4) comes first. Engine/wrapper owner: deployer `0x29FA…F1Cd` (~1.98 AVAX Fuji).
- Supabase `spinchain` (`avcihfixqlofvkpvwmiq`, us-east-2) ACTIVE_HEALTHY; **`ride_summaries.summary` column APPLIED 2026-10-04 — additive `jsonb` nullable migration (`app/lib/supabase/migrations/20261004_ride_summary.sql`), verified on the same project.**
- Phase-0 auth/ownership/CTA/Noir/receipt fixes and phase-1 public-write boundary + `RideReceiptV1` are live on prod (`a3c7e37`, deployed 2026-10-04) — 366 unit + Foundry real-verifier tests green locally.
- Missing for general users: phase-2 consent and recovery controls, legal review, and integrated real-device validation. Phase-1 public-write blocking is deployed; controlled production feedback is user-owned.

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

#### Deploy to Fuji — ARCHIVED (unapproved path)

> Broadcast commands below are historical reference only, not a current operator action. Any future deployment waits on the phase-4 `AchievementRedeemerV2` design gate and explicit operator approval; use operator-protected signing, never raw private-key CLI arguments.

**Option A (archived): Full deployment with real HonkVerifier**
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

**Option B (archived, dev only): Quick deployment with mock verifier**
```bash
cd contracts/evm
export AVALANCHE_PRIVATE_KEY=your_deployer_key
export ALLOW_MOCK_VERIFIER=true
forge script src/deploy.s.sol:DeployScript --rpc-url https://api.avax-test.network/ext/bc/C/rpc --broadcast -vvvv
```

#### Deployed Contracts (Fuji — legacy experiment deployment, 2026-06-22)

| Contract | Address | Status |
|----------|---------|--------|
| `SpinPack` (ERC-1155) | `0x2C8443584daFA864Caa967cBDD7ec3D17157618B` | legacy experiment |
| `SpinToken` (ERC-20) | `0x4c0E965B809452F2C914a74d1D0e9C3375543392` | legacy experiment |
| `IncentiveEngine` | `0x69800d3ABda003b7aA6038831715a4aCb736403d` | legacy experiment |
| `ClassFactory` | `0x035026f85CCbC273160669FBe9Ba5Dc147D0Bd9b` | legacy experiment |
| `HonkVerifier` (real ZK) | `0xF2a33f6e9a5e935Db5d682E226A7e1a0249A641B` | verifies committed fixture proofs (confirmed 2026-10-04) |
| `EffortThresholdVerifier` | `0xBbc32cc3b8AF9BaeD8D77E3bf4fC69141b0c9dA4` | **broken** — wrong public-input slice, reverts on real proofs (checked by `contracts/evm/test/EffortThresholdVerifierFujiTripwire.t.sol`; `FUJI_RPC_URL=… pnpm test:contracts` also re-reads the chain) |
| `TreasurySplitter` | `0x00a1e5688AF26c724155BfEe100fF23d387850AB` | legacy experiment |
| `BiometricOracle` | `0x038fca8A26F9065f12F831C0600f30d8C90AFCFD` | placeholder forwarder; CRE not adopted |

> These are testnet experiment contracts from the pre-redesign architecture. They are not a launch surface: the corrected wrapper is not deployed, and settlement redesign (`AchievementRedeemerV2`, phase 4) supersedes repairing them. Do not treat these addresses as the live claim path.

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

> The on-chain capability exists, but app-side ride telemetry/anchor writes are disabled in the live phase-1 build — the package is a legacy experiment surface, not a launch dependency.

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

Create a Supabase project, run `app/lib/supabase/schema.sql`, then set (Dashboard: Settings > API Keys — new keys, not legacy):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SESSION_SECRET` (own random: `openssl rand -hex 32`; signs wallet fallback tokens)

Without these, persistence/auth silently fall back to localStorage.

### Deployment Storage Rules

SpinChain is heavy on purpose (in-browser UltraHonk + Three/Rive). Deployment Storage on Vercel is **retained build output × number of deployments**. Hobby keeps the latest 10 production deployments forever; every extra deploy multiplies cost.

**Rules (do not break):**

1. **ZK proving is browser-only.** Never import `@aztec/bb.js`, `@noir-lang/noir_js`, or `app/lib/zk/noir-prover` from API routes, Server Components, server actions, or Node scripts that run on Vercel. Load via dynamic `import()` behind a `window` check (see `app/lib/zk/noir-prover.ts`).
2. **Do not put Noir/bb into serverless Functions.** `next.config.ts` uses `outputFileTracingExcludes` so native `bb.js/build/**` and related paths cannot land in lambdas. If you add a server import by mistake, fix the import — do not “fix” it by bundling natives.
3. **Prefer Preview over Production.** Ship work-in-progress on Preview URLs. Promote to Production when you intentionally want a new live alias. Avoid rapid `--prod` / push-to-main spam.
4. **Batch before promoting.** Multiple commits → one production deploy when possible. Aim for **≤ a few production deploys per day**, not dozens.
5. **Keep rollback history short.** Retention is already 30 days (Hobby max). Periodically prune old Preview and non-aliased Production deployments; keep roughly the latest **10 production** + a handful of Preview. Live aliases (`spinchain.vercel.app`) must stay.
6. **Do not grow `public/` with large media.** Prefer remote/CDN (e.g. Blob) for big videos/archives. Circuit JSON in `public/circuits/` stays small; Rive WASM (~1.8 MB) is expected.
7. **Exclude non-app trees from upload.** `.vercelignore` must keep `contracts/`, circuit sources, Rive sources, mobile, and reports out of the deploy upload/cache noise.
8. **Accept the client ZK payload.** Browser Barretenberg (~8 MB) + Noir WASM (~3 MB) are product cost of in-browser proving. Do not move proving to a Vercel Function to “save” static size — that would blow Functions Storage and cold starts.

**Expected size profile (order of magnitude):**

| Piece | Approx | Where it lives |
|---|---|---|
| Barretenberg (bb.js browser) | ~8 MB | Client static chunks |
| Noir WASM | ~3 MB | Client static |
| Three / R3F | ~1–2 MB | Client chunks |
| `public/` (Rive WASM, GLBs, images) | ~5 MB | Static assets |
| `@aztec/bb.js` native `build/` | ~126 MB | **Must never** ship to Functions |

**When Usage → Deployment Storage spikes for `spinchain`:**

1. Check deploy count (`vercel ls spinchain`) — prune old Preview / non-aliased Production first.
2. Open a recent deployment → Resources — confirm no `@aztec/bb.js/build` in Functions.
3. Only then change app code (lazy Three routes, defer prover init until first claim).

**Agent / contributor checklist before merging deploy-touching changes:**

- [ ] No new server-side imports of Noir/bb
- [ ] Large new assets justified or offloaded from `public/`
- [ ] Production deploy is intentional (not every WIP push)
- [ ] Tracing excludes still cover `node_modules/@aztec/bb.js/build/**`

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

### Gas Benchmark Results (historical — mock verifier)

The legacy `ZKGasBenchmark` test measures `MockVerifier` stub costs, not Honk verification — it does not establish real-verifier gas performance. Prior per-chunk tables, durations, and savings percentages are removed; no performance claim is made. A real-verifier benchmark is a phase-5 task.
---

## 8. Security

### Pre-Commit Hook

Blocks accidental secret commits.

**What It Blocks:**
- Private keys (Sui `suiprivkey1...`, ETH 64-char hex)
- API keys (Google `AIza...`, GitHub `ghp_...`, AWS `AKIA...`)
- High-entropy `KEY=`, `SECRET=`, `TOKEN=` patterns
- `.env.local`, `.env.production`, `.env.development`

Do not bypass the hook — fix the flagged content instead.

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

SpinChain has a working ride engine: BLE telemetry, 3D visualization, AI coaching (rule-based + LLM), Walrus-anchored telemetry, on-chain class contracts, Supabase-backed persistence, instructor-rider loop, personalized onboarding. Direction as of 2026-10-04: **receipt-first** — see `plans/wedge-contract-research.md` and `docs/IMPLEMENTATION-PLAN.md` phase list.

**What's done**: phases 0–4 of the old wedge plan; local hardening (auth, ownership, CTA, Noir compat, receipt status) and phase-1 public-write boundary + `RideReceiptV1` verified locally (366 tests, clean typecheck/build) — **deployed 2026-10-04 as application release `a3c7e37`**. The Fuji contracts above are legacy experiments — **claims are not approved**: the deployed wrapper rejects real proofs and the app-side legacy-claim gate exists locally (prod env flag `false`).

**What's missing for users**: phase-2 consent transfer controls (outbox, third-party AI/voice/instructor consents, `source-attested` provenance); phase-3 provider/provenance interface; phase-4 `AchievementRedeemerV2` redeemer design; phase-5 real-verifier benchmarks + operator-approved testnet deployment; legal/policy review. User browser/real-device feedback on the live phase-1 build is pending.

### Scale Risks (Must Fix Before Features)

| Risk | Severity | Detail |
|------|----------|--------|
| localStorage as primary store | **High** | Ride history, profile, panel state, analytics — all in localStorage. 200-ride cap is arbitrary. Data lost on browser clear. |
| Mocked instructor analytics | **High** | `attendanceRate: 0.85`, `repeatRiderRate: 0.35` — hardcoded |
| No durable account layer | **High** | Supabase project provisioned, but durable account relationships, outbox, and recoverable jobs are absent (phase 2) |
| Personal-data privacy and consent | **High** | Phase 1 blocks the covered Walrus, Sui, relay, and live-telemetry publishing paths. Third-party AI/voice consent controls remain planned; localStorage is device-local and NOT encrypted. |
| No auth (historical) | Medium | Session-bound wallet auth deployed in `a3c7e37`; live prod enforces signed sessions |

### Pre-Launch Checklist

- [x] **Redeploy Vercel from HEAD** (2026-10-03, historical committed tree — not the current uncommitted work); CLI deploys remain the path
- [x] **Phase 1 privacy boundary** — deployed 2026-10-04 (`a3c7e37`): no public personal-data writes; local durable `RideReceiptV1`
- [x] **`ride_summaries.summary` migration** applied to production Supabase 2026-10-04 (additive, nullable `jsonb`)
- [ ] **Phase 2 consent controls** — separate consents for cloud history / third-party AI / voice / instructor live view / public export
- [x] **Fix Vercel env names** — canonical `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and `GEMINI_API_KEY` added to production 2026-10-04 (values copied from the legacy cloud vars; legacy names preserved); code reads `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and `GEMINI_API_KEY`
- [ ] **Phase 3–5** — verification-provider interface/pilot, `AchievementRedeemerV2` design+tests, real-verifier benchmarks, operator-approved testnet deploy
- [ ] **Legal/policy review** — Apple 3.1.1/5.1, EDPB, jurisdictional review for any tradable reward; no health claims without validation
- [ ] Load testing — pending testnet deployment
- [ ] Security audit — pre-mainnet

### Production dogfooding checklist (integrated testnet loop — user runs)

- [ ] Ride completes → completion saved locally with `RideReceiptV1` before any background work
- [ ] History shows the ride with honest status (`progress saved`; no implied verification/redemption)
- [ ] Sign in before a second ride → that wallet-owned ride saves to the private account; no public write observed. Earlier guest rides remain device-local and are not automatically reassigned.
- [ ] Reload/other device while signed into the same wallet → wallet-owned history recovers via the private account path (not legacy public blobs)
- [ ] No automatic proof generation on stop; no raw-sample fabrication
- [ ] (Future claim path — phase 5 only): signed receipt → redeemer → `redemption confirmed`, distinct from progression

### Mainnet (not part of this release)

The former multi-chain mainnet migration checklist is retired. Do not publish personal telemetry or redeploy `IncentiveEngine` as a mainnet launch path. Any real-value release requires a separately approved V2 redeemer specification, source-authentication and consent controls, a contract security audit, jurisdictional review, and successful operator-approved testnet validation.

### Session Log

#### 2026-10-04 — Phase 1 deployed (22:27 UTC)

**Live application release:** source commit `a3c7e37` (pushed to `main`, confirmed on remote) → Vercel auto-production deployment `dpl_2QeCERr5wTsFhcGgnz8Ltsz7fjh3` (`https://spinchain-n4juosoou-papas-projects-5b188431.vercel.app`), created 2026-10-04T22:27:37Z, READY, `target=production`, `meta.githubCommitSha` = `a3c7e37`. Alias `https://spinchain.vercel.app` confirmed pointing at this deployment; `/` and `/rider` return 200.

**Live now:** phase-0 session-bound wallet auth, owner-scoped ride persistence, CTA-by-address routing, Noir beta.22 compat, receipt-status fixes + phase-1 public personal-data write boundary (`isPersonalDataPublicationAllowed()` hard-false) and durable `RideReceiptV1`. Legacy reward claims flag `false`; chain defaults Fuji 43113; no contract changes or broadcasts. The corrected Fuji wrapper remains undeployed (superseded by the phase-4 `AchievementRedeemerV2` design). Instructor live telemetry sharing is intentionally disabled until phase-2 consent/authorization. Existing third-party AI/voice paths may still receive biometric context; their consent controls are not implemented, so this release is not privacy-compliance certified. Legacy public Walrus blobs remain publicly readable (no erasure promise).

**Still planned (not in this release):** phase-2 consent/outbox/recoverable jobs, `source-attested` provenance, V2 receipt/redeemer. No general-user launch or privacy-compliance claim.

**Verification carried over:** 366 unit / 42 files, clean typecheck, isolated production build, ESLint 0 errors / 7 warnings (pre-deploy gate); 4/4 real-Honk Foundry tests and 14/14 wallet-auth tests re-passed after the prefixless fixture format change (byte-identical proof data). Pre-commit hook passed normally. `SESSION_SECRET`/`SUPABASE_SECRET_KEY` are `sensitive`-type vars: `vercel env pull`/`run` return empty by design — configured, not missing; auth fails closed. Signup/signature pipeline is user-verified pending, not claimed tested.

**Remaining checks are user-owned on live:** guest ride → record in history → reload; sign in before a second ride → wallet-owned private save → reload on another device with the same wallet. No monetary claim (legacy flag off).

#### 2026-10-04 — Phase 1 release prepared (commit/deploy pending)

**Migration:** `ride_summaries.summary` additive `jsonb` nullable column applied to production Supabase (`avcihfixqlofvkpvwmiq`) — verified present post-apply. No tables dropped, no data deleted; no other migrations run.

**Production env (names only — no values recorded):**
- `NEXT_PUBLIC_ENABLE_LEGACY_REWARD_CLAIMS=false` added to Production.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` added, copied from the existing cloud `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` (legacy var preserved).
- `GEMINI_API_KEY` added, copied from `GOOGLE_GENERATIVE_AI_API_KEY` (legacy var preserved).
- `SESSION_SECRET` is configured in production; value length unverifiable via `vercel env run` (it injects empty for it, same as the known-working `SUPABASE_SECRET_KEY`) — flagged, not replaced.
- `NEXT_PUBLIC_AVALANCHE_CHAIN_ID` unset → code default 43113 (Fuji). No Preview/Development changes.

**Invariants in this release:** legacy reward claims flag off; public personal-data publication hard-denied in code (`isPersonalDataPublicationAllowed()` — no env override); no contract redeploys, no chain migrations, no broadcast transactions.

**Local verification:** 366 unit tests / 42 files pass; `tsc --noEmit` clean; production build green under isolated env; ESLint 0 errors (7 warnings). Individual desktop/mobile spec evidence exists from standalone runs, but the final combined run was interrupted — remaining browser checks are delegated to the user on production after deployment.

**User manual checklist on the deployed build:** complete a guest ride → record appears in local history → reload → sign in before a second ride → confirm that wallet-owned ride syncs to the private account → reload on another device using the same wallet. Guest records remain device-local; repeat completion must not duplicate or reassign them. No monetary claim; a V1 receipt is an unverified record, not a future V2 certificate.

**Status (historical):** staging/commit/push were pending at the time of this entry — superseded by the deployment record above (`a3c7e37`, deployed 22:27 UTC the same day).

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

- Live value-bearing claims — the deployed Fuji wrapper is broken and the redeemer is unbuilt; claims stay off until phases 4–5
- Granular consent, recovery jobs, and encryption/retention controls remain unfinished; the phase-1 public publishing boundary is deployed.
- Consent transfer controls for third-party AI/TTS biometric context (phase 2); no "privacy-ready" claim before then
- `ride_summaries.summary` migration applied 2026-10-04 — canonical summary roundtrip enabled server-side (client shipped in `a3c7e37`)
- Browser-level E2E covers wedge/auth paths; the integrated production dogfood loop is a phase-5 user task
- Legal/policy review (Apple 3.1.1/5.1, EDPB, reward jurisdiction) outstanding

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

- **ZK proofs** reveal only three public outputs (`threshold_met`, `seconds_above`, `effort_score`); class/rider/threshold/min-duration are attached metadata, not proven inputs. ZK is an optional future privacy layer over issuer-bound commitments — not trustless physical-effort verification.
- **Boundary status**: public personal-data publication is disabled in the live phase-1 build (`a3c7e37`) and granular third-party/AI consent lands in phase 2. Until consent ships and deploys, do not claim privacy-ready. localStorage is device-local and not encrypted; legacy public blobs remain readable (migration-only, owner-scoped).
- **Provenance classes**: `simulated` / `device-observed` / `estimated` on `RideReceiptV1`; `source-attested` is reserved and cannot be client-declared. FTMS is a transport protocol, not attestation.

---

*Last updated: 2026-10-04*