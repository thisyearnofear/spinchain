# SpinChain: SUI Integration

## SUI Deployment Guide

### Prerequisites

Install Sui CLI:
```bash
# macOS
brew install sui

# Or via cargo
cargo install --locked sui

# Verify installation
sui --version
```

### Step 1: Create Wallet

```bash
# Create new wallet (ed25519 is recommended)
sui client new-address ed25519

# You'll see output like:
# Created new keypair for address: 0x1234567890abcdef...
# Secret Recovery Phrase: [WRITE THIS DOWN]
```

Save the address and secret phrase securely.

### Step 2: Switch to Testnet

```bash
# Add testnet environment
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443

# Switch to testnet
sui client switch --env testnet

# Verify
sui client active-env
```

### Step 3: Get Testnet SUI

```bash
# Request from faucet
sui client faucet

# Check balance (should show 1-2 SUI coins)
sui client gas
```

### Step 4: Build the Package

```bash
cd /Users/udingethe/Dev/spinchain/move/spinchain

# Build
sui move build

# If successful, you'll see:
# BUILDING spinchain
# COMPILING spinsession
# SUCCESS
```

### Step 5: Deploy

```bash
# Deploy with sufficient gas budget
sui client publish --gas-budget 100000000
```

You'll see output like:
```
Transaction Effects: {
  "status": { "status": "success" },
  "created": [
    {
      "owner": "Immutable",
      "reference": {
        "objectId": "0xPACKAGE_ID_HERE",
        "version": 1,
        "digest": "..."
      }
    }
  ]
}
```

**Save the Package ID!**

### Step 6: Create a Session (Test)

```bash
# Create a test session
sui client call \
  --package 0xYOUR_PACKAGE_ID \
  --module spinsession \
  --function create_session \
  --args \
    "0xCLASS_ID_FROM_EVM" \
    3600 \
  --gas-budget 10000000
```

### Environment Variables

After deployment, add these to your `.env.local`:

```env
# Sui Wallet (your deployed wallet)
SUI_WALLET_ADDRESS=0xYOUR_WALLET_ADDRESS
SUI_PRIVATE_KEY=your_private_key_here

# Deployed Package
NEXT_PUBLIC_SUI_PACKAGE_ID=0xYOUR_PACKAGE_ID

# Example Session Object (created after first session)
NEXT_PUBLIC_SUI_EXAMPLE_SESSION_ID=0xSESSION_OBJECT_ID
```

### Frontend Integration

The frontend already has `@mysten/dapp-kit` configured. Update `app/sui-provider.tsx` with your package ID.

### Troubleshooting

#### "Insufficient gas"
Request more from faucet: `sui client faucet`

#### "Package not found"
Make sure you're on testnet: `sui client active-env`

#### "Move build failed"
Check Move.toml dependencies are correct.

### Security Notes

- Never commit private keys to git
- Use `.env.local` for sensitive data (already in .gitignore)
- Testnet SUI has no real value, but mainnet will

---

## Sui Deployment Summary

### What You're Deploying

#### Package: `spinchain::spinsession`

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

### Deployment Steps (Run These)

#### 1. Install Sui CLI
```bash
brew install sui
# Verify: sui --version
```

#### 2. Create Wallet
```bash
sui client new-address ed25519
```
**Save the output address - this is your `SUI_WALLET_ADDRESS`**

#### 3. Setup Testnet
```bash
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet
```

#### 4. Get Testnet SUI
```bash
sui client faucet
# Wait 30 seconds, then check:
sui client gas
```

#### 5. Build Package
```bash
cd /Users/udingethe/Dev/spinchain/move/spinchain
sui move build
```

#### 6. Deploy
```bash
sui client publish --gas-budget 100000000
```

**From the output, save:**
- `Package ID` → `NEXT_PUBLIC_SUI_PACKAGE_ID`
- Your wallet address → `SUI_WALLET_ADDRESS`

#### 7. Update Environment
```bash
cp .env.local.template .env.local
# Edit .env.local and fill in:
# - SUI_WALLET_ADDRESS
# - SUI_PRIVATE_KEY (from sui keytool export)
# - NEXT_PUBLIC_SUI_PACKAGE_ID
```

### Private Key Export (for backend use)

```bash
# Export your private key (keep secure!)
sui keytool export --key-identity 0xYOUR_ADDRESS

# Or get from keystore file:
cat ~/.sui/sui_config/sui.keystore
```

### Verification

After deployment, verify the package:
```bash
sui client object 0xYOUR_PACKAGE_ID
```

### Integration Points

The frontend expects these environment variables:
- `NEXT_PUBLIC_SUI_PACKAGE_ID` - For calling contract functions
- `SUI_WALLET_ADDRESS` - For instructor session creation
- `SUI_PRIVATE_KEY` - For backend telemetry submission (if needed)

### Architecture

```
EVM (Avalanche)          Sui (Testnet)
├─ SpinClass NFT    ←──→ ├─ Session (shared)
├─ Ticket purchase       ├─ RiderStats (per-rider)
├─ SPIN rewards          ├─ Telemetry events
└─ ZK verification       └─ Story beat events
```

Sui handles high-frequency data cheaply, EVM handles value/assets.

---

## Current Deployment (Updated: 2025-04-02)

### Deployed Contract

| Field | Value |
|-------|-------|
| **Package ID** | `0xc42b32ab25566a6f43db001e6f2c2fd6b2ccc7232e2af3cfca0b9beca824d7dc` |
| **Network** | Sui Testnet |
| **Transaction Digest** | `Fghc9m4KWCTfCcDNaBeyePFmgkrENVNwKQRCyuNyDaFL` |
| **Upgrade Cap** | `0xcff6455acdb37fd96e9d9f93f93fe31c545cb9ef6e59dda21447471348429161` |
| **Deployer** | `0x9018a50508af247c8ef949a6fd6522fc0b7f6652a9d07a2b108d748728f7b73f` |

### What's Deployed

The `spinsession` Move module provides:

**Structs:**
- `Session` - Live fitness class session (shared object)
- `Coach` - AI instructor with personality & strategy config
- `RiderStats` - Per-rider telemetry data (owned object)

**Entry Functions:**
- `create_coach` - Deploy AI instructor with guardrails
- `update_strategy` - Modify coach boundaries
- `update_cognitive_layer` - Update AI model & prompt CID
- `create_session` - Initialize performance layer for a class
- `join_session` - Rider joins and gets stats object
- `update_telemetry` - Submit HR, power, cadence data
- `trigger_beat` - AI triggers story beats
- `update_coach_state` - Adjust tempo/resistance
- `close_session` - End a session

**Events:**
- `TelemetryPoint` - Every telemetry update
- `StoryBeatTriggered` - Story beat fired
- `EnvironmentChanged` - Coach state changed
- `StrategyUpdated` - Coach config updated
- `SessionCreated` - New session initialized
- `RiderJoined` - Rider joined session

---

## Frontend Integration

### Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUI_PACKAGE_ID=0xc42b32ab25566a6f43db001e6f2c2fd6b2ccc7232e2af3cfca0b9beca824d7dc
SUI_WALLET_ADDRESS=0x9018a50508af247c8ef949a6fd6522fc0b7f6652a9d07a2b108d748728f7b73f
```

### Available Hooks

```typescript
// Session lifecycle management
const { createSession, joinSession, closeSession } = useSuiSession();

// Telemetry updates
const { updateTelemetry, triggerBeat } = useSuiTelemetry(sessionId, statsId);

// AI Coach deployment
const { mutate: signAndExecute } = useSignAndExecuteTransaction();
```

### Usage Example

```typescript
// Instructor: Create session
const sessionId = await createSession(evmClassId, 3600); // 1 hour

// Rider: Join session
const statsId = await joinSession(sessionId);

// During ride: Update telemetry
await updateTelemetry(145, 250, 85); // HR, Power, Cadence

// AI: Trigger story beat
await triggerBeat("Final Sprint!", "sprint", 9);
```

---

## Manual Testing

### Create a Coach

```bash
sui client call \
  --package 0xc42b32ab25566a6f43db001e6f2c2fd6b2ccc7232e2af3cfca0b9beca824d7dc \
  --module spinsession \
  --function create_coach \
  --args \
    "Coach Atlas" \
    1 \
    60 \
    180 \
    80 \
    1 \
    "gemini::flash" \
    "ipfs://QmDefaultPrompt" \
  --gas-budget 10000000
