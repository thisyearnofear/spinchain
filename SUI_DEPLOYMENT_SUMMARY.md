# Sui Deployment Summary

## What You're Deploying

### Package: `spinchain::spinsession`

This Move module provides high-frequency telemetry storage for SpinChain:

**Structs:**
- `Session` - Represents a live fitness class (shared object)
- `RiderStats` - Per-rider telemetry data (owned object)

**Functions:**
- `create_session` - Instructor creates a new session
- `join_session` - Rider joins and gets their stats object
- `update_telemetry` - Submit HR, power, cadence data
- `trigger_beat` - AI instructor triggers story beats

**Events:**
- `TelemetryPoint` - Emitted on every telemetry update
- `StoryBeatTriggered` - Emitted when story beats fire

## Deployment Steps (Run These)

### 1. Install Sui CLI
```bash
brew install sui
# Verify: sui --version
```

### 2. Create Wallet
```bash
sui client new-address ed25519
```
**Save the output address - this is your `SUI_WALLET_ADDRESS`**

### 3. Setup Testnet
```bash
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet
```

### 4. Get Testnet SUI
```bash
sui client faucet
# Wait 30 seconds, then check:
sui client gas
```

### 5. Build Package
```bash
cd /Users/udingethe/Dev/spinchain/move/spinchain
sui move build
```

### 6. Deploy
```bash
sui client publish --gas-budget 100000000
```

**From the output, save:**
- `Package ID` → `NEXT_PUBLIC_SUI_PACKAGE_ID`
- Your wallet address → `SUI_WALLET_ADDRESS`

### 7. Update Environment
```bash
cp .env.local.template .env.local
# Edit .env.local and fill in:
# - SUI_WALLET_ADDRESS
# - SUI_PRIVATE_KEY (from sui keytool export)
# - NEXT_PUBLIC_SUI_PACKAGE_ID
```

## Private Key Export (for backend use)

```bash
# Export your private key (keep secure!)
sui keytool export --key-identity 0xYOUR_ADDRESS

# Or get from keystore file:
cat ~/.sui/sui_config/sui.keystore
```

## Verification

After deployment, verify the package:
```bash
sui client object 0xYOUR_PACKAGE_ID
```

## Integration Points

The frontend expects these environment variables:
- `NEXT_PUBLIC_SUI_PACKAGE_ID` - For calling contract functions
- `SUI_WALLET_ADDRESS` - For instructor session creation
- `SUI_PRIVATE_KEY` - For backend telemetry submission (if needed)

## Architecture

```
EVM (Avalanche)          Sui (Testnet)
├─ SpinClass NFT    ←──→ ├─ Session (shared)
├─ Ticket purchase       ├─ RiderStats (per-rider)
├─ SPIN rewards          ├─ Telemetry events
└─ ZK verification       └─ Story beat events
```

Sui handles high-frequency data cheaply, EVM handles value/assets.
