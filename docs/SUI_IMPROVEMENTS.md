# SpinChain Sui Integration: Improvements Roadmap

## Current Status (April 2025)

✅ **Completed:**
- Move contract deployed with all core functions
- Frontend hooks for session management and telemetry
- Transaction handling with toast notifications
- Environment variables documented

## Required Environment Variables

### For Native Agents to Work

| Variable | Required | Purpose | Where to Get |
|----------|----------|---------|--------------|
| `VENICE_API_KEY` | **Yes** | Real-time coach reasoning | https://venice.ai/api |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional | Route generation fallback | https://aistudio.google.com |
| `NEXT_PUBLIC_NOIR_VERIFIER_ADDRESS` | Optional | ZK proof verification | Deploy EffortThresholdVerifier.sol |

**Without VENICE_API_KEY:** Agents fall back to Gemini but may have higher latency.

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
