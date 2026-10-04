# Deployment Guide: Avalanche via Foundry (Forge)

> **Status (2026-10-04)**: Historical reference. The Fuji deployments below are **legacy experiments** from the pre-redesign architecture — full-stack redeployment is **not** the default path. The next contract step is the `AchievementRedeemerV2` design (phase 4 of `docs/IMPLEMENTATION-PLAN.md`; see `plans/wedge-contract-research.md`). No adapter or replacement wrapper is deployed before that spec.
>
> **Known deployed-wrapper mismatch**: the live Fuji `EffortThresholdVerifier` (`0xBbc32cc3b8AF9BaeD8D77E3bf4fC69141b0c9dA4`) forwards the wrong public-input slice to the inner Honk verifier — `verifyProof` reverts (`0xfa066593`) on the committed fixture proof (read-only `eth_call`, 2026-10-04). The underlying `HonkVerifier` (`0xF2a33f6e9a5e935Db5d682E226A7e1a0249A641B`) accepts the fixture with the correct 3-output inputs (`threshold_met`, `seconds_above`, `effort_score`). Corrected wrapper code exists locally and is **not deployed**.

---

## Deployed Contracts — Fuji Testnet (chain 43113)

### Current configured set (June 2026 — the addresses in `.env.local` / `app/lib/contracts.ts`)

| Contract                    | Address                                        | Status |
|-----------------------------|------------------------------------------------|--------|
| `SpinToken`                 | `0x4c0E965B809452F2C914a74d1D0e9C3375543392` | legacy experiment |
| `IncentiveEngine`           | `0x69800d3ABda003b7aA6038831715a4aCb736403d` | legacy experiment |
| `ClassFactory`              | `0x035026f85CCbC273160669FBe9Ba5Dc147D0Bd9b` | legacy experiment |
| `TreasurySplitter`          | `0x00a1e5688AF26c724155BfEe100fF23d387850AB` | legacy experiment |
| `HonkVerifier`              | `0xF2a33f6e9a5e935Db5d682E226A7e1a0249A641B` | real UltraHonk verifier — accepts fixture proofs |
| `EffortThresholdVerifier`   | `0xBbc32cc3b8AF9BaeD8D77E3bf4fC69141b0c9dA4` | **broken** — see mismatch note above |
| `BiometricOracle`           | `0x038fca8A26F9065f12F831C0600f30d8C90AFCFD` | placeholder forwarder; CRE not adopted |
| `SpinPack` (ERC-1155)       | `0x2C8443584daFA864Caa967cBDD7ec3D17157618B` | legacy experiment |

### Earlier deployment (historical — superseded addresses)

| Contract                    | Address                                        |
|-----------------------------|------------------------------------------------|
| `SpinToken`                 | `0xA2DA94dE3AB8a90D62A1b1897E0e96DBda0F494f` |
| `IncentiveEngine`           | `0x8BF20C7fbc69cafd3144de3Bb30509A26F39FF3d` |
| `ClassFactory`              | `0xc4B4A722b55610bFa1556506B87Cbfe7983961A7` |
| `TreasurySplitter`          | `0xDd787C22A28aA709021860485AC1b95620B5AcE3` |
| `YellowSettlement`          | `0x960bbE91899D8A1D62e894348B9fa8B6358d9182` |
| `MockUltraVerifier`         | `0x202aEd029708F2e0540B63a4025Dcb2556F85ba1` |
| `EffortThresholdVerifier`   | `0x783C36f6502052EC31971e75E20D0012910dbA91` |
| `BiometricOracle`           | `0xE0021E77f52761A69F611530A481B2B9371993d8` |

> `YellowSettlement` was consolidated into `IncentiveEngine` (`submitChannelProof`); `MockUltraVerifier` was used for early testnet claims and is a dev fallback only. Yellow-channel settlement is parked until a funded use case exists.

---

## Operator-Guarded Testnet Path

Deployment is gated behind the phased plan — treat any future deployment as an operator-approved step after phase 4/5 work, not a routine task:

