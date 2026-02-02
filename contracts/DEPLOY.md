# Deployment Guide: Avalanche C-Chain

## Pre-requisites
- **Network Name**: Avalanche Fuji Testnet
- **RPC URL**: `https://api.avax-test.network/ext/bc/C/rpc`
- **Chain ID**: 43113
- **Currency Symbol**: AVAX

## Deployment Order

### 1. SpinToken (ERC-20)
Deploy the reward token first.
- **Name**: "SpinChain Token"
- **Symbol**: "SPIN"

### 2. IncentiveEngine
Deploy the rewards controller.
- **Owner**: Your wallet address
- **Token**: Address of `SpinToken` (from Step 1)
- **Signer**: Your wallet address (for the MVP, the "AI Agent" signer is just you)

### 3. TreasurySplitter (Optional for MVP)
If you want to split revenue automatically.
- **Payees**: `[YourAddress, PlatformAddress]`
- **Shares**: `[90, 10]`

### 4. ClassFactory
The main factory for instructors.
- No constructor arguments needed.

## Post-Deployment Setup

1. **Grant Minter Role**:
   - The `IncentiveEngine` needs permission to mint `SpinToken`.
   - Call `SpinToken.grantRole(MINTER_ROLE, IncentiveEngineAddress)`.

2. **Verify on Snowtrace**:
   - Flatten contracts or use Hardhat verify plugin.

## Live Demo (Fuji)
Once deployed, update the `mockClassAddress` in `spinchain/app/rider/page.tsx` with a real `SpinClass` address created by your factory to verify the integration.