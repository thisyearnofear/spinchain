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

## Deployment

> See [`contracts/DEPLOY.md`](../contracts/DEPLOY.md) for the full Foundry-based deployment guide.

### Deployed Contracts — Fuji Testnet (chain 43113)

| Contract            | Address                                        |
|---------------------|------------------------------------------------|
| `SpinToken`         | `0xbd73026ECe5c9D44D4f31a96B6d2d3ca9981a4eA`  |
| `IncentiveEngine`   | `0xA0CCbF6F940685e2495a5FE6F13820f32Db68EDC`  |
| `ClassFactory`      | `0x7B9283Fb889e6033e6d0fbe3E96D0C5734DC932a`  |
| `TreasurySplitter`  | `0x9AB33e974Dbb6D9a11C5116Ce2E2e04471c482A0`  |
| `YellowSettlement`  | `0xc6A203fB3a02F3F6886233B9b3b7A148CD3fedbe`  |
| `MockUltraVerifier` | `0x5f98A8018f75ca80F46DE9758157AED719589dEC`  |

`SpinToken` ownership is held by `IncentiveEngine` (minting is gated to reward distribution only).

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
