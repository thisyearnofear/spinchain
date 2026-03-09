# SpinChain: Deployment Guide

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
NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS=0x...
NEXT_PUBLIC_SPIN_TOKEN_ADDRESS=0x...
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

## CI/CD

- `zk-verifier.yml` - Auto-generates ZK verifier
- `test.yml` - Forge tests on PR
- `lint.yml` - TypeScript + Solidity linting
- Pre-commit hook blocks secret commits

---

## Resources

- Avalanche: https://testnet.snowtrace.io
- Sui: https://suiscan.xyz/testnet
- Noir: https://noir-lang.org
- Capacitor: https://capacitorjs.com
