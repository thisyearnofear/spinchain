# Journey Claim Flow — Spec

> **Status**: SPEC — not built. **Problem**: rides stuck at proof `ready` have no claim path once the finish screen closes. Claiming only exists in-session (`useRewards.finalizeRewards`). The journey page shows "X SPIN verified and ready" with nowhere to go.
> **Wedge rule**: never advertise what riders can't do. Ship the flow before any copy promises it.

## How claiming works today

- `useZKClaim.generateProof(sessionData)` needs **raw HR samples** (`heartRateSamples`, 1Hz) → Noir `effort_threshold` via Barretenberg (~8MB WASM, browser-only) → submit to `IncentiveEngine` on Fuji → ride marked `claimed` in history.
- `RideSummary` (localStorage/Supabase) stores **aggregates only** (`avgHeartRate`, `spinEarned`) — no samples. Raw telemetry lives in Walrus blobs (`spinchain:walrus:ride-blobs:v1`: rideId → blobId).

## Proposed flow (async, per ride)

```
Journey "Claim X SPIN" → wallet check → fetch Walrus blob → extract 1Hz HR
→ generateProof (progress UI: proving… submitting… confirming)
→ mark claimed → status chip flips to "Rewards claimed" → totals update
```

1. **Entry**: claim button on the Total Earned card (only when `claimableSpin > 0`) + per-ride "Claim" on rows with status `ready`. One dominant action per card.
2. **Preconditions**: wallet connected (else connect prompt — same `SESSION_SECRET` nonce flow), Walrus blob present (else row shows "telemetry unavailable", no button — never a dead end).
3. **Proving**: lazy-load prover on first claim only (never on page load — protects the 11MB client budget). Per-ride sequential, cancellable, survives tab backgrounding via the existing sync-queue pattern (`RideSyncQueueItem` + backoff).
4. **Batching**: claim rides one tx at a time initially (matches `submitZKProofBatch` chunking per ride); multi-ride batching only if gas benchmarks justify it.
5. **Failure**: `failed` status keeps the button with the error inline; retry reuses the blob (no re-ride needed).

## Scope (aggressive: no users, clean cut)

- New `useJourneyClaim(rideId)` hook wrapping `generateProof` + submit + history status update. Reuses `LocalProofResult`, `createDisclosure`, engine ABI — no new crypto.
- Journey UI: claim buttons + progress states. No changes to in-session finish-screen flow.
- Tests: unit (status transitions ready→claimed, blob-missing → no button), E2E extension of wedge-guard (claim button visible when a `ready` ride exists).
- Docs: flip this file to SHIPPED, update OPERATIONS E2E line.

## Out of scope

- Cross-ride single-tx batching, Yellow-channel claims from journey, gasless/sponsored claims.
