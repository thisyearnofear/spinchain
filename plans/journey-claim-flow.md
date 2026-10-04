# Journey Claim Flow — Spec

> **Status**: SUPERSEDED by receipt-first direction (approved 2026-10-04). The raw-Walrus-fetch claim flow below is historical context only — it is NOT the build target. Current design: V1 is a local ride record; future claim/settlement is a separate architecture and is **not shipped**. See `plans/wedge-contract-research.md` and `docs/ARCHITECTURE.md` §2.
> **Wedge rule**: never advertise what riders can't do. Journey copy must distinguish `progress saved` / `verification pending` / `redemption confirmed`.

## What exists today

- `RideSummary` (localStorage/Supabase) stores aggregates only; no raw samples are persisted for proof regeneration. Raw Walrus telemetry blobs exist for historical rides and are legacy reads — migration-only, auth-owner-scoped enforcement is deployed in phase 1 (API owner-scoping included: 403 on rider mismatch, 404 cross-owner); never retroactively declared private.
- In-session claim plumbing (`useZKClaim` → `IncentiveEngine`) exists but the deployed Fuji wrapper is known-broken (wrong public-input slice, confirmed 2026-10-04) and claims are not approved — the app-side legacy-claim gate (`isLegacyRewardClaimsEnabled`, Fuji-only flag) is deployed in phase 1 with production `false`.
- Proof generation on ride stop is disabled in the live phase-1 build (LocalOracle instantiated only under the legacy flag).

## Receipt-first recovery phases (current design)

### V1 ride record (phase 1 — deployed 2026-10-04, `a3c7e37`)

- Completed ride saves locally BEFORE any background work, carrying a durable `RideReceiptV1` (interface in `docs/ARCHITECTURE.md` §2).
- Journey/history shows honest status: `progress saved`. No claim buttons, no "X SPIN ready" copy — a V1 receipt is not a certificate and redemption is `unavailable`.
- No fabricated raw samples from averages; no plaintext fallback opt-in.

### Private account sync (phase 2 — planned)

- Session-gated Supabase sync with durable outbox/recoverable jobs; pending proof/receipt state persists independent of the finish screen.
- Granular consents gate cloud history, third-party AI/voice, instructor live view, and public achievement export separately.

### Future claim/settlement (phases 4–5 — design principles approved, not built)

- `AchievementRedeemerV2`: issuer-signed typed receipt bound to recipient/session/class/policy, EIP-712 domain, stable consumed nullifier (NOT proof bytes), expiry, campaign/user budgets, gas-payer allowlist, pause/signer rotation.
- Semantic replay registry survives verifier changes. Honest SpinChain-issuer trust initially; optional ZK envelope later over issuer-bound commitments.
- No numeric payout promises; exact ABI/economics are NOT yet designed or approved — they are a separate spec.

## Historical context (do not build)

The superseded flow fetched a Walrus blob → regenerated 1Hz HR → `generateProof` → `submitZKProofBatch`. Retired because: raw telemetry must not be public, proof bytes are not a stable session nullifier, and ZK does not authenticate physical-world provenance.

## Out of scope

Cross-ride batching, Yellow-channel claims, gasless/sponsored claims, any settlement wiring in phases 1–2.
