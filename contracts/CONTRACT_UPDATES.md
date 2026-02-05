# SpinChain EVM Contract Updates

## Summary of Changes

All contracts have been enhanced following the Core Principles:
- **ENHANCEMENT FIRST**: Enhanced existing components rather than creating new ones
- **AGGRESSIVE CONSOLIDATION**: Removed deprecated patterns (string errors)
- **PREVENT BLOAT**: Minimal additions, focused on security
- **DRY**: Consistent patterns across all contracts
- **CLEAN**: Clear separation of concerns
- **MODULAR**: Pausable, ReentrancyGuard as composable modules
- **PERFORMANT**: Gas optimizations (packed structs, custom errors)
- **ORGANIZED**: Consistent file structure

---

## Contract-by-Contract Changes

### 1. SpinClass.sol

**Security Improvements:**
- ✅ Added `onlyOwner` to `settleRevenue()` - prevents unauthorized fund extraction
- ✅ Added class cancellation mechanism with `cancelClass()` and `claimRefund()`
- ✅ Added `Pausable` pattern for emergency stops
- ✅ Added transfer restrictions after class starts (anti-scalping)

**Gas Optimizations:**
- ✅ Replaced string errors with custom errors (saves ~50 gas per revert)
- ✅ Packed `Pricing` struct: `uint256` → `uint128` + `uint128` (saves 1 storage slot)
- ✅ Added `TicketInfo` struct to track purchase price for accurate refunds

**Features:**
- ✅ Exponential bonding curve pricing (price increases faster as capacity fills)
- ✅ Comprehensive events for off-chain indexing
- ✅ Purchase price tracking for fair refunds

**New Errors:**
```solidity
error InvalidTimeRange();
error InvalidMaxRiders();
error InvalidPriceRange();
error SalesClosed();
error SoldOut();
error InsufficientPayment();
error NotTicketOwner();
error TooEarly();
error ClassEnded();
error AlreadyCheckedIn();
error TreasuryNotSet();
error TransferFailed();
error ClassCancelled();
error ClassNotCancelled();
error AlreadyRefunded();
error NotRefundable();
error TransfersLocked();
```

**New Events:**
```solidity
event ClassCancelled(uint256 timestamp);
event TicketRefunded(address indexed rider, uint256 indexed tokenId, uint256 amount);
event TransferLocked(uint256 tokenId);
```

---

### 2. IncentiveEngine.sol

**Security Improvements:**
- ✅ Added daily mint limit (1M SPIN/day) to prevent infinite mint attacks
- ✅ Added attestation expiration (7 days) to prevent stale attestations
- ✅ Added `Pausable` and `ReentrancyGuard` for safety
- ✅ Integrated `EffortThresholdVerifier` for trustless ZK reward claims

**Features:**
- ✅ Dual reward paths: ECDSA attestation OR ZK proof
- ✅ Rate limiting per day, not per signer (more robust)
- ✅ `calculateReward()` function for dynamic rewards based on effort score

**New Functions:**
```solidity
function submitZKProof(bytes calldata proof, bytes32[] calldata publicInputs, uint256 rewardAmount) external
function calculateReward(uint16 effortScore) public pure returns (uint256)
function setVerifier(address verifier_) external onlyOwner
```

**New Errors:**
```solidity
error NotAttended();
error AttestationUsed();
error InvalidSignature();
error InvalidAmount();
error AttestationExpired();
error DailyLimitExceeded();
error InvalidProof();
error ThresholdNotMet();
```

**New Events:**
```solidity
event VerifierUpdated(address indexed verifier);
event ZKRewardClaimed(address indexed rider, bytes32 indexed classId, uint256 amount, uint16 effortScore);
```

---

### 3. TreasurySplitter.sol

**Security Improvements:**
- ✅ Added pull-over-push pattern option (configurable)
- ✅ Added `Pausable` for emergency stops
- ✅ Changed `Recipient.bps` from `uint256` to `uint96` (packs with address)

**Features:**
- ✅ Configurable distribution mode (push vs pull)
- ✅ `withdraw()` function for pull pattern
- ✅ `pendingWithdrawals` mapping for pull pattern tracking

**New Functions:**
```solidity
function withdraw() external nonReentrant
function setMode(bool usePullPattern_) external onlyOwner
```

**New Errors:**
```solidity
error LengthMismatch();
error NoRecipients();
error ZeroWallet();
error ZeroBps();
error BpsMustTotal10000();
error NoBalance();
error TransferFailed();
error NothingToWithdraw();
error InvalidMode();
```

**New Events:**
```solidity
event WithdrawalReady(address indexed to, uint256 amount);
event Withdrawn(address indexed to, uint256 amount);
event ModeChanged(bool usePullPattern);
```

**Constructor Change:**
```solidity
// Added usePullPattern_ parameter
constructor(address owner_, address[] memory wallets, uint256[] memory bps, bool usePullPattern_)
```

---

### 4. ClassFactory.sol

**Security Improvements:**
- ✅ Added input validation (time range, max riders, price range, treasury != 0)
- ✅ Added contract registry for verification
- ✅ Added `Ownable` for future upgradeability

**Features:**
- ✅ `isSpinClass` mapping for contract verification
- ✅ `classById` mapping for class lookup
- ✅ `classesByInstructor` mapping for instructor dashboard
- ✅ `allClasses` array for global listing
- ✅ Pagination support for class listing

**New Functions:**
```solidity
function getClassesByInstructor(address instructor) external view returns (address[] memory)
function getClassCount() external view returns (uint256)
function getClasses(uint256 offset, uint256 limit) external view returns (address[] memory)
function verifyClass(address classAddress) external view returns (bool)
```

**New Errors:**
```solidity
error InvalidTimeRange();
error InvalidMaxRiders();
error InvalidPriceRange();
error ZeroTreasury();
error ClassNotFound();
```

**Constructor Change:**
```solidity
// Now takes no parameters, uses msg.sender as owner
constructor() Ownable(msg.sender)
```

**createClass Parameter Change:**
```solidity
// Changed from uint256 to uint128 for gas optimization
uint256 basePrice, uint256 maxPrice  →  uint128 basePrice, uint128 maxPrice
```

---

### 5. SpinToken.sol

**Security Improvements:**
- ✅ Added input validation in `mint()` (zero address, zero amount)
- ✅ Added custom errors

**Features:**
- ✅ Added `ERC20Burnable` - users can burn their tokens
- ✅ Added `ERC20Permit` - gasless approvals via signatures
- ✅ Events for minting and burning

**New Errors:**
```solidity
error InvalidAmount();
error ZeroAddress();
```

**New Events:**
```solidity
event Minted(address indexed to, uint256 amount);
event Burned(address indexed from, uint256 amount);
```

---

### 6. EffortThresholdVerifier.sol

**Security Improvements:**
- ✅ Added `Pausable` for emergency circuit breaker
- ✅ Added `onlyAuthorized` modifier for access control
- ✅ Made `noirVerifier` upgradeable (not immutable)
- ✅ Added `authorizedCallers` mapping for fine-grained access

**Features:**
- ✅ Admin functions for upgrading verifier and managing authorized callers
- ✅ Consistent error handling with custom errors

**New Functions:**
```solidity
function setNoirVerifier(address _noirVerifier) external onlyOwner
function setAuthorizedCaller(address caller, bool authorized) external onlyOwner
```

**New Errors:**
```solidity
error UnauthorizedCaller();
error ArrayLengthMismatch();
```

---

### 7. DemandSurgeHook.sol

**Security Improvements:**
- ✅ Added `Ownable` for admin functions
- ✅ Added multi-agent support (`authorizedAgents` mapping)
- ✅ Added input validation in `updateClassState()`

**Features:**
- ✅ Multiple authorized agents (not just one)
- ✅ Refactored fee calculation into `_calculateFee()`
- ✅ Events for state updates

**New Functions:**
```solidity
function setAgentAuthorization(address agent, bool authorized) external onlyOwner
function setDefaultAgent(address agent) external onlyOwner
function _calculateFee(uint256 utilization, uint256 timeRemaining) internal pure returns (uint24)
```

**New Errors:**
```solidity
error InvalidTimeRange();
error InvalidCapacity();
```

**New Events:**
```solidity
event ClassStateUpdated(Currency indexed currency, uint128 totalTickets, uint128 ticketsSold, uint256 startTime);
event AgentUpdated(address indexed agent, bool authorized);
event DefaultAgentUpdated(address indexed agent);
```

---

## Deployment Order

1. **SpinToken** - Deploy with IncentiveEngine as owner
2. **EffortThresholdVerifier** - Deploy with UltraVerifier address
3. **IncentiveEngine** - Deploy with SpinToken, signer, and Verifier addresses
4. **TreasurySplitter** - Deploy with recipients and mode (push/pull)
5. **ClassFactory** - Deploy
6. **DemandSurgeHook** - Deploy with PoolManager and agent address

## Constructor Parameters Summary

| Contract | Parameters |
|----------|------------|
| SpinToken | `address owner_` |
| EffortThresholdVerifier | `address _noirVerifier` |
| IncentiveEngine | `address owner_, address token_, address signer_, address verifier_` |
| TreasurySplitter | `address owner_, address[] memory wallets, uint256[] memory bps, bool usePullPattern_` |
| ClassFactory | None (uses `msg.sender`) |
| DemandSurgeHook | `IPoolManager _poolManager, address _agent` |
| SpinClass | Via Factory: `owner, name, symbol, metadata, startTime, endTime, maxRiders, basePrice, maxPrice, treasury, incentiveEngine` |

---

## Gas Savings Summary

| Optimization | Estimated Savings |
|--------------|-------------------|
| Custom errors vs strings | ~50 gas per revert |
| Packed Pricing struct | 20,000 gas (1 slot) |
| Packed Recipient struct | 20,000 gas (1 slot) |
| Efficient array length caching | ~100 gas per loop |

---

## Security Checklist

- [x] Access control on sensitive functions
- [x] Reentrancy protection on external calls
- [x] Pausable pattern for emergency stops
- [x] Rate limiting on token minting
- [x] Input validation on all external functions
- [x] Refund mechanism for cancelled classes
- [x] Proof replay protection in verifier
- [x] Authorization system for verifier callers
- [x] Pull-over-push pattern option for treasury
- [x] Transfer restrictions for ticket NFTs
