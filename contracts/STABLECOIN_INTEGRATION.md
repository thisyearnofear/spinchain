# Stablecoin Payment & Chainlink Oracle Integration

## Overview

SpinChain now supports stablecoin payments (USDT/USDC) for class tickets with sustainable instructor economics and Chainlink-verified biometric data.

## Key Features Implemented

### 1. Stablecoin Payments (USDT/USDC)

**Contract**: `SpinClass.sol`

- Riders pay in USDC/USDT instead of volatile AVAX
- Automatic revenue split: 70-90% to instructor, 10-30% protocol fee
- Supports both human and AI agent instructors
- Backward compatible with native AVAX payments

**New Functions**:
- `purchaseTicketStable(uint256 amount)` - Buy ticket with stablecoin
- `withdrawInstructorRevenue()` - Instructor claims their share
- `withdrawProtocolFees()` - Protocol claims fee share

### 2. Instructor Revenue Model

**Revenue Split**:
- Instructor: 70-90% (configurable via `instructorShareBps`)
- Protocol: 10-30% (remainder)
- Default: 80% instructor / 20% protocol

**AI Agent Support**:
- AI agents receive same revenue split as human instructors
- Payments sent directly to agent wallet address
- No distinction between human/AI at contract level

### 3. Chainlink Oracle Integration

**Contract**: `BiometricOracle.sol`

- Verifies off-chain biometric data (heart rate, power, cadence)
- Uses **Chainlink Runtime Environment (CRE)** for decentralized orchestration
- Proves effort without exposing raw health data via **Confidential HTTP**
- Returns effort score (0-1000) for reward calculation with BFT consensus

**Verification Flow**:
1. Rider completes class; biometric data is available via Wearable API
2. Rider calls `BiometricOracle.requestVerification(classId, threshold, duration)`
3. Chainlink DON detects the `VerificationRequested` event (EVM Trigger)
4. CRE Workflow fetches telemetry via **Confidential HTTP** (Privacy-Preserving)
5. DON nodes reach consensus on effort score off-chain
6. CRE Forwarder submits verified report to `BiometricOracle.fulfillCREReport()`
7. Rider claims SPIN rewards via `IncentiveEngine.submitChainlinkProof()`

### 4. Enhanced IncentiveEngine

**New Verification Methods**:
- ZK Proofs (existing)
- Signed Attestations (existing)
- **Chainlink Oracle** (new) - `submitChainlinkProof(classId)`

**Benefits**:
- Tamper-proof biometric verification
- No centralized trust required
- DeFi composability (collateralize workout NFTs)
- Sponsor integration ready

## Contract Changes

### SpinClass.sol
- Added `paymentToken` (USDC/USDT address)
- Added `instructor` (separate from owner)
- Added `instructorShareBps` (7000-9000)
- Added `instructorBalance` and `protocolBalance` tracking
- Added `purchaseTicketStable()` function
- Added `withdrawInstructorRevenue()` function
- Added `withdrawProtocolFees()` function
- Enhanced `TicketInfo` struct with `paidInStable` flag

### ClassFactory.sol
- Updated `createClass()` with new parameters:
  - `instructor` - wallet receiving revenue
  - `paymentToken` - USDC/USDT address
  - `instructorShareBps` - revenue split

### IncentiveEngine.sol
- Added `biometricOracle` integration
- Added `submitChainlinkProof()` function
- Added `chainlinkClaimsUsed` mapping (prevent double claims)
- Added `setBiometricOracle()` admin function

### BiometricOracle.sol (UPDATED)
- Chainlink Runtime Environment (CRE) workflow
- Confidential HTTP telemetry fetching
- Verifies effort thresholds off-chain
- Returns effort scores for rewards with BFT consensus

## Frontend Integration

### New Hooks

**`use-stablecoin-payment.ts`**:
- `approvePayment()` - Approve USDC/USDT spending
- `purchaseTicket()` - Buy with selected payment method
- `checkBalance()` - Verify sufficient funds
- Supports: native AVAX, USDC, USDT

**`use-chainlink-verification.ts`**:
- `requestVerification()` - Trigger CRE workflow detection
- `claimRewards()` - Claim after CRE workflow fulfills result
- `checkVerificationStatus()` - Poll for results

### Updated Hooks

**`use-create-class.ts`**:
- Added `instructor` parameter
- Added `paymentToken` parameter (optional)
- Added `instructorShareBps` parameter (optional)
- Auto-detects decimals (6 for USDC, 18 for AVAX)

## Configuration

### Environment Variables

