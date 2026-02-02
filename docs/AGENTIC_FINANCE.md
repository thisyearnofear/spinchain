# Agentic Finance: The Uniswap v4 Integration

> **Thesis**: Fitness classes are perishable inventory. AI Agents using Uniswap v4 Hooks are superior to static pricing for managing this inventory.

## 1. The Core Primitive: SpinPacks (ERC-1155)

We treat every fitness course as a composable asset bundle called a **SpinPack**.

*   **Token ID 0 (The IP)**: The "Master" NFT. Ownership of the route data, music playlist, and effort logic. Held by the Creator (Human or AI).
*   **Token ID 1..N (The Access)**: Fungible tickets for specific scheduled slots (e.g., "Monday 9am").

**The Shift**: Instead of selling tickets via a static contract, the AI Agent creates a **Uniswap v4 Pool** for the `Access Token` vs. `$SPIN`.

---

## 2. The Innovation: Dynamic Demand Hooks

We propose a custom Uniswap v4 Hook: `DemandSurgeHook.sol`.

### The Problem
Static class pricing fails in two ways:
1.  **Underpricing**: Popular classes sell out instantly, leaving value on the table (scalpers win).
2.  **Overpricing**: Empty classes earn $0 because the price didn't adapt to low demand.

### The Agentic Solution
The AI Instructor attaches a Hook to its class liquidity pool that acts as an automated market maker with "inventory awareness."

#### Hook Logic:
1.  **BeforeSwap**:
    *   Check `block.timestamp` vs `classStartTime`.
    *   Check `pool.liquidity` (remaining tickets).
2.  **Fee Adjustment**:
    *   *Inventory Low + Time Near*: **Surge Mode**. Increase swap fee to 5-10%. The Agent captures premium demand.
    *   *Inventory High + Time Near*: **Fire Sale Mode**. Lower swap fee to 0.01% or even offer a *negative fee* (rebate) to fill the room.
3.  **AfterSwap**:
    *   If the user bought a ticket, automatically check if they hold a "Membership NFT" (SpinChain Pass). If yes, rebate a portion of the fee instantly.

---

## 3. The Agent Workflow

How "Coach Atlas" (our AI) actively manages liquidity:

1.  **Deployment**: Atlas deploys a `SpinPack` and initializes a V4 Pool (`Ticket / ETH`) with the `DemandSurgeHook`.
2.  **Liquidity Provisioning**: Atlas is the sole LP. It provides the initial 50 tickets into the pool range.
3.  **Monitoring**: Atlas runs an off-chain cron job (or Sui Agent) monitoring social sentiment.
4.  **Rebalancing**:
    *   If a route goes viral on Twitter, Atlas calls `poolManager.modifyPosition` to concentrate liquidity at a higher price range.
    *   This is **Agentic Finance**: The code acts on external signals to optimize yield.

---

## 4. Privacy DeFi Angle (Track 2)

We can combine this with our Privacy architecture:

*   **Dark Pools for VIPs**: High-net-worth riders or celebrities can swap for tickets in a private pool where the Hook verifies a ZK Proof of "Status" without revealing their address.
*   **Proof**: "I own a SpinPass > Level 50" (verified inside the Hook) -> Access granted to the VIP liquidity range.

---

## 5. Technical Implementation for HackMoney

### The `SpinHook` Contract
```solidity
// Pseudo-code for the Hackathon Hook
contract SpinHook is BaseHook {
    struct ClassState {
        uint256 startTime;
        uint256 capacity;
        uint256 sold;
    }
    
    mapping(PoolId => ClassState) public classes;

    function beforeSwap(...) override returns (...) {
        // 1. Calculate Time Decay
        uint256 timeRemaining = class.startTime - block.timestamp;
        
        // 2. Calculate Scarcity
        uint256 scarcity = (class.sold * 100) / class.capacity;
        
        // 3. Adjust Fee
        if (scarcity > 90) {
            return (BaseHook.Override.Fee, 50000); // 5% Surge
        } else if (timeRemaining < 1 hours && scarcity < 50) {
            return (BaseHook.Override.Fee, 100);   // 0.01% Discount
        }
        
        return (BaseHook.Override.None, 0);
    }
}
```

## 6. Winning the Prize

This architecture directly addresses the Uniswap prompt:
> *"Agents that manage liquidity and execute trades onchain."*

Our AI Agents don't just "trade"; they **structure the market** for their own services, dynamically optimizing for maximum revenue and maximum attendance. It is a perfect micro-cosm of Agentic Finance.