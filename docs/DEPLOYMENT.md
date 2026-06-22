# SpinChain: Deployment Guide

This document describes the current deployment shape of the repo.

Important:
- This project is still in testnet/pre-launch state
- The default runtime targets Avalanche Fuji and Sui testnet
- Some deployment paths still reference mock or placeholder components
- Do not use this file as proof that the app is ready for public launch

## Smart Contracts (Avalanche)

### Prerequisites
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Deploy to Fuji Testnet

**Option A: Full deployment with real HonkVerifier**
```bash
cd contracts/evm
export AVALANCHE_PRIVATE_KEY=your_deployer_key

# 1. Compile and generate HonkVerifier from Noir circuit
nargo compile  # in circuits/effort_threshold/
BB=$(find node_modules -path '*@aztec/bb.js*dest/node/bin/index.js' | head -1)
node $BB write_vk -b circuits/effort_threshold/target/effort_threshold.json -o circuits/effort_threshold/target/vk_evm -t evm
node $BB write_solidity_verifier -k circuits/effort_threshold/target/vk_evm/vk -o contracts/evm/src-honk/HonkVerifier.sol -t evm

# 2. Deploy HonkVerifier (must use honk profile — no via_ir)
FOUNDRY_PROFILE=honk forge create src-honk/HonkVerifier.sol:HonkVerifier \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --private-key $AVALANCHE_PRIVATE_KEY --broadcast

# 3. Deploy remaining contracts with HonkVerifier address
export ULTRA_VERIFIER_ADDRESS=<deployed_honkverifier_address>
forge script src/deploy.s.sol:DeployScript \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast \
  -vvvv
```

**Option B: Quick deployment with mock verifier (for testing only)**
```bash
cd contracts/evm
export AVALANCHE_PRIVATE_KEY=your_deployer_key
export ALLOW_MOCK_VERIFIER=true

forge script src/deploy.s.sol:DeployScript \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast \
  -vvvv
```

### Verify on Snowtrace

```bash
export SNOWTRACE_API_KEY=your_api_key
forge script src/deploy.s.sol:DeployScript \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast --verify \
  -vvvv
```

See `contracts/DEPLOY.md` for detailed per-contract verification commands.

### Deployed Contracts (Fuji — 2026-06-22)

All contracts deployed and verified on [Snowtrace](https://testnet.snowtrace.io).

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

> The `HonkVerifier` is a real UltraHonk Solidity verifier generated from the Noir circuit via `bb.js 5.0.0-rc.1`. ZK proofs are cryptographically verified on-chain — no mock.

> `YellowSettlement` was consolidated into `IncentiveEngine` as `submitChannelProof` / `batchSubmitChannelProof`. The address above for `IncentiveEngine` is the canonical settlement target.

---

## Sui Package (Testnet)

### Setup
```bash
# Install CLI
brew install sui

# Create wallet
sui client new-address ed25519

# Configure testnet
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet

# Get testnet SUI
sui client faucet
```

### Deploy
```bash
cd move/spinchain
sui move build
sui client publish --gas-budget 100000000
```

**Save:** Package ID → `NEXT_PUBLIC_SUI_PACKAGE_ID`

### Current Deployment
| Field | Value |
|-------|-------|
| **Package ID** | `0x51542d1d4b43763d58e6f91f845f63157d5fc59bd95ead54dc370b0898d1185c` |
| **Version** | 2 (upgraded — includes `TelemetryAnchor`, `anchor_telemetry_blob`, `spin_token` module) |
| **Deployer** | `0x9018a50508af247c8ef949a6fd6522fc0b7f6652a9d07a2b108d748728f7b73f` |
| **Upgrade Tx** | `350668558` |
| **Upgrade Cap** | `0x146219a29eb67a17fbcc52d580857a399aa20a06eee235570a3beace14752f75` |

---

## ZK Verifier (Noir)

### Setup
```bash
curl -L https://noirup.dev | bash
noirup
```

### Compile & Test Circuit
```bash
cd circuits/effort_threshold
nargo compile
nargo test
```

### Generating the Real Solidity Verifier

The Noir circuit compiles and generates a real UltraHonk Solidity verifier using `bb.js 5.0.0-rc.1`:

```bash
# In circuits/effort_threshold/
nargo compile

# Generate VK and Solidity verifier
BB=$(find node_modules -path '*@aztec/bb.js*dest/node/bin/index.js' | head -1)
node $BB write_vk -b target/effort_threshold.json -o target/vk_evm -t evm
node $BB write_solidity_verifier -k target/vk_evm/vk -o ../../contracts/evm/src-honk/HonkVerifier.sol -t evm
```

**Note:** `HonkVerifier.sol` must be compiled without `via_ir` (it triggers a stack-too-deep error). It lives in `contracts/evm/src-honk/` and is compiled via `FOUNDRY_PROFILE=honk`. The rest of the contracts use `via_ir = true` in the default profile.

### ZK Verification Flow (Real)
1. Browser generates real Noir proof via `@noir-lang/noir_js` + `backend_barretenberg`
2. Proof submitted on-chain to `EffortThresholdVerifier`
3. `EffortThresholdVerifier` calls `HonkVerifier.verify()` — real cryptographic verification
4. If valid, `IncentiveEngine` distributes SPIN token rewards

---

## Frontend Deployment

### Vercel
```bash
pnpm add -g vercel
vercel
vercel --prod
```

### Environment Variables
```env
# Required (at least one AI provider)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
VENICE_API_KEY=...

# Optional AI providers (fallback chain: Venice → NVIDIA → Gemini)
NVIDIA_API_KEY=...
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...

# Sui (deployed on testnet — package v2)
NEXT_PUBLIC_SUI_PACKAGE_ID=0x51542d1d4b43763d58e6f91f845f63157d5fc59bd95ead54dc370b0898d1185c

# EVM Contracts (all deployed to Avalanche Fuji — 2026-06-22)
NEXT_PUBLIC_SPIN_PACK_ADDRESS=0x2C8443584daFA864Caa967cBDD7ec3D17157618B
NEXT_PUBLIC_SPIN_TOKEN_ADDRESS=0x4c0E965B809452F2C914a74d1D0e9C3375543392
NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS=0x69800d3ABda003b7aA6038831715a4aCb736403d
NEXT_PUBLIC_CLASS_FACTORY_ADDRESS=0x035026f85CCbC273160669FBe9Ba5Dc147D0Bd9b
NEXT_PUBLIC_ULTRA_VERIFIER_ADDRESS=0xF2a33f6e9a5e935Db5d682E226A7e1a0249A641B
NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS=0xBbc32cc3b8AF9BaeD8D77E3bf4fC69141b0c9dA4
NEXT_PUBLIC_TREASURY_SPLITTER_ADDRESS=0x00a1e5688AF26c724155BfEe100fF23d387850AB
NEXT_PUBLIC_BIOMETRIC_ORACLE_ADDRESS=0x038fca8A26F9065f12F831C0600f30d8C90AFCFD
NEXT_PUBLIC_REWARD_VERIFICATION_MODE=zk
# Channel settlement is now on IncentiveEngine (submitChannelProof) — no separate YellowSettlement env var.
```

---

## Mobile App Deployment

### Capacitor Setup
```bash
npx cap init
npx cap add ios
npx cap add android
pnpm add @capacitor-community/bluetooth-le
```

### Build
```bash
pnpm run build
npx cap sync
npx cap open ios    # Xcode
npx cap open android # Android Studio
```

### iOS/Android Config
Already configured in `Info.plist` and `AndroidManifest.xml` with Bluetooth permissions.

---

## Testing

Minimum release expectation:
- `npm run build` completes successfully
- `npm run lint` completes successfully
- Contract/testnet flows are verified against the active config
- User-facing rider/instructor flows do not silently fall back to mock data
- Reward settlement state and ride-summary anchoring state are reported separately in app storage and UI

### Verify Contracts
```bash
# Avalanche — all 8 contracts verified on Snowtrace
# See https://testnet.snowtrace.io for verification status

# Sui
sui client object 0x51542d1d4b43763d58e6f91f845f63157d5fc59bd95ead54dc370b0898d1185c
```

### Test ZK Flow
```bash
# Noir circuit tests
cd circuits/effort_threshold
nargo test

# Foundry contract tests (single-proof + batch ZK claims)
cd contracts/evm
forge test -vvv
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Insufficient gas (Sui) | `sui client faucet` |
| ZK circuit not found | `nargo compile` in circuit dir |
| BLE not connecting | Check permissions, pairing mode |
| Contract not verified | See `contracts/DEPLOY.md` for verification commands |
| Honk verifier stack overflow | Compile with `FOUNDRY_PROFILE=honk` (no via_ir) — HonkVerifier is in `src-honk/` |

---

## Release Notes

- There is not yet a complete release pipeline for this app
- Treat CI and local verification as part of the launch work still in progress
- See `docs/PRODUCTION_ROADMAP.md` for the current blocker list

## Hackathon Submissions

The deployment posture above is also the submission posture for the Sui Overflow 2026 (Walrus Track) and Tatum × Walrus hackathons. Both submissions target testnet and use the existing Walrus client (`app/lib/walrus/`) and Sui Move package (`contracts/move/spinchain/`) as deployed today. Tatum's Sui RPC is consumed by a single-file URL swap in `app/sui-provider.tsx` — no parallel Sui client, no new SDK, no architecture deviation. See `docs/HACKATHON_PLAN.md` for the file-level change list, phasing, and mainnet-readiness criteria required to unlock the 100% prize payout.

---

## Resources

- Avalanche: https://testnet.snowtrace.io
- Sui: https://suiscan.xyz/testnet
- Noir: https://noir-lang.org
- Capacitor: https://capacitorjs.com
