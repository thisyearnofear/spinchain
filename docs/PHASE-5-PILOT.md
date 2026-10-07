# Phase 5 — Fuji Pilot: Issuer-Signed Receipt Redemption

Status: **code complete, awaiting operator deployment** (2026-10-07).

This document is the operator-facing spec for the phase-5 testnet pilot:
`ClaimRegistry` + `AchievementRedeemerV2` on Avalanche Fuji, fed by a
SpinChain issuer signature via `POST /api/redeem/sign`.

## What the pilot is — and is not

A redemption on Fuji proves exactly one thing: **an authorized SpinChain
issuer approved this session under this campaign policy.** Nothing more.

| Claim | Status in pilot |
|---|---|
| Ride completion recorded locally | ✅ RideReceiptV1 (local, durable) |
| Ride observed by the server | ✅ Only via `cloud_history` consent → `ride_summaries` |
| Issuer authorized a redemption | ✅ EIP-712 signed `Receipt` |
| Physical-world telemetry verified | ❌ No — no device attestation yet |
| ZK integrity of the ride | ❌ No — Honk verifier exists but is not in the redeem path |
| Production/value-bearing claims | ❌ No — testnet token, no value |

The pilot exercises the **contract boundary** end to end (signature → nullifier →
budget → transfer) on a real network. It does not validate provenance.

## Trust boundary matrix

| Actor | Can do | Cannot do |
|---|---|---|
| Rider wallet | `redeem()` own signed receipt | Get a signature without a synced, eligible ride; replay; exceed cap |
| Issuer key (`/api/redeem/sign`) | Sign receipts for synced rides ≥ 10 min, fixed amount/policy | Choose amount, recipient, or session; sign for unsynced rides; redeem |
| Gas payer (optional allowlist) | Submit `redeem()` for a recipient | Change any receipt field; redeem own rides |
| Owner (deployer) | Set issuers/guardian/gas payers, create/fund campaigns, unpause | Redeem on a user's behalf; rewrite consumed nullifiers |
| Guardian | Pause; revoke a compromised issuer | Unpause; add issuers; touch funds |
| ClaimRegistry | Record nullifier consumption once | Be rewritten; forget consumed nullifiers on redeploy |

Enforcement details live in `contracts/evm/src/redeemer/AchievementRedeemerV2.sol`;
the 32-case boundary suite is `contracts/evm/test/AchievementRedeemerV2.t.sol`.

## Pilot constants (must match deploy + app)

| Value | Source |
|---|---|
| `campaignId` | `keccak256("spinchain.pilot.rides.v1")` |
| `policyHash` | `keccak256("spinchain.pilot.policy.v1")` |
| Amount | `10e18` test SPIN per eligible ride |
| Per-user cap | `100e18` |
| Max receipt lifetime | 7 days (contract `maxReceiptLifetime`) |
| Campaign window | deploy time → +90 days |
| Min ride duration | 600 s (issuer-side policy) |
| Asset | Fuji SpinToken `0xA2DA94dE3AB8a90D62A1b1897E0e96DBda0F494f` |
| EIP-712 domain | `SpinChain AchievementRedeemer` v2, chain `43113`, verifying contract |
| Nullifier | `keccak256(abi.encode(keccak256("spinchain.achievement.nullifier.v1"), campaignId, sessionId))` |

`sessionId` is derived server-side: `keccak256("spinchain.ride.v1:" + ride.id)`
of the synced `ride_summaries` row — never client-supplied telemetry.

## Measured gas (real verifier, not mock)

From `contracts/evm/test/Phase5Benchmark.t.sol` using the real proof fixture
`contracts/evm/test/fixtures/effort_proof.json`:

| Operation | Gas |
|---|---|
| `HonkVerifier.verify` (real UltraHonk proof) | ~1,185,471 internal / ~1,189,028 tx |
| `AchievementRedeemerV2.redeem` (cold) | ~141,947 internal / ~159,143 tx |

Historical "364k / 45-minute" figures in older docs measured `MockVerifier` —
do not reuse them. Honk verification is **not** in the redeem path; it is a
separate future settlement track. `redeem()` itself is ERC-20-transfer-priced.

## Deployment runbook (operator)

### Preflight — confirm before broadcasting

1. `gh auth status` / deployer wallet is the intended account.
2. `cast chain-id --rpc-url fuji` → `43113`.
3. Deployer has Fuji AVAX for gas.
4. Deployer owns (or is minter on) the pilot asset — Fuji SpinToken owner is
   `0x29FA…F1Cd`; the script calls `mint()` to fund the campaign.
5. Issuer address set: `ISSUER_ADDRESS` = the public address of the key in
   `REDEEMER_ISSUER_PRIVATE_KEY` (server env). Testnet-only key.
6. Campaign params reviewed: fund amount, cap, window above.

### Deploy

```bash
cd contracts/evm
source ../../.env.local   # or export the vars
export ISSUER_ADDRESS=0x…
forge script src/deploy-phase5-pilot.s.sol --rpc-url fuji --broadcast --verify
```

The script deploys `ClaimRegistry`, deploys `AchievementRedeemerV2`, sets the
redeemer as the registry's sole writer, configures issuer/guardian/gas-payer,
creates the campaign, mints + funds the budget, and prints every address.

### Post-deploy verification

```bash
cast call $REDEEMER "registry()(address)" --rpc-url fuji      # → ClaimRegistry
cast call $REGISTRY "writers(address)(bool)" $REDEEMER ...   # → true
cast call $REDEEMER "isIssuer(address)(bool)" $ISSUER ...    # → true
cast call $REDEEMER "remainingBudget(bytes32)(uint256)" $CAMPAIGN ...
```

Then set `NEXT_PUBLIC_ACHIEVEMENT_REDEEMER_ADDRESS=<redeemer>`,
`NEXT_PUBLIC_PILOT_REDEEM_ENABLED=true`, `PILOT_REDEEM_ENABLED=true`,
`REDEEMER_ISSUER_PRIVATE_KEY=<testnet issuer key>` in Vercel/server env.

### Dogfood loop

1. Complete a ride (demo or real) ≥ 10 min with wallet connected.
2. Grant `cloud_history` consent → ride syncs to `ride_summaries`.
3. Journey page → "Redeem testnet pilot" → issuer signs → wallet `redeem()`.
4. Confirm `Redeemed` event + recipient SPIN balance on Snowtrace.
5. Attempt the same redemption again → must revert (nullifier consumed).

### Pause / rollback

- Incident: `redeemer.pause()` from guardian or owner — `redeem()` halts
  immediately; `unpause()` is owner-only.
- Compromised issuer: `redeemer.revokeIssuer(addr)` from guardian — instant.
- Kill the pilot: `setCampaignActive(campaignId, false)` + turn both app
  flags off. `withdrawUnspent` returns the remaining budget after the
  campaign ends/deactivates.

## Non-goals

- No production deployment, no value-bearing token, no user-facing launch.
- No claim that the pilot validates real-bike telemetry or provenance.
- Legacy `IncentiveEngine` claim path remains disabled and untouched.

Remaining before this phase closes: the operator deploy + dogfood above.
