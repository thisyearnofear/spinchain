# Deployment Guide: Avalanche via Remix IDE

## Network Config (add to MetaMask)

| Field            | Fuji Testnet                                      | Mainnet                              |
|------------------|---------------------------------------------------|--------------------------------------|
| Network Name     | Avalanche Fuji                                    | Avalanche C-Chain                    |
| RPC URL          | `https://api.avax-test.network/ext/bc/C/rpc`      | `https://api.avax.network/ext/bc/C/rpc` |
| Chain ID         | 43113                                             | 43114                                |
| Currency         | AVAX                                              | AVAX                                 |
| Explorer         | https://testnet.snowtrace.io                      | https://snowtrace.io                 |

Get testnet AVAX: https://faucet.avax.network

---

## Remix Setup

1. Go to **https://remix.ethereum.org**
2. **File Explorer → Create Workspace** (blank template)
3. Copy each `.sol` file from `contracts/evm/` into Remix
4. In **Solidity Compiler** tab:
   - Compiler: `0.8.24`
   - Enable optimization: ✅, runs: `200`
5. In **Deploy & Run** tab:
   - Environment: **Injected Provider – MetaMask**
   - Confirm MetaMask is on the correct network

> **Note on imports**: Remix resolves `@openzeppelin/contracts` automatically via its npm CDN.
> `DemandSurgeHook.sol` uses Uniswap v4-core/v4-periphery imports that Remix cannot resolve —
> skip it for now and deploy it separately via Foundry when v4 launches on Avalanche.

---

## Deployment Order

> **Fuji MVP note**: If you plan to use Yellow streaming settlement, deploy `YellowSettlement.sol` and set `NEXT_PUBLIC_YELLOW_SETTLEMENT_ADDRESS`.

### Step 1 — MockUltraVerifier *(testnet only)*

> For mainnet, generate the real verifier: `cd circuits/effort_threshold && nargo codegen-verifier`

**File**: `MockUltraVerifier.sol`  
**Constructor args**: none  
**⚠️ Never use MockUltraVerifier on mainnet — it accepts any proof as valid.**

---

### Step 2 — SpinToken

**File**: `SpinToken.sol`  
**Constructor**:
| Param   | Value                  |
|---------|------------------------|
| `owner_` | Your deployer wallet  |

> The owner of SpinToken is the **only** address that can call `mint()`.
> You will transfer ownership to IncentiveEngine in Step 6.

---

### Step 3 — EffortThresholdVerifier

**File**: `contracts/verifiers/EffortThresholdVerifier.sol`  
**Constructor**:
| Param          | Value                              |
|----------------|------------------------------------|
| `ultraVerifier_` | MockUltraVerifier address (Step 1) |

---

### Step 4 — IncentiveEngine

**File**: `IncentiveEngine.sol`  
**Constructor**:
| Param              | Value                                     |
|--------------------|-------------------------------------------|
| `owner_`           | Your deployer wallet                      |
| `spinToken_`       | SpinToken address (Step 2)                |
| `attestationSigner_` | Your deployer wallet (acts as AI signer for MVP) |
| `effortVerifier_`  | EffortThresholdVerifier address (Step 3)  |

---

### Step 5 — TreasurySplitter *(optional for MVP)*

**File**: `TreasurySplitter.sol`  
**Constructor**:
| Param           | Value                                          |
|-----------------|------------------------------------------------|
| `owner_`        | Your deployer wallet                           |
| `wallets`       | `["0xYourAddress","0xPlatformAddress"]`        |
| `bps`           | `[9000, 1000]` *(90% instructor, 10% platform)* |
| `usePullPattern_` | `true` *(safer: recipients withdraw themselves)* |

---

### Step 6 — YellowSettlement *(required for Yellow streaming MVP)*

**File**: `YellowSettlement.sol`  
**Constructor**:
| Param     | Value                         |
|----------|-------------------------------|
| `owner_` | Your deployer wallet          |
| `token_` | SpinToken address (Step 2)    |
| `engine_`| IncentiveEngine (Step 4)      |

---

### Step 7 — ClassFactory

**File**: `ClassFactory.sol`  
**Constructor args**: none

---

### Step 8 — Transfer SpinToken Ownership to IncentiveEngine

In Remix, select **SpinToken** → **transferOwnership**:
```
newOwner = <IncentiveEngine address from Step 4>
```

> This allows IncentiveEngine to mint SPIN rewards.
> You lose the ability to call `mint()` directly — that is intentional.
> You can still call all other admin functions via IncentiveEngine's `onlyOwner`.

---

## Post-Deployment: Update Environment Variables

Add to your `.env.local`:

```env
# Network (Fuji)
NEXT_PUBLIC_AVALANCHE_CHAIN_ID=43113
NEXT_PUBLIC_AVALANCHE_EXPLORER_URL=https://testnet.snowtrace.io

# Deployed contracts
NEXT_PUBLIC_SPIN_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS=0x...
NEXT_PUBLIC_CLASS_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_ULTRA_VERIFIER_ADDRESS=0x...         # MockUltraVerifier for testnet
NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS=0x...
NEXT_PUBLIC_TREASURY_SPLITTER_ADDRESS=0x...
NEXT_PUBLIC_YELLOW_SETTLEMENT_ADDRESS=0x...
```

These are read by `app/lib/contracts.ts` → `CONTRACT_ADDRESSES`.

---

## Create Your First Class (smoke test)

Call `ClassFactory.createClass()` with:

| Param             | Example Value                              |
|-------------------|--------------------------------------------|
| `name`            | `"Morning Burn"`                           |
| `symbol`          | `"SPIN1"`                                  |
| `classMetadata`   | `'{"version":"2.0","name":"Morning Burn"}'`|
| `startTime`       | Unix timestamp 1 hour from now             |
| `endTime`         | Unix timestamp 2 hours from now            |
| `maxRiders`       | `20`                                       |
| `basePrice`       | `10000000000000000` *(0.01 AVAX in wei)*   |
| `maxPrice`        | `50000000000000000` *(0.05 AVAX in wei)*   |
| `treasury`        | TreasurySplitter address (or your wallet)  |
| `incentiveEngine` | IncentiveEngine address                    |
| `spinToken`       | SpinToken address                          |

Copy the deployed `SpinClass` address from the transaction logs and update
`app/rider/page.tsx` for live testing.

---

## Verification on Snowtrace

1. In Remix: **Plugin Manager → activate "Flattener"**
2. Right-click the `.sol` file → **Flatten**
3. Go to Snowtrace → contract address → **Verify & Publish**
4. Paste the flattened source, select compiler `v0.8.24`, enable optimization (200 runs)

---

## What's NOT deployable via Remix

| Contract            | Reason                                      | Alternative               |
|---------------------|---------------------------------------------|---------------------------|
| `DemandSurgeHook`   | Needs Uniswap v4-core/v4-periphery imports  | Deploy with Foundry       |
| Real `UltraVerifier`| Generated by Noir (`nargo codegen-verifier`)| Use MockUltraVerifier for testnet |
