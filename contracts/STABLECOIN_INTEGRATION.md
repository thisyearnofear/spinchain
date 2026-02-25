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
- Uses Chainlink Functions for tamper-proof verification
- Proves effort without exposing raw health data
- Returns effort score (0-1000) for reward calculation

**Verification Flow**:
1. Rider completes class with BLE device telemetry
2. Encrypted data sent to Chainlink Functions
3. Oracle validates: "HR > threshold for X minutes"
4. Returns verified effort score
5. Rider claims SPIN rewards via `IncentiveEngine.submitChainlinkProof()`

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

### BiometricOracle.sol (NEW)
- Chainlink Functions client
- Encrypts telemetry data
- Verifies effort thresholds
- Returns effort scores for rewards

## Frontend Integration

### New Hooks

**`use-stablecoin-payment.ts`**:
- `approvePayment()` - Approve USDC/USDT spending
- `purchaseTicket()` - Buy with selected payment method
- `checkBalance()` - Verify sufficient funds
- Supports: native AVAX, USDC, USDT

**`use-chainlink-verification.ts`**:
- `requestVerification()` - Submit telemetry to Chainlink
- `claimRewards()` - Claim after verification completes
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

# Chainlink configuration
NEXT_PUBLIC_BIOMETRIC_ORACLE_ADDRESS=0x...
NEXT_PUBLIC_CHAINLINK_ROUTER=0x...
NEXT_PUBLIC_CHAINLINK_DON_ID=fun-avalanche-fuji-1
NEXT_PUBLIC_CHAINLINK_SUBSCRIPTION_ID=123

# Payment defaults
NEXT_PUBLIC_DEFAULT_PAYMENT_METHOD=usdc
NEXT_PUBLIC_DEFAULT_INSTRUCTOR_SHARE=8000
NEXT_PUBLIC_DEFAULT_PROTOCOL_FEE=2000
```

### Config Updates

**`app/config.ts`**:
- Added `PAYMENT_CONFIG` with defaults
- Added `CHAINLINK_CONFIG` for oracle
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