- Owner/deployer signer: `0x29FA4181620358dA180CAD770dB1696fbA78F1Cd` (owns engine and wrapper on Fuji; ~1.98 AVAX as of 2026-10-04).
- Any `AchievementRedeemerV2` uses a **new, separate** stable semantic receipt/session nullifier — not the legacy `usedProofs` proof-bytes mapping. Historical `usedProofs` data is preserved where applicable as record, not reused as the semantic registry.
- Build/test before any broadcast: `cd contracts/evm && forge install --no-git foundry-rs/forge-std@v1.15.0 && FOUNDRY_PROFILE=honk forge build --skip test --skip script && forge test --match-contract 'EffortThresholdVerifier.*'` (or `pnpm test:contracts`).

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
# Install Foundry (CI pins v1.5.1)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install Solidity dependencies (forge-std is not committed; install explicitly)
cd contracts/evm
forge install --no-git foundry-rs/forge-std@v1.15.0
```

> Note: `npm ci` in `contracts/evm` currently fails on a pre-existing peer conflict (`hardhat-chai-matchers` requires `ethers@^5`, project pins `ethers@^6`). CI installs `@openzeppelin/contracts@5.0.2` standalone for forge builds instead.

---

## Environment Setup

Create `contracts/evm/.env`:

```env
AVALANCHE_PRIVATE_KEY=0x<your_64_char_hex_private_key>
ALLOW_MOCK_VERIFIER=true
```

Get testnet AVAX: https://faucet.avax.network (requires GitHub/Twitter auth, sends 2 AVAX).
Deployer wallet needs at least **0.5 AVAX** for gas.

---

## Build

```bash
cd contracts/evm
FOUNDRY_PROFILE=honk forge build --skip test --skip script
```

All contracts compile with Solc 0.8.27 + `via_ir = true` (set in `foundry.toml`); the `honk` profile disables `via_ir` for the generated verifier.

---

## Deploy (ARCHIVED — unapproved path)

> The broadcast commands below are kept for history only. They are **not** a plausible default operator action: any future broadcast waits on the phase-4 `AchievementRedeemerV2` design gate and explicit operator approval. There is no build pipeline or executable for the new redeemer yet. Prefer operator-protected signing (keystore/hardware wallet) — never pass raw private keys as CLI arguments in any procedure.

```bash
cd contracts/evm
forge script src/deploy.s.sol:DeployScript \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast \
  -vvvv
```

The deploy script (`src/deploy.s.sol`) executes in order:

1. Use `ULTRA_VERIFIER_ADDRESS` if provided
2. Else deploy `MockUltraVerifier` only when `ALLOW_MOCK_VERIFIER=true`
3. Deploy `EffortThresholdVerifier` only when a verifier is available
4. Deploy `SpinToken`
5. Deploy `IncentiveEngine` (with ZK enabled or explicitly disabled)
6. Authorize `IncentiveEngine` in `EffortThresholdVerifier` when present
7. Deploy `BiometricOracle`
8. Deploy `TreasurySplitter`
9. Deploy `YellowSettlement`
10. Deploy `ClassFactory`
11. Transfer `SpinToken` ownership → `IncentiveEngine`

### Verify on Snowtrace

```bash
cd contracts/evm
export SNOWTRACE_API_KEY=your_api_key
forge script src/deploy.s.sol:DeployScript \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast --verify \
  -vvvv
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
| `DemandSurgeHook`   | Requires Uniswap v4-core/v4-periphery — parked until a funded use case |
| `AchievementRedeemerV2` | Phase-4 design only — no implementation yet               |

---

## ZK Verifier Notes

### What the circuit proves

The Noir circuit (`circuits/effort_threshold/`) produces exactly **three public outputs**: `threshold_met`, `seconds_above`, `effort_score`. `threshold`, `minDuration`, `classId`, and `rider` are attached application metadata — they are NOT proven by the circuit. Proof bytes are not a stable ride/session nullifier. ZK here is an optional privacy layer over issuer-bound commitments, not trustless physical-effort verification.

### Generating a verifier (regeneration only)

```bash
cd circuits/effort_threshold
bb write_vk -b target/effort_threshold.json -o target/vk
bb write_solidity_verifier -k target/vk -o ../../contracts/evm/src-honk/HonkVerifier.sol -t evm
```

---

## Mainnet Checklist

Mainnet is out of scope until the phased plan completes. Remaining prerequisites:

- [ ] `AchievementRedeemerV2` spec, implementation, and tests (phase 4)
- [ ] Real-verifier gas benchmarks (existing figures are MockVerifier-based)
- [ ] Security audit of contracts before any real-value deployment
- [ ] Legal/policy review (Apple 3.1.1/5.1, EDPB, reward jurisdiction)
- [ ] Operator-approved testnet deployment and integrated dogfood pass first
- [ ] Set `NEXT_PUBLIC_AVALANCHE_CHAIN_ID=43114` and all mainnet addresses only when the above land