```

### Create a Session

```bash
sui client call \
  --package 0xc42b32ab25566a6f43db001e6f2c2fd6b2ccc7232e2af3cfca0b9beca824d7dc \
  --module spinsession \
  --function create_session \
  --args \
    "0xCLASS_ID_FROM_EVM" \
    3600 \
  --gas-budget 10000000
```

### Join Session

```bash
sui client call \
  --package 0xc42b32ab25566a6f43db001e6f2c2fd6b2ccc7232e2af3cfca0b9beca824d7dc \
  --module spinsession \
  --function join_session \
  --args \
    "0xSESSION_OBJECT_ID" \
  --gas-budget 10000000
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SPINCHAIN                                 │
├─────────────────────────────────────────────────────────────────┤
│  EVM (Avalanche)          │  Sui (Testnet)                      │
│  ├─ SpinClass NFT         │  ├─ Session (shared)                │
│  ├─ Ticket purchase       │  ├─ RiderStats (owned)              │
│  ├─ SPIN rewards          │  ├─ Coach (shared)                  │
│  └─ ZK verification       │  ├─ Telemetry events                │
│                           │  └─ Story beat events               │
└─────────────────────────────────────────────────────────────────┘
                    ↓ High-frequency telemetry
              Sui: 10Hz updates, ~480ms finality
                    ↓ ZK Proof generation
              EVM: Reward distribution, verification
```

---

## Deployment Steps (For Future Updates)

1. **Build:**
   ```bash
   cd move/spinchain
   sui move build
   ```

2. **Remove old Published.toml (if incompatible changes):**
   ```bash
   rm Published.toml
   ```

3. **Publish:**
   ```bash
   sui client publish --gas-budget 100000000
   ```

4. **Update configs:**
   - `.env.local`: `NEXT_PUBLIC_SUI_PACKAGE_ID`
   - `app/config.ts`: `SUI_CONFIG.packageId`
   - This doc: All Package ID references

---

## Resources

- **Suiscan Explorer:** https://suiscan.xyz/testnet
- **Sui Docs:** https://docs.sui.io
- **Package on Suiscan:** https://suiscan.xyz/testnet/object/0xc42b32ab25566a6f43db001e6f2c2fd6b2ccc7232e2af3cfca0b9beca824d7dc

---

## Recommended Improvements

### 1. Sponsored Transactions (High Impact)

**Problem:** New users need SUI tokens to join sessions.

**Solution:** Use Sui's gas station for gasless onboarding.

```typescript
// app/hooks/use-sui-session.ts enhancement
const sponsorTransaction = async (tx: Transaction) => {
  if (SUI_CONFIG.gasStationUrl) {
    // Submit to gas station for sponsorship
    const sponsored = await fetch(SUI_CONFIG.gasStationUrl, {
      method: 'POST',
      body: JSON.stringify({ txBytes: tx.serialize() }),
    });
    return sponsored;
  }
  // Fallback to user-paid
  return execute(tx);
};
```

**Benefits:**
- Zero friction onboarding
- Users don't need to buy SUI first
- Sponsor controls which transactions are free

### 2. Batch Telemetry Submissions (High Impact)

**Problem:** 10Hz telemetry = 10 transactions/second = expensive.

**Solution:** Buffer locally, submit batches every 5 seconds.

```typescript
// app/hooks/use-sui-telemetry.ts enhancement
const telemetryBuffer: TelemetryUpdate[] = [];

const queueTelemetry = (update: TelemetryUpdate) => {
  telemetryBuffer.push(update);
  if (telemetryBuffer.length >= 50) {
    submitBatch([...telemetryBuffer]);
    telemetryBuffer.length = 0;
  }
};

const submitBatch = async (batch: TelemetryUpdate[]) => {
  const tx = new Transaction();
  batch.forEach((update, i) => {
    tx.moveCall({
      target: `${SUI_CONFIG.packageId}::spinsession::update_telemetry`,
      arguments: [/* ... */],
    });
  });
  await execute(tx);
};
```

**Benefits:**
- 80% gas cost reduction
- Fewer network requests
- Better UX (async submission)

### 3. Sui-Native SPIN Token (High Impact)

**Problem:** Sui-only users can't earn rewards without EVM.

**Solution:** Create SPIN Coin on Sui with bridge to EVM.

```move
// move/spinchain/sources/spin_token.move
module spinchain::spin_token {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;

