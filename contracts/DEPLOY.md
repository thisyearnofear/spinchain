# Deployment Guide: Avalanche via Foundry (Forge)

> **Status**: Contracts deployed to Avalanche Fuji testnet (chain 43113).
> All 8 contracts are **verified** on [Snowtrace](https://testnet.snowtrace.io).
> For mainnet, repeat the steps with the mainnet RPC URL.

---

## Deployed Contracts — Fuji Testnet (chain 43113)

| Contract                    | Address                                        | Snowtrace |
|-----------------------------|------------------------------------------------|-----------|
| `SpinToken`                 | `0xA2DA94dE3AB8a90D62A1b1897E0e96DBda0F494f` | [✓](https://testnet.snowtrace.io/address/0xa2da94de3ab8a90d62a1b1897e0e96dbda0f494f) |
| `IncentiveEngine`           | `0x8BF20C7fbc69cafd3144de3Bb30509A26F39FF3d` | [✓](https://testnet.snowtrace.io/address/0x8bf20c7fbc69cafd3144de3bb30509a26f39ff3d) |
| `ClassFactory`              | `0xc4B4A722b55610bFa1556506B87Cbfe7983961A7` | [✓](https://testnet.snowtrace.io/address/0xc4b4a722b55610bfa1556506b87cbfe7983961a7) |
| `TreasurySplitter`          | `0xDd787C22A28aA709021860485AC1b95620B5AcE3` | [✓](https://testnet.snowtrace.io/address/0xdd787c22a28aa709021860485ac1b95620b5ace3) |
| `YellowSettlement`          | `0x960bbE91899D8A1D62e894348B9fa8B6358d9182` | [✓](https://testnet.snowtrace.io/address/0x960bbe91899d8a1d62e894348b9fa8b6358d9182) |
| `MockUltraVerifier`         | `0x202aEd029708F2e0540B63a4025Dcb2556F85ba1` | [✓](https://testnet.snowtrace.io/address/0x202aed029708f2e0540b63a4025dcb2556f85ba1) |
| `EffortThresholdVerifier`   | `0x783C36f6502052EC31971e75E20D0012910dbA91` | [✓](https://testnet.snowtrace.io/address/0x783c36f6502052ec31971e75e20d0012910dba91) |
| `BiometricOracle`           | `0xE0021E77f52761A69F611530A481B2B9371993d8` | [✓](https://testnet.snowtrace.io/address/0xe0021e77f52761a69f611530a481b2b9371993d8) |

---

## 🔗 Chainlink CRE Deployment (Biometric Oracle)

1. **Deploy BiometricOracle.sol**:
   ```bash
   forge create src/BiometricOracle.sol:BiometricOracle \
     --rpc-url $FUJI_RPC \
     --private-key $PRIVATE_KEY \
     --constructor-args <CRE_FORWARDER_ADDRESS> <WORKFLOW_ID>
   ```

2. **Deploy CRE Workflow**:
   - Ensure `app/lib/chainlink/cre/cre.json` is configured with the deployed oracle address.
   - Use the Chainlink CRE CLI or Dashboard to deploy the `biometric-workflow.ts`.

3. **Register Oracle in IncentiveEngine**:
   ```bash
   cast send $INCENTIVE_ENGINE "setBiometricOracle(address)" $BIOMETRIC_ORACLE_ADDRESS \
     --rpc-url $FUJI_RPC \
     --private-key $PRIVATE_KEY
   ```

---

## Network Config

| Field        | Fuji Testnet                                 | Mainnet                                 |
|--------------|----------------------------------------------|-----------------------------------------|
| Network Name | Avalanche Fuji                               | Avalanche C-Chain                       |
| RPC URL      | `https://api.avax-test.network/ext/bc/C/rpc` | `https://api.avax.network/ext/bc/C/rpc` |
| Chain ID     | `43113`                                      | `43114`                                 |
| Symbol       | `AVAX`                                       | `AVAX`                                  |
| Explorer     | https://testnet.snowtrace.io                 | https://snowtrace.io                    |

---

## Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install Solidity dependencies
cd contracts/evm
forge install
```

---

## Environment Setup

Create `contracts/evm/.env`:

```env
AVALANCHE_PRIVATE_KEY=0x<your_64_char_hex_private_key>
```

Get testnet AVAX: https://faucet.avax.network (requires GitHub/Twitter auth, sends 2 AVAX).
Deployer wallet needs at least **0.5 AVAX** for gas.

---

## Build

```bash
cd contracts/evm
forge build
```

All contracts compile with Solc 0.8.24 + `via_ir = true` (set in `foundry.toml`).

---

## Deploy

```bash
cd contracts/evm
forge script src/deploy.s.sol:DeployScript \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast \
  -vvvv
```

The deploy script (`src/deploy.s.sol`) executes in order:

1. Deploy `MockUltraVerifier` (or use configured `ULTRA_VERIFIER_ADDRESS`)
2. Deploy `EffortThresholdVerifier` pointing at the raw verifier
3. Deploy `SpinToken`
4. Deploy `IncentiveEngine` (receives `EffortThresholdVerifier`, not raw `UltraVerifier`)
5. Authorize `IncentiveEngine` in `EffortThresholdVerifier`
6. Deploy `BiometricOracle`
7. Deploy `TreasurySplitter`
8. Deploy `YellowSettlement`
9. Deploy `ClassFactory`
10. Transfer `SpinToken` ownership → `IncentiveEngine` (so it can mint rewards)

### Verify on Snowtrace

The deploy script supports `--verify` for automatic verification:

```bash
cd contracts/evm
export SNOWTRACE_API_KEY=your_api_key
forge script src/deploy.s.sol:DeployScript \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast --verify \
  -vvvv
```

Or verify individual contracts after deployment:

```bash
forge verify-contract <ADDRESS> <CONTRACT_NAME> \
  --verifier etherscan \
  --chain-id 43113 \
  --verifier-url "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan" \
  --etherscan-api-key $SNOWTRACE_API_KEY \
  --constructor-args $(cast abi-encode "constructor(...)" ...) \
  --watch
```

---

## After Deployment — Update Frontend

Copy deployed addresses into `.env.local` at the project root:

```env
NEXT_PUBLIC_SPIN_TOKEN_ADDRESS=0x...
NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS=0x...
NEXT_PUBLIC_CLASS_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_ULTRA_VERIFIER_ADDRESS=0x...
NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS=0x...
NEXT_PUBLIC_TREASURY_SPLITTER_ADDRESS=0x...
NEXT_PUBLIC_YELLOW_SETTLEMENT_ADDRESS=0x...
NEXT_PUBLIC_BIOMETRIC_ORACLE_ADDRESS=0x...
NEXT_PUBLIC_AVALANCHE_CHAIN_ID=43113
```

The frontend reads all addresses from these env vars via `app/lib/contracts.ts` (single source of truth — do not hardcode addresses elsewhere).

---

## Contracts NOT in the deploy script

| Contract            | Reason                                                         |
|---------------------|----------------------------------------------------------------|
| `DemandSurgeHook`   | Requires Uniswap v4-core/v4-periphery — deploy separately      |
| Real `UltraVerifier`| See ZK Verifier section below                                  |

---

## ZK Verifier (Mainnet)

### Current State (Testnet)

On Fuji, `MockUltraVerifier` accepts any proof (testnet-only). The `EffortThresholdVerifier` wraps it and provides replay protection + authorized-caller gating. All ZK claim tests pass against this stack.

### Generating a Real UltraVerifier

The Noir circuit at `circuits/effort_threshold/` defines the effort-threshold proof. To generate a production verifier:

```bash
# Install Barretenberg CLI
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/install | bash
~/.bb/bbup -nv 1.0.0-beta.19  # Match your Noir version

# Generate verification key
cd circuits/effort_threshold
bb write_vk -b target/effort_threshold.json -o target/vk

# Generate Solidity verifier
bb write_solidity_verifier -k target/vk -o ../../contracts/evm/src/UltraVerifier.sol
```

### ⚠️ Known Limitation (Apr 2026)

`bb` 4.0.0-nightly generates **Honk** verifiers that exceed the EVM's 1024-slot stack depth limit, causing compilation failures. The `evm-no-zk` target produces broken code (missing identifiers — upstream bug).

**Workarounds for mainnet:**
1. **Off-chain verification**: Verify proofs off-chain via a backend service, then submit an attestation on-chain (recommended)
2. **Wait for upstream fix**: Monitor [AztecProtocol/aztec-packages](https://github.com/AztecProtocol/aztec-packages) for Honk verifier stack depth fixes
3. **UltraPlonk legacy**: Pin to an older bb version that generates UltraPlonk (not Honk) verifiers, if compatible with your Noir version

Once a working `UltraVerifier.sol` is generated:
1. Replace `contracts/evm/src/UltraVerifier.sol` with the generated output
2. Deploy the new verifier on-chain
3. Deploy a new `EffortThresholdVerifier` pointing at it
4. Deploy a new `IncentiveEngine` wired to the new `EffortThresholdVerifier`
5. Update `.env.local` with the new addresses

---

## Mainnet Checklist

- [ ] Resolve Honk verifier stack depth limitation (see ZK Verifier section)
- [ ] Generate and deploy real `UltraVerifier` from Noir circuit
- [ ] Deploy `EffortThresholdVerifier` against the real verifier
- [ ] Set `NEXT_PUBLIC_AVALANCHE_CHAIN_ID=43114` in `.env.local`
- [ ] Fund deployer wallet with mainnet AVAX
- [ ] Run forge script with mainnet RPC URL
- [ ] Update `.env.local` with mainnet addresses
- [ ] Verify contracts on Snowtrace (`--verify` flag or manual verification)
