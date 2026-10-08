# Phase 5 — Fuji Pilot: Issuer-Signed Receipt Redemption

Status: **deployed to Fuji + dogfooded** (2026-10-07). Production/mainnet
remains out of scope.

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
| Asset | `PilotSpinToken` `0x3DC8288228d2E916F41c05Ea04caF86d131d7243` (fresh; Fuji SpinToken mint is locked to the legacy IncentiveEngine) |
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
export ISSUER_ADDRESS=0x…   # public address of REDEEMER_ISSUER_PRIVATE_KEY
forge script src/deploy-phase5-pilot.s.sol --rpc-url fuji --broadcast
```

The script deploys `ClaimRegistry`, deploys `AchievementRedeemerV2`, sets the
redeemer as the registry's sole writer, configures issuer/guardian/gas-payer,
deploys `PilotSpinToken` (or uses `PILOT_ASSET`), creates the campaign, and
funds it from the deployer balance. Prints every address.

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

## Deployment record (Fuji 43113, 2026-10-07)

| Contract | Address |
|---|---|
| `ClaimRegistry` | `0x53C1F0b6E740F1F8A91352B6169F67Daf2Fa64E1` |
| `AchievementRedeemerV2` | `0x0F00848CA2aA4493C6A6C89ED0FD3128Cc31d204` |
| `PilotSpinToken` (PSPIN) | `0x3DC8288228d2E916F41c05Ea04caF86d131d7243` |

Owner + guardian: `0xdf36fF75df0DD320b8D2d2Bf2cb7fE61F383A13D` (deployer).
Issuer: `0x854B53F166BB25B7E6a79345D9e77d7078621026`. No gas payer
configured (recipients self-submit). Campaign funded 1,000 PSPIN; deployer
retains ~3,000 for refills.

Deploy txs (broadcast log `broadcast/deploy-phase5-pilot.s.sol/43113/`):
registry `0x4e1d6e8a…`, redeemer `0x0e7b567f…`, setWriter `0xd40d7d53…`,
setIssuer `0x7cd0ed53…`, setGuardian `0xafc316ab…`, token `0x0300e004…`,
createCampaign `0xcf1e338c…`, approve `0x80d37500…`, fund `0x3a76568f…`.

Post-deploy verified on-chain: registry wired, redeemer is sole writer,
issuer authorized, lifetime 604800s, budget funded.

### Dogfood evidence

1. **Contract-level** (`dogfood-phase5-pilot.s.sol`): issuer-signed receipt
   redeemed on Fuji — nullifier `0x88e2faad…`, recipient +10 PSPIN. Replay
   via eth_call reverted `AlreadyConsumed` (`0x6f47ab5f`).
2. **App-level** (dev server): wallet session → `cloud_history` consent →
   `POST /api/rides` (≥10 min) → `POST /api/redeem/sign` → `redeem()` tx
   `0x14ed5630…f2876` —
   the app's EIP-712 signature verified on-chain; `Redeemed` emitted;
   balance 3010 → 3020 PSPIN; budget 990 → 980.
3. **Production app** (spinchain.vercel.app, pilot flags set on Vercel):
   session → consent → ride sync → sign → `redeem()` tx
   `0xb3c1c0b0…1c84a`; `Redeemed` emitted; budget 980 → 970.
   The pilot UI is live for Fuji-connected wallets.

## Non-goals

- No mainnet deployment, no value-bearing token, no general-user rewards launch — the pilot UI on production targets Fuji testnet only.
- No claim that the pilot validates real-bike telemetry or provenance.
- Legacy `IncentiveEngine` claim path remains disabled and untouched.

Phase 5 closed 2026-10-07: deployed, verified, and dogfooded at contract,
local-app, and production-app levels on Fuji.