    struct SPIN has drop {}

    fun init(witness: SPIN, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness, 9, b"SPIN", b"SpinChain Token",
            b"Fitness rewards token", option::none(), ctx
        );
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury, tx_context::sender(ctx));
    }

    public entry fun mint_reward(
        treasury: &mut TreasuryCap<SPIN>,
        amount: u64,
        rider: address,
        ctx: &mut TxContext
    ) {
        let coins = coin::mint(treasury, amount, ctx);
        transfer::public_transfer(coins, rider);
    }
}
```

**Benefits:**
- Sui-only users can earn
- Lower gas than EVM transfers
- Cross-chain bridge enables unified economy

### 4. Real-Time Event Subscriptions (Medium Impact)

**Problem:** Frontend polls for updates.

**Solution:** WebSocket subscriptions to Sui events.

```typescript
// app/hooks/use-sui-events.ts
export function useSuiEvents(sessionId: string) {
  const [events, setEvents] = useState<SuiEvent[]>([]);

  useEffect(() => {
    const unsubscribe = client.subscribeEvent({
      filter: {
        MoveEventModule: {
          package: SUI_CONFIG.packageId,
          module: 'spinsession',
        },
      },
      onMessage: (event) => {
        if (event.parsedJson?.session_id === sessionId) {
          setEvents(prev => [...prev, event]);
        }
      },
    });

    return () => unsubscribe();
  }, [sessionId]);

  return events;
}
```

**Benefits:**
- Instant live updates
- Reduced server load
- Better race experience

### 5. Sui-Only Mode (Medium Impact)

**Problem:** Users without EVM wallets can't participate.

**Solution:** Allow SUI payments and Sui-native profiles.

**Implementation:**
- Add `sui_only` flag to classes
- Accept SUI for ticket payments
- Store instructor profiles as Sui objects
- Use Walrus for route storage

**Benefits:**
- Broader user base
- Lower barriers to entry
- Sui-native UX

### 6. Multi-Agent Support (Low Impact)

**Problem:** Only one coach per session.

**Solution:** Allow multiple AI agents with different roles.

```move
struct Session has key, store {
    // ... existing fields
    coaches: vector<ID>, // Multiple coaches
    primary_coach: u64, // Index of lead coach
}
```

**Benefits:**
- Specialist coaches (climbs, sprints, recovery)
- Rotating personalities during session
- More engaging experience

### 7. Transaction Retry & History (Low Impact)

**Problem:** Failed transactions are lost.

**Solution:** Queue and retry with history.

```typescript
interface PendingTransaction {
  id: string;
  tx: Transaction;
  retries: number;
  timestamp: number;
}

const pendingQueue: PendingTransaction[] = [];

const executeWithRetry = async (pending: PendingTransaction) => {
  try {
    await execute(pending.tx);
    // Move to history
    transactionHistory.unshift({ ...pending, status: 'success' });
  } catch (error) {
    if (pending.retries < 3) {
      pending.retries++;
      setTimeout(() => executeWithRetry(pending), 5000);
    } else {
      transactionHistory.unshift({ ...pending, status: 'failed', error });
    }
  }
};
```

**Benefits:**
- Reliable telemetry submission
- Audit trail for users
- Debugging visibility

---

## Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P0 | VENICE_API_KEY setup | 5 min | Critical |
| P1 | Sponsored Transactions | 1 day | High |
| P1 | Batch Telemetry | 4 hours | High |
| P2 | Event Subscriptions | 1 day | Medium |
| P2 | Sui-Native SPIN | 2 days | High |
| P3 | Sui-Only Mode | 3 days | Medium |
| P3 | Multi-Agent | 1 day | Low |
| P3 | Transaction Retry | 4 hours | Low |

---

## Quick Wins (Do Today)

1. **Set VENICE_API_KEY** in `.env.local`
2. **Test native agents** via `/agent` page
3. **Enable sponsored transactions** (uncomment gas station URL)
4. **Add batch telemetry** (50-point buffer)

## Questions?

- Venice AI: https://venice.ai/docs
- Sui Gas Station: https://docs.sui.io/concepts/transactions/sponsored-transactions
- Sui Events: https://docs.sui.io/build/event-query