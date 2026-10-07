# AchievementRedeemerV2 — phase-4 design (implemented + tested, not deployed)

Status: contract and Foundry tests only. **No deployment, no app wiring, no
economics.** Amounts, budgets, caps, assets and the ABI used by any real
campaign still need the separately approved spec from
[IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) phase 4, and the deploy
needs explicit operator approval (phase 5).

Code: `contracts/evm/src/redeemer/{AchievementRedeemerV2,ClaimRegistry}.sol`
Tests: `contracts/evm/test/AchievementRedeemerV2.t.sol`

## Trust statement

A redemption means: *an authorized SpinChain issuer approved this session
under this policy.* It does not claim ZK integrity or physical-world
provenance. A later ZK envelope can bind a proof to the same `Receipt` fields
and the same nullifier without changing the replay registry.

## Typed receipt (EIP-712)

Domain: `name = "SpinChain AchievementRedeemer"`, `version = "2"`, `chainId`,
`verifyingContract` (OpenZeppelin `EIP712`, so chain forks rebuild the separator).

```
Receipt(address recipient, bytes32 sessionId, bytes32 classId, bytes32 policyHash,
        bytes32 campaignId, uint256 amount, uint64 issuedAt, uint64 expiresAt)
```

`sessionId`/`classId` are opaque identifiers chosen by the issuer, never raw
telemetry or account keys. They are signed but never emitted.

## Stable nullifier + replay registry

`nullifier = keccak256(abi.encode(keccak256("spinchain.achievement.nullifier.v1"), campaignId, sessionId))`

- Derived on-chain, so an issuer cannot mint two nullifiers for one session.
- It doesn't depend on signature bytes, proof bytes, amount, expiry or contract
  address. A re-signed receipt with different terms is still a replay.
- It is stored in a separate `ClaimRegistry` that every redeemer generation
  writes to (`setWriter`). A new redeemer or verifier doesn't start with an
  empty registry. Revoking a writer keeps its history. The legacy
  `IncentiveEngine.usedProofs` mapping is a historical record, not this registry.

## `redeem(receipt, issuer, signature)` check order

1. `whenNotPaused`, `nonReentrant`
2. Caller is `recipient` or an allowlisted gas payer (funds always go to `recipient`)
3. `issuedAt <= now <= expiresAt`, and `expiresAt - issuedAt <= maxReceiptLifetime` (immutable)
4. Campaign exists, is active and inside `[startsAt, endsAt]`; `policyHash` matches
5. `issuer` is currently authorized; `SignatureChecker` (EOA or ERC-1271)
6. Pre-funded campaign budget (`funded - spent`) and per-user cap
7. `registry.consume(nullifier)` (reverts if consumed), then account and `safeTransfer`
8. `Redeemed(nullifier, campaignId, recipient, amount, issuer)` — minimal evidence only

## Roles

| Role | Can | Cannot |
|---|---|---|
| Owner (`Ownable2Step`; intended multisig/timelock) | add/remove issuers, gas payers, campaigns; unpause; withdraw unspent after a campaign stops | redeem for others |
| Guardian (incident) | `pause`, `revokeIssuer` immediately | add issuers, unpause |
| Sponsor (anyone) | `fundCampaign` (balance-delta accounting) | withdraw |

Campaign budgets are isolated: one campaign cannot pay out another's funds.

## Out of scope here

Numeric payouts and economics, deployment/addresses, app/claim-flow wiring,
the ZK envelope, Merkle/batch claims, gas sponsorship mechanics, and any
change to the live legacy claim flags.
