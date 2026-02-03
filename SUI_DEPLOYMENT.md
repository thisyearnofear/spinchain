# Sui Deployment Guide

## Prerequisites

Install Sui CLI:
```bash
# macOS
brew install sui

# Or via cargo
cargo install --locked sui

# Verify installation
sui --version
```

## Step 1: Create Wallet

```bash
# Create new wallet (ed25519 is recommended)
sui client new-address ed25519

# You'll see output like:
# Created new keypair for address: 0x1234567890abcdef...
# Secret Recovery Phrase: [WRITE THIS DOWN]
```

Save the address and secret phrase securely.

## Step 2: Switch to Testnet

```bash
# Add testnet environment
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443

# Switch to testnet
sui client switch --env testnet

# Verify
sui client active-env
```

## Step 3: Get Testnet SUI

```bash
# Request from faucet
sui client faucet

# Check balance (should show 1-2 SUI coins)
sui client gas
```

## Step 4: Build the Package

```bash
cd /Users/udingethe/Dev/spinchain/move/spinchain

# Build
sui move build

# If successful, you'll see:
# BUILDING spinchain
# COMPILING spinsession
# SUCCESS
```

## Step 5: Deploy

```bash
# Deploy with sufficient gas budget
sui client publish --gas-budget 100000000
```

You'll see output like:
```
Transaction Effects: {
  "status": { "status": "success" },
  "created": [
    {
      "owner": "Immutable",
      "reference": {
        "objectId": "0xPACKAGE_ID_HERE",
        "version": 1,
        "digest": "..."
      }
    }
  ]
}
```

**Save the Package ID!**

## Step 6: Create a Session (Test)

```bash
# Create a test session
sui client call \
  --package 0xYOUR_PACKAGE_ID \
  --module spinsession \
  --function create_session \
  --args \
    "0xCLASS_ID_FROM_EVM" \
    3600 \
  --gas-budget 10000000
```

## Environment Variables

After deployment, add these to your `.env.local`:

```env
# Sui Wallet (your deployed wallet)
SUI_WALLET_ADDRESS=0xYOUR_WALLET_ADDRESS
SUI_PRIVATE_KEY=your_private_key_here

# Deployed Package
NEXT_PUBLIC_SUI_PACKAGE_ID=0xYOUR_PACKAGE_ID

# Example Session Object (created after first session)
NEXT_PUBLIC_SUI_EXAMPLE_SESSION_ID=0xSESSION_OBJECT_ID
```

## Frontend Integration

The frontend already has `@mysten/dapp-kit` configured. Update `app/sui-provider.tsx` with your package ID.

## Troubleshooting

### "Insufficient gas"
Request more from faucet: `sui client faucet`

### "Package not found"
Make sure you're on testnet: `sui client active-env`

### "Move build failed"
Check Move.toml dependencies are correct.

## Security Notes

- Never commit private keys to git
- Use `.env.local` for sensitive data (already in .gitignore)
- Testnet SUI has no real value, but mainnet will
