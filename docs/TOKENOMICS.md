# SPIN Tokenomics (Option B)

## Overview
Independent SPIN tokens on AVAX and Sui. Same name, same purpose, isolated supplies. No bridging.

## Supply
- **AVAX SPIN**: 50M max (18 decimals)
- **Sui SPIN**: 50M max (9 decimals)
- **Total**: 100M SPIN across both chains

## The SpinCycle
Every class payment triggers:
1. 15% diverted to SPIN buyback
2. 80% of bought SPIN → Rewards pool
3. 20% of bought SPIN → Burned permanently

## Tier Benefits

| Tier | SPIN Required | Reward Bonus | Class Discount |
|------|--------------|--------------|----------------|
| Bronze | 100 | +5% | 5% |
| Silver | 500 | +10% | 10% |
| Gold | 2,000 | +18% | 18% |
| Diamond | 10,000 | +25% | 25% |

## LI.FI Integration
- **Used for**: Treasury swaps (USDC→SPIN buyback)
- **NOT used for**: SPIN bridging (independent tokens by design)

## Deployment (Remix)

### 1. Deploy TieredRewards.sol (Library)
No constructor. Used by other contracts.

### 2. Deploy SpinToken.sol
```solidity
constructor(address owner_)
// Example: deployer address as owner
```

### 3. Deploy IncentiveEngine.sol
```solidity
constructor(
    address owner_,      // deployer
    address token_,      // SpinToken address
    address signer_,     // attestation signer (can be deployer initially)
    address verifier_    // ZK verifier (can be address(0) initially)
)
```

### 4. Deploy SpinClass.sol
```solidity
constructor(
    address owner_,          // deployer
    string memory name_,     // "SpinClass"
    string memory symbol_,   // "SPINCLASS"
    string memory classMetadata_,  // IPFS CID or URI
    uint256 startTime_,      // unix timestamp
    uint256 endTime_,        // unix timestamp
    uint256 maxRiders_,      // e.g., 50
    uint256 basePrice_,      // in wei (e.g., 0.01 AVAX = 10000000000000000)
    uint256 maxPrice_,       // in wei
    address treasury_,       // treasury address
    address incentiveEngine_, // IncentiveEngine address
    address spinToken_       // SpinToken address
)
```

### 5. Configuration
```solidity
// Transfer token ownership to IncentiveEngine
SpinToken.transferOwnership(IncentiveEngine_address)

// Set attestation signer (if different from deployer)
IncentiveEngine.setAttestationSigner(signer_address)

// Set ZK verifier (when ready)
IncentiveEngine.setVerifier(verifier_address)
```

## Key Functions

### Check User Tier
```solidity
// Get tier for any address
IncentiveEngine.getUserTier(userAddress) 
// Returns: 0=None, 1=Bronze, 2=Silver, 3=Gold, 4=Diamond
```

### Get Discounted Price
```solidity
// Get price for specific user
SpinClass.priceForUser(userAddress)
// Returns: (basePrice, discountedPrice, tier)
```

### Buy Ticket with Discount
```solidity
// Send discounted ETH/AVAX value
SpinClass.purchaseTicket{value: discountedPrice}()
```

### Record Buyback Burn (Treasury)
```solidity
// After LI.FI swap USDC->SPIN
SpinToken.recordBuybackBurn(spinAmountAcquired)
// Automatically burns 20%, emits event for 80% rewards
```

## Events

```solidity
// Tier reward boost applied
TierRewardBoost(address rider, uint8 tier, uint256 baseAmount, uint256 boostedAmount)

// Discount applied at purchase
TierDiscountApplied(address rider, uint8 tier, uint256 originalPrice, uint256 discountedPrice)

// Buyback burn completed
BuybackBurned(uint256 buybackAmount, uint256 burnedAmount, uint256 rewardAmount)
```

## Sui Deployment

### 1. Publish Package
```bash
cd move/spinchain
sui client publish --gas-budget 100000000
```

### 2. Get TreasuryCap ID
From publish output, note:
- `TreasuryCap<SPIN_TOKEN>` object ID
- `TreasuryManager` object ID

### 3. Mint Rewards
```move
spin_token::mint_reward(
    treasury_cap,      // &mut TreasuryCap<SPIN_TOKEN>
    treasury_manager,  // &mut TreasuryManager
    amount,            // u64 (9 decimals)
    recipient,         // address
    reason,            // String
    session_id,        // address
    ctx
)
```

### 4. Record Buyback Burn
```move
spin_token::record_buyback_burn(
    treasury_cap,
    treasury_manager,
    buyback_coins,     // Coin<SPIN_TOKEN>
    ctx
)
```

### 5. Check Tier
```move
tier_benefits::get_tier(spin_balance)  // returns Tier enum
```

## File Structure

```
contracts/
├── SpinToken.sol          # ERC-20 with buyback burn
├── TieredRewards.sol      # Tier library
├── IncentiveEngine.sol    # Rewards + tiers
├── SpinClass.sol          # NFT + discounts
└── TreasurySplitter.sol   # Revenue split

move/spinchain/sources/
├── spin_token.move        # Coin with TreasuryManager
├── tier_benefits.move     # Tier calculations
└── spinsession.move       # Session management
```
