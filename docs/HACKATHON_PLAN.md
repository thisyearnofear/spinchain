# SpinChain: Hackathon Submission Plan

**Created**: 2026-06-03
**Status**: Active
**Network posture**: Testnet (Sui testnet, Walrus testnet, Avalanche Fuji). Mainnet staged after hackathon results.

This document is the source of truth for the hackathon workstream. It captures both submissions we are preparing, the changes each one needs, and how those changes stay aligned with our Core Principles.

## Core Principles (re-stated, in priority order)

1. **ENHANCEMENT FIRST** — extend existing modules, never parallel-implement
2. **CONSOLIDATION** — delete unnecessary code, not just deprecate
3. **PREVENT BLOAT** — audit + consolidate before adding
4. **DRY** — single source of truth for shared logic
5. **CLEAN** — explicit separation of concerns and dependencies
6. **MODULAR** — composable, testable, independent
7. **PERFORMANT** — adaptive loading, caching, resource optimization
8. **ORGANIZED** — predictable, domain-driven file structure

Every change in this plan is measured against the principles above. Tatum integration is the canonical example: a *config-layer* change (one URL, one env var) rather than a new client, SDK, or abstraction.

## Hackathons

| Hackathon | Track | Window | Why we fit | Status |
|---|---|---|---|---|
| [Sui Overflow 2026](https://overflow.sui.io/) | Walrus Track ($35K 1st) | Build May 7 – Jun 21, 2026. Demo Day Jul 20-21. Winners Aug 27. | We already store route GPX, ride summaries, and AI-generated narrative on Walrus. We have real Move contracts (`spinsession.move`, `spin_token.move`) and a deployed Sui package on testnet. The AI Coach agent has an explicit `system_prompt_cid` field for agent memory on Walrus. | **Primary** |
| [Tatum × Walrus](https://tatum.io/tatum-x-walrus-hackathon) | Best Walrus Integration ($200) + Best Tatum Tools ($200) | May 23 – Jun 6, 2026. ~2 weeks. | Same Walrus app, re-pointed at Tatum's Sui RPC. Tatum's MCP server is a clean fit for the AI Coach integration. | **Submit (low marginal cost)** |

Both submissions use the same on-disk code. The only thing that changes between them is which Sui RPC URL the app talks to and which problem statement we narrate against.

## Tatum compatibility — not a deviation, an enhancement

A common misread is that a Tatum integration means adding `@tatumio/tatum` to `package.json`. It does not, and adding it would be a deviation:

1. `@tatumio/tatum` does not currently ship a Sui client (the Tatum SDK lists EVM chains, Solana, Tron, etc., but no Sui network class).
2. Tatum's Sui gateways (`https://sui-mainnet.gateway.tatum.io`, `…testnet…`, `…devnet…`) are plain JSON-RPC endpoints. Any Sui client that accepts a URL works.
3. Our entire Sui client is built in one place: `app/sui-provider.tsx` with `createNetworkConfig` and `getFullnodeUrl`. That is the only call site.

The Tatum integration is therefore a **single-file URL swap**, not a new client, not a new SDK, not a new abstraction:

```ts
// app/sui-provider.tsx — the only place Sui RPC URLs are constructed
const TATUM_KEY = process.env.NEXT_PUBLIC_TATUM_API_KEY;
const tatumUrl = (network: "testnet" | "mainnet" | "devnet" | "localnet") =>
  TATUM_KEY ? `https://sui-${network}.gateway.tatum.io` : undefined;

const { networkConfig } = createNetworkConfig({
  localnet: { url: tatumUrl("localnet") ?? "http://127.0.0.1:9000" },
  devnet:   { url: tatumUrl("devnet")   ?? "https://fullnode.devnet.sui.io:443" },
  testnet:  { url: tatumUrl("testnet")  ?? "https://fullnode.testnet.sui.io:443" },
  mainnet:  { url: tatumUrl("mainnet")  ?? "https://fullnode.mainnet.sui.io:443" },
});
```

Setting `NEXT_PUBLIC_TATUM_API_KEY` routes every read and write through Tatum. Leaving it unset falls through to Mysten's defaults. No other file changes for the RPC swap.

The optional Tatum MCP server wrapper (encouraged by Tatum judges for AI features) becomes one new file: `app/lib/tatum/client.ts`, a thin typed wrapper around the Tatum MCP endpoints. This is additive and isolated — it does not touch the Walrus client, the Sui engine, or the EVM stack.



## File-level change list

Total: **8 files modified, 1 file created, 0 files deleted.** No parallel implementations.

| File | Action | Purpose | Principle |
|---|---|---|---|
| `app/sui-provider.tsx` | Modify | Tatum URL fallback when env var set | DRY (single Sui RPC source), ENHANCEMENT FIRST |
| `app/lib/walrus/types.ts` | Modify | Add mainnet aggregator URL; env-overridable | ENHANCEMENT FIRST, ORGANIZED |
| `app/lib/walrus/ride-persistence.ts` | Modify | Add `linkWalrusBlobToRiderStats()` helper | ENHANCEMENT FIRST |
| `app/engines/sui-engine.ts` | Modify | After `flushTelemetry`, optionally store batched blob to Walrus and call `attach_telemetry_blob` | MODULAR, ENHANCEMENT FIRST |
| `app/config.ts` | Modify | Add `WALRUS_NETWORK`, `TATUM_ENABLED` config | DRY, ORGANIZED |
| `.env.example` | Modify | Document `NEXT_PUBLIC_TATUM_API_KEY`, `NEXT_PUBLIC_WALRUS_NETWORK` | CLEAN |
| `contracts/move/spinchain/sources/spinsession.move` | Modify | Add `walrus_blob_id`/`walrus_epoch` to `RiderStats`; new `attach_telemetry_blob` entry + event; optional `walrus_blob_id` on `Coach` | ENHANCEMENT FIRST, MODULAR |
| `app/lib/tatum/client.ts` | **Create** | Thin typed wrapper around Tatum MCP for AI Coach integration | MODULAR, CLEAN |
| `app/api/rides/walrus/route.ts` | (no change) | Already exists | — |
| `app/lib/walrus/client.ts` | (no change) | Already exists | — |
| `contracts/move/spinchain/sources/spin_token.move` | (no change) | Not relevant to Walrus | — |

## Implementation phases

### Phase 1 — Tatum Sui RPC swap (2–3 hours)

Goal: every Sui read/write transparently routes through Tatum's gateway when `NEXT_PUBLIC_TATUM_API_KEY` is set.

- [ ] Modify `app/sui-provider.tsx` to add the Tatum URL fallback
- [ ] Add `NEXT_PUBLIC_TATUM_API_KEY` to `.env.example` and `.env.local.template`
- [ ] Smoke test: connect a Sui wallet, verify in browser devtools that reads go to `sui-testnet.gateway.tatum.io`
- [ ] (Optional) Create `app/lib/tatum/client.ts` for the MCP server wrapper

**Acceptance criteria:**
- With key unset, behavior is identical to today
- With key set, all Sui JSON-RPC calls hit Tatum's gateway
- No new npm dependencies, no new client instances

### Phase 2 — Walrus-as-Memory on Sui Move (the main Walrus Track work)

Goal: make the Walrus ↔ Move linkage concrete. Every Walrus blob stored by the app can be referenced from a Move object, and every AI Coach can persist its decision history to Walrus.

**Status (2026-06-21): DEPLOYED on testnet.** Package `0x51542d1d4b43763d58e6f91f845f63157d5fc59bd95ead54dc370b0898d1185c`
is at version 2 on Sui testnet and contains the `TelemetryAnchor` struct, `TelemetryBlobAttached` event,
and `anchor_telemetry_blob` entry function. `NEXT_PUBLIC_SUI_PACKAGE_ID` is already pointed at this package.
End-of-ride telemetry is uploaded to Walrus and a `TelemetryAnchor` object is minted on-chain with the blob ID.

**Why a new object instead of extending `RiderStats`:** the package is already published (v1) with
an upgrade cap, and Sui forbids changing an existing struct's layout on upgrade. We therefore anchor
via a **new, upgrade-safe `TelemetryAnchor` object** + standalone entry fn + event, rather than
adding fields to `RiderStats`. The anchor is end-of-ride only — the per-point streaming path
(`SuiEngine.flushTelemetry`) is plumbed but intentionally not revived here.

**2a. New `TelemetryAnchor` object + entry fn** (upgrade-safe, added to `spinsession.move`)

```move
struct TelemetryAnchor has key, store {
    id: UID,
    rider: address,
    class_id: String,     // String, not ID: practice/class IDs aren't always valid object IDs
    blob_id: String,      // Walrus blob ID
    epoch: u64,           // Walrus storage epoch (commitment)
    point_count: u64,
    anchored_at: u64,
}

public entry fun anchor_telemetry_blob(
    class_id: String, blob_id: String, epoch: u64,
    point_count: u64, timestamp: u64, ctx: &mut TxContext
) {
    let rider = tx_context::sender(ctx);
    let anchor = TelemetryAnchor { id: object::new(ctx), rider, class_id, blob_id, epoch, point_count, anchored_at: timestamp };
    event::emit(TelemetryBlobAttached { anchor_id: object::id(&anchor), rider, class_id: anchor.class_id, blob_id: anchor.blob_id, epoch });
    transfer::transfer(anchor, rider);
}
```

**2b. AI Coach memory** (`Coach` struct decision log) — still future work, not built in this phase.

**2c. Frontend glue** (implemented)

- `SuiEngine.anchorTelemetryBlob()` (`app/engines/sui-engine.ts`) builds the `anchor_telemetry_blob`
  move call; surfaced through `coordinator` → `useRideCoordinator.anchorSuiTelemetry`.
- Ride page (`app/rider/ride/[classId]/page.tsx`) wires the Sui wallet (`useSuiClient` /
  `useCurrentAccount` / `useSignAndExecuteTransaction`) and, on ride complete, `await`s the Walrus
  upload's blob ID then submits one anchor tx, re-saving the summary's `anchoring` field with the
  tx digest/status.
- Package-ID drift removed: `app/sui-provider.tsx` now re-exports `SUI_CONFIG.packageId` as the
  single source of truth.

**Acceptance criteria:**
- After a ride (wallet connected), the rider owns a `TelemetryAnchor` object whose `blob_id` matches
  the Walrus upload
- The blob is retrievable from Walrus by anyone with the ID
- A `TelemetryBlobAttached` event is emitted on Sui testnet
- The saved `RideSummary.anchoring` records the anchor tx digest and `"confirmed"`/`"failed"` status

**Deploy (user-run — needs Sui CLI + a rotated deployer key):**
```
cd contracts/move/spinchain && sui move build
sui client upgrade --upgrade-capability <SUI_UPGRADE_CAP_ID>
# then set NEXT_PUBLIC_SUI_PACKAGE_ID to the new package ID
```

### Phase 3 — Submission packaging

- [ ] Record a 2–3 minute demo video (script in `docs/SUBMISSION_WALRUS_TRACK.md`)
- [x] Write the Walrus Track submission narrative (problem statement, solution, architecture, what is verifiable, what's on testnet)
- [x] Tatum × Walrus submission (deadline Jun 6 — passed, same codebase)
- [ ] Submit to Sui Overflow 2026 (deadline Jun 21)
- [ ] Publish the demo video link in the submission form

### Phase 4 — Mainnet preparation (post-hackathon, optional but unlocks 100% prize)

> "If a winning team has already deployed their project to mainnet by the time winners are announced in August, they will receive 100% of the prize upfront."

Required for the 100% payout:

- [ ] Publish `spinsession.move` to Sui mainnet (`sui client publish` with mainnet env)
- [ ] Flip `app/lib/walrus/types.ts` aggregator to Walrus mainnet (`https://aggregator.walrus-mainnet.walrus.space`)
- [ ] Deploy `IncentiveEngine.sol` and supporting contracts to Avalanche C-Chain mainnet (replacing Fuji)
- [ ] Re-test the full claim flow end-to-end on mainnet

This phase is staged separately so the hackathon submission is not blocked on it. We stay on testnet during the build period by design.

## Submission narratives (drafts)

### Sui Overflow 2026 — Walrus Track

> SpinChain is a dual-engine fitness protocol where AI coaches run real-time biometric sessions and reward riders on chain. Sui is our high-frequency performance layer (10Hz telemetry into Move `RiderStats` objects). Walrus is our verifiable data and memory layer: every ride summary, every AI coach system prompt, and every coach decision is stored as a Walrus blob, with the blob ID anchored on a Sui `RiderStats` or `Coach` object.
>
> We are not adding Walrus as a wrapper — we use it as the primary store for high-volume, low-cost data that would be uneconomical to keep on chain, while the on-chain objects stay small and reference verifiable Walrus blobs. The Coach agent in particular uses Walrus as its persistent memory: system prompts and decision logs live in Walrus, so a coach's behavioral history is verifiable, composable, and survives a wallet migration.

### Tatum × Walrus

> SpinChain uses Walrus for ride summaries, route GPX, and AI Coach system prompts, and uses Tatum's Sui RPC gateway to read/write the on-chain `RiderStats` and `Coach` objects. The AI Coach integrates Tatum's MCP server for typed access to chain state alongside the Walrus aggregator for the agent's memory layer.

## Risk register

| Risk | Mitigation |
|---|---|
| Tatum Sui RPC has a method we use that the gateway does not implement | Smoke-test the full telemetry flush flow on Tatum testnet before submission; fall back to Mysten defaults by unsetting the env var |
| Walrus mainnet aggregator URL not yet stable | Phase 4 is opt-in; testnet submission is the goal. We do not require mainnet Walrus for the Walrus Track story |
| Move struct extension breaks existing Sui objects | The new fields are `Option<...>` and additive only. Existing on-chain `RiderStats` objects migrate automatically because the struct change is forward-compatible |
| `submitZKProofBatch` on Avalanche still uses `MockUltraVerifier` on testnet | The Walrus Track story does not depend on the EVM verifier. The plan keeps the existing `MockUltraVerifier` posture (documented in `DEPLOYMENT.md`) and stays on testnet |

## References

- Sui Overflow 2026: https://overflow.sui.io/
- Sui Overflow handbook: https://mystenlabs.notion.site/overflow-2026-handbook
- Tatum × Walrus hackathon: https://tatum.io/tatum-x-walrus-hackathon
- Walrus docs: https://docs.walrus.site/
- Tatum Sui endpoints: https://sui-mainnet.gateway.tatum.io (and `…testnet…`, `…devnet…`)
