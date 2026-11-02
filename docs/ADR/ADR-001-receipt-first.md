# ADR-001: Receipt-first progression

**Date:** 2026-10-04 (approved) — updated 2026-10-07
**Status:** Proposed and adopted (Phase 0–5 deployed)

## Context

SpinChain's wedge is "effort → visual transformation → dopamine". The product must never put
wallet, sign-up, or chain prerequisites in the ride loop. Before this ADR, ride progress was
persisted ad hoc (localStorage + Supabase) with value-bearing "achievements" appearing as implicit
claims, some of them untracked, and the chain integration emerging ad hoc (placeholders, wrong
public-input slices in the Fuji wrapper, no nullifier). There was no durable, auditable record of
what a rider actually earned, and no way to distinguish "the ride completed" from "the reward was
redeemed".

The question: how should SpinChain record effort-to-reward so that a rider's progress is
auditable, private-by-default, and optionally redeemable — without ever gating the core loop on a
wallet or chain?

## Decision

Adopt a **receipt-first** model:

1. **Ride completion writes a durable, local `RideReceiptV1` before any background work.** The
   receipt contains the per-component breakdown (sprint power, effort, flow minutes, milestone) and
   is stored in the append-only `spinchain:progression:v1` ledger and in Supabase `ride_summaries`.
2. **Background work (sync, signature, storage) reads the receipt; it does not create it.** No
   "automatic proof generation on ride stop" and no public personal-data write.
3. **Value-bearing settlement is a separate, explicitly-gated layer** (Phase 4/5: `AchievementRedeemerV2`
   + `ClaimRegistry` + `PilotSpinToken`), issuer-signed, with nullifier replay protection, and it is
   **never a prerequisite for the ride loop**.
4. **Three ledgers, never conflated:**
   - local runtime progression (append-only)
   - private account progression (behind `cloud_history` consent, outbox-backed, recoverable)
   - settlement ledger (chain receipts, nullifier-consumed)
5. **Rider language only.** Surfaces say "XP", "milestone", "flow". Never "receipt", "nullifier",
   "contract", or "on-chain" on rider screens.

## Consequences

**Positive:**
- The core loop is frictionless: no wallet, sign-up, or chain prerequisite. The 30-second wedge holds.
- Effort-to-reward is auditable (a `RideReceiptV1` exists before anything else), so "what did I earn,
  and did I actually redeem it?" is answerable.
- Privacy by default: public personal-data writes are hard-disabled; biometric/telemetry only goes
  to third-party AI behind granular consent (`cloud_history`, `ai_voice`, `instructor_live_view`,
  `public_achievement_export`).
- Phase-5 redemption is revocable and bounds-checked (issuer signs, guardian can pause/revoke, nullifier
  prevents replay, unspent budget is withdrawable).

**Negative:**
- Code complexity increased: three ledgers, background jobs, outbox/recoverable jobs, EIP-712 signing.
- Legal/regulatory remains open until EDPB, Apple 3.1.1/5.1, and financial review complete.
- No mainnet value-bearing token, no general-user rewards launch.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Progressive Web App with native crypto (NFT achievement) | Wedge-violation: blocks the core loop behind wallet/NFT framing; contradicts rider language. |
| Off-chain leaderboard only (centralized database) | No auditable receipt; breaks "progress saved ≠ progress claimed" discipline. |
| On-chain event emission for every ride | Blocks the loop behind gas + tx fees; contradicts "no wallet prerequisite". |
| Legacy `IncentiveEngine` claim path | Disabled; untracked, implicit claims. |

## Audit trail

- Implementation plan: [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) (Phase 0–5)
- Chain deployment record: [PHASE-5-PILOT.md](./PHASE-5-PILOT.md)
- Receipt derivation: [ARCHITECTURE.md §2](./ARCHITECTURE.md)
- Refund/nullifier details: [ACHIEVEMENT-REDEEMER-V2.md](./ACHIEVEMENT-REDEEMER-V2.md)
