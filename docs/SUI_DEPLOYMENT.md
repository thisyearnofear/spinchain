# SpinChain: Sui Deployment Guide

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
