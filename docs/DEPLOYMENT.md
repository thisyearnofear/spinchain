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

### Deployed Contracts (Fuji)

All 8 contracts are **verified** on [Snowtrace](https://testnet.snowtrace.io).
See `contracts/DEPLOY.md` for the full address table with explorer links.

| Contract | Address |
|----------|---------|
| `SpinToken` | `0xA2DA94dE3AB8a90D62A1b1897E0e96DBda0F494f` |
| `IncentiveEngine` | `0x8BF20C7fbc69cafd3144de3Bb30509A26F39FF3d` |
| `ClassFactory` | `0xc4B4A722b55610bFa1556506B87Cbfe7983961A7` |
| `TreasurySplitter` | `0xDd787C22A28aA709021860485AC1b95620B5AcE3` |
| `YellowSettlement` | `0x960bbE91899D8A1D62e894348B9fa8B6358d9182` |
| `MockUltraVerifier` | `0x202aEd029708F2e0540B63a4025Dcb2556F85ba1` |
| `EffortThresholdVerifier` | `0x783C36f6502052EC31971e75E20D0012910dbA91` |
| `BiometricOracle` | `0xE0021E77f52761A69F611530A481B2B9371993d8` |

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
| **Package ID** | `0xc42b32ab25566a6f43db001e6f2c2fd6b2ccc7232e2af3cfca0b9beca824d7dc` |
| **Deployer** | `0x9018a50508af247c8ef949a6fd6522fc0b7f6652a9d07a2b108d748728f7b73f` |

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

### ⚠️ Generating a Production Verifier (Known Limitation)

The Noir circuit compiles and tests correctly. However, generating an on-chain Solidity verifier is currently blocked:

- `bb` (Barretenberg CLI) 4.0.0-nightly generates **Honk** verifiers that exceed the EVM's 1024-slot stack depth limit
- The `evm-no-zk` target produces broken code (upstream bug)
- On testnet, `MockUltraVerifier` handles verification (accepts any proof)
- For mainnet, deploy with ZK disabled and use Chainlink/off-chain verification until the verifier issue is resolved

### Deploy (Testnet — uses MockUltraVerifier)
```bash
cd contracts/evm
forge create MockUltraVerifier --rpc-url https://api.avax-test.network/ext/bc/C/rpc --private-key $AVALANCHE_PRIVATE_KEY
forge create EffortThresholdVerifier --rpc-url https://api.avax-test.network/ext/bc/C/rpc --private-key $AVALANCHE_PRIVATE_KEY --constructor-args <MockUltraVerifier_Address>
```

Current caveats:
- The shared deploy script deploys `MockUltraVerifier` only when `ALLOW_MOCK_VERIFIER=true`
- The shared deploy script can safely disable ZK claims by leaving both `ULTRA_VERIFIER_ADDRESS` and `ALLOW_MOCK_VERIFIER` unset
- `IncentiveEngine` must be wired to `EffortThresholdVerifier`, not directly to the raw verifier
- Runtime config still contains placeholder values that must be replaced before launch
- The current Noir circuit only covers 60 seconds of data

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
# Required
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
VENICE_API_KEY=...

# Optional
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...

# Contracts (after deployment)
NEXT_PUBLIC_SUI_PACKAGE_ID=0x...
NEXT_PUBLIC_ULTRA_VERIFIER_ADDRESS=0x...
NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS=0x...
NEXT_PUBLIC_SPIN_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS=0x...
NEXT_PUBLIC_CLASS_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_TREASURY_SPLITTER_ADDRESS=0x...
NEXT_PUBLIC_YELLOW_SETTLEMENT_ADDRESS=0x...
NEXT_PUBLIC_BIOMETRIC_ORACLE_ADDRESS=0x...
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
sui client object 0xc42b32ab25566a6f43db001e6f2c2fd6b2ccc7232e2af3cfca0b9beca824d7dc
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
| Honk verifier stack overflow | See ZK Verifier section above — known upstream bug |

---

## Release Notes

- There is not yet a complete release pipeline for this app
- Treat CI and local verification as part of the launch work still in progress
- See `docs/PRODUCTION_ROADMAP.md` for the current blocker list

---

## Resources

- Avalanche: https://testnet.snowtrace.io
- Sui: https://suiscan.xyz/testnet
- Noir: https://noir-lang.org
- Capacitor: https://capacitorjs.com