```env
# Stablecoin addresses
NEXT_PUBLIC_USDC_ADDRESS=0x5425890298aed601595a70AB815c96711a31Bc65
NEXT_PUBLIC_USDT_ADDRESS=0x...

# Chainlink Runtime Environment (CRE) Configuration
NEXT_PUBLIC_BIOMETRIC_ORACLE_ADDRESS=0x...
NEXT_PUBLIC_CHAINLINK_FORWARDER=0x...
NEXT_PUBLIC_CHAINLINK_WORKFLOW_ID=0x...
WEARABLE_API_KEY=your_key_here
```

### Config Updates

**`app/config.ts`**:
- Added `PAYMENT_CONFIG` with defaults
- Added `CHAINLINK_CONFIG` (Forwarder, WorkflowID)
- Added stablecoin addresses to `CONTRACTS`

## Usage Examples

### Create Class with Stablecoin Payment

```typescript
import { useCreateClass } from '@/app/hooks/evm/use-create-class';
import { CONTRACTS } from '@/app/config';

const { createClass } = useCreateClass();

createClass({
  name: "Morning Burn",
  symbol: "SPIN1",
  metadata: { /* ... */ },
  startTime: Date.now() + 3600,
  endTime: Date.now() + 7200,
  maxRiders: 20,
  basePrice: "10", // 10 USDC
  maxPrice: "50", // 50 USDC
  instructor: "0xAIAgentWallet...", // AI agent or human
  treasury: "0xProtocolTreasury...",
  incentiveEngine: CONTRACTS.avalanche.incentiveEngine,
  spinToken: CONTRACTS.avalanche.spinToken,
  paymentToken: CONTRACTS.avalanche.usdc, // USDC payment
  instructorShareBps: 8000, // 80% to instructor
});
```

### Purchase Ticket with USDC

```typescript
import { useStablecoinPayment } from '@/app/hooks/evm/use-stablecoin-payment';

const { approvePayment, purchaseTicket } = useStablecoinPayment();

// Step 1: Approve USDC spending
await approvePayment(classAddress, amount, "usdc");

// Step 2: Purchase ticket
await purchaseTicket({
  classAddress,
  amount: BigInt(10 * 1e6), // 10 USDC
  paymentMethod: "usdc",
});
```

### Verify Biometrics with Chainlink

```typescript
import { useChainlinkVerification } from '@/app/hooks/evm/use-chainlink-verification';

const { requestVerification, claimRewards } = useChainlinkVerification();

// Step 1: Submit telemetry for verification
await requestVerification({
  classId: "0x...",
  telemetryData: rideSession.telemetry,
  threshold: 150, // HR > 150 bpm
  duration: 20, // for 20 minutes
});

// Step 2: Wait for Chainlink callback (poll or listen to events)

// Step 3: Claim rewards
await claimRewards(classId);
```

### Instructor Withdraws Revenue

```typescript
// In SpinClass contract
await spinClass.withdrawInstructorRevenue();
// Sends 80% of ticket sales to instructor wallet (human or AI)
```

## Testing

### Deploy Mock USDC (Testnet)

```solidity
// contracts/evm/MockUSDC.sol
contract MockUSDC is ERC20 {
  function faucet() external {
    _mint(msg.sender, 1000 * 10**6); // 1000 USDC
  }
}
```

### Test Flow

1. Deploy MockUSDC
2. Call `faucet()` to get test USDC
3. Create class with USDC payment
4. Approve USDC spending
5. Purchase ticket with USDC
6. Complete ride with BLE telemetry
7. Request Chainlink verification
8. Claim SPIN rewards
9. Instructor withdraws USDC revenue

## Security Considerations

1. **Reentrancy Protection**: All payment functions use `nonReentrant`
2. **SafeERC20**: Uses OpenZeppelin's SafeERC20 for token transfers
3. **Revenue Tracking**: Separate balances prevent accounting errors
4. **Instructor Share Limits**: 70-90% enforced at contract level
5. **Chainlink Security**: Encrypted telemetry, tamper-proof verification

## Future Enhancements

1. **Agora Integration**: Social discovery for classes
2. **Kite AI**: Personalized intensity scoring
3. **LI.FI Integration**: Treasury swaps (USDC → SPIN buyback)
4. **Sponsor Pools**: Brand-funded reward pools
5. **DeFi Composability**: Collateralize workout NFTs

## Migration Path

Existing classes using native AVAX continue to work. New classes can opt into stablecoin payments by setting `paymentToken` parameter.

No breaking changes to existing functionality.
