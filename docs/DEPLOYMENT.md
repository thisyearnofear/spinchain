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
export PRIVATE_KEY=your_deployer_key

forge script script/Deploy.s.sol \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast --verify \
  --etherscan-api-key <snowtrace_api_key>
```

### Deployed Contracts (Fuji)

Treat these as testnet deployment references, not final production addresses.

| Contract | Address |
|----------|---------|
| `SpinToken` | `0xbd73026ECe5c9D44D4f31a96B6d2d3ca9981a4eA` |
| `IncentiveEngine` | `0xA0CCbF6F940685e2495a5FE6F13820f32Db68EDC` |
| `ClassFactory` | `0x7B9283Fb889e6033e6d0fbe3E96D0C5734DC932a` |
| `TreasurySplitter` | `0x9AB33e974Dbb6D9a11C5116Ce2E2e04471c482A0` |

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

### Compile & Generate Verifier
```bash
cd circuits/effort_threshold
nargo compile
nargo test

# CI auto-generates UltraVerifier.sol on push to main
# Or manually:
nargo codegen-verifier
```

### Deploy
```bash
cd contracts/evm
forge create UltraVerifier --rpc-url https://api.avax-test.network/ext/bc/C/rpc --private-key $PRIVATE_KEY
forge create EffortThresholdVerifier --rpc-url https://api.avax-test.network/ext/bc/C/rpc --private-key $PRIVATE_KEY --constructor-args <UltraVerifier_Address>
```

Current caveats:
- The Fuji deploy script deploys `MockUltraVerifier` only when no `ULTRA_VERIFIER_ADDRESS` is configured
- `IncentiveEngine` must be wired to `EffortThresholdVerifier`, not directly to the raw `UltraVerifier`
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
```

Additional launch-critical values:
```env
NEXT_PUBLIC_BIOMETRIC_ORACLE_ADDRESS=0x...
NEXT_PUBLIC_CHAINLINK_FORWARDER=0x...
NEXT_PUBLIC_CHAINLINK_WORKFLOW_ID=0x...
NEXT_PUBLIC_TREASURY_SPLITTER_ADDRESS=0x...
NEXT_PUBLIC_YELLOW_SETTLEMENT_ADDRESS=0x...
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

### Verify Contracts
```bash
# Avalanche
forge verify-contract <address> SpinToken --chain-id 43113 --etherscan-api-key <key>

# Sui
sui client object 0xc42b32ab25566a6f43db001e6f2c2fd6b2ccc7232e2af3cfca0b9beca824d7dc
```

### Test ZK Flow
```bash
cd circuits/effort_threshold
nargo test
npx ts-node --esm scripts/e2e-live-loop.ts
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Insufficient gas (Sui) | `sui client faucet` |
| ZK circuit not found | `nargo compile` in circuit dir |
| BLE not connecting | Check permissions, pairing mode |
| Contract not verified | Match compiler version |

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
