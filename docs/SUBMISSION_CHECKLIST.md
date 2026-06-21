# SpinChain: Sui Overflow 2026 Submission Checklist

**Deadline**: June 21, 2026 (build window closes). Demo Day Jul 20-21. Winners Aug 27.
**Target track**: Walrus Track (primary). Agentic Web / DeepBook / Entertainment & Culture are secondary submissions using the same code.

## Status snapshot (live)

- [x] Sui CLI installed (v1.73.1, testnet tag — replaces brew's protocol-version-stale v1.73.0)
- [x] Move package upgraded on testnet: v1 → v2 (commit 350668558, gas 0.047 SUI)
  - New package ID: `0x51542d1d4b43763d58e6f91f845f63157d5fc59bd95ead54dc370b0898d1185c`
  - `anchor_telemetry_blob` confirmed live via JSON-RPC inspection
- [x] `.env.local` re-pointed at new package ID
- [x] `.env.example` re-pointed
- [x] `Published.toml` updated (preserves `original-id`, advances `published-at`)
- [x] `pnpm typecheck` clean (was stale `tsconfig.tsbuildinfo` — deleted and re-ran, exit 0)
- [x] Tatum URL swap implemented (`app/sui-provider.tsx`, single-file fallback)
- [x] `.env.example` updated with `NEXT_PUBLIC_TATUM_API_KEY` docs
- [x] Submission narrative drafted (`docs/SUBMISSION_WALRUS_TRACK.md`)
- [x] End-to-end anchor flow verified on testnet via sui CLI call (tx `GBQRG544QKNTvqXmioTTaKEdQjr5spCSj1ryv6NSE8ML`, TelemetryBlobAttached event emitted, `TelemetryAnchor` object owned by deployer)
- [x] Animation & motion audit complete (CSS transitions, GPU-friendly transforms, `prefers-reduced-motion` support)
- [x] UI click sounds via Web Audio API (`use-ui-click-sound.ts`)
- [x] Toast notifications with Framer Motion enter/exit
- [x] Route visualizer: mouse parallax + gentle camera drift
- [x] Fallback data for empty states (`CURATED_CLASSES`, `EmptyState` component)
- [x] One-click "Watch Demo Ride" CTA on landing page + final CTA (auto-starting demo route)
- [x] Ride HUD polish: compact top bar, keyboard hints on simulator start, compact widget drag bar, always-visible progress bar
- [ ] Rider identity in ride HUD (name, avatar, streak) — in progress
- [ ] Demo video recorded
- [ ] Submitted to overflow.sui.io

## Build gates (all green)

- `pnpm typecheck` → 0 errors
- `pnpm test` → 132 / 132 passing across 7 test files
- `pnpm build` → "Compiled successfully", 16/16 static pages
- `sui move build` → exit 0, only warnings
- Live anchor `sui client call --function anchor_telemetry_blob` → tx success, 0.003 SUI gas
- Live event `suix_queryEvents MoveEventType=…::TelemetryBlobAttached` → 1 event, expected shape

## Pre-flight checklist for the move publish/upgrade

- [x] `SUI_PRIVATE_KEY` corresponds to `SUI_WALLET_ADDRESS` in `.env.local`
- [x] `SUI_UPGRADE_CAP_ID` (`0x146219a2…`) owned upgrade-cap for `0x98144f86…`
- [x] Decision: **upgrade** executed (preserves original-id; advances published-at to `0x51542d…`)

## What changed in the v2 upgrade

**Additive (allowed by Sui upgrade rules):**
- `spinsession::anchor_telemetry_blob` — entry fn for Walrus-as-memory
- `spinsession::TelemetryAnchor` (struct) — owned object linking rider → Walrus blob
- `spinsession::TelemetryBlobAttached` (event) — emitted on anchor
- `spin_token` module — entirely new module (was never published as v1; added in v2)
- `spin_token::TreasuryManager` shared object + buyback/burn/deposit entry fns

**Restored (was in v1, got dropped in intermediate edits):**
- `spin_token::claim_for_bridge` (entry, 4-param)
- `spin_token::mint_reward` (entry, 6-param, no `manager`)

**Removed (consolidation, per project Core Principles #2 and #3):**
- `tier_benefits.move` — never published, never imported, pure aspirational code
- DeepBook integration fns in `spinsession.move` — `framework/testnet` restructured
  the deepbook package (no `balance_manager` / `pool` modules at the top level).
  Re-introducing real DeepBook integration is post-hackathon work. The `Coach`
  struct's `balance_manager_id: Option<ID>` field was also removed (additive field
  additions to existing on-chain structs are not allowed by Sui upgrade rules).

## Verification commands

```bash
# Confirm the new package is live
curl -X POST https://fullnode.testnet.sui.io:443 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"sui_getNormalizedMoveModulesByPackage","params":["0x51542d1d4b43763d58e6f91f845f63157d5fc59bd95ead54dc370b0898d1185c"],"id":1}' \
  | jq '.result.spinsession.exposedFunctions | keys'

# Should include "anchor_telemetry_blob"

# Run a test anchor tx from the deployer
sui client call \
  --package 0x51542d1d4b43763d58e6f91f845f63157d5fc59bd95ead54dc370b0898d1185c \
  --module spinsession \
  --function anchor_telemetry_blob \
  --args \
    '""' \
    '"test_blob_id_'"$(date +%s)"'"' \
    '90' \
    '0' \
    "$(date +%s%N | cut -c1-13)" \
  --gas-budget 10000000

# Then query the resulting TelemetryAnchor object owned by the deployer
sui client objects --address 0x9018a50508af247c8ef949a6fd6522fc0b7f6652a9d07a2b108d748728f7b73f
```

## Final state — ready to submit

All build gates green. All Walrus Track integration points live on testnet:

| Component | State | Evidence |
|---|---|---|
| `anchor_telemetry_blob` Move fn | Deployed (v2) | `sui_getNormalizedMoveModulesByPackage` returns it |
| `TelemetryAnchor` object | Mintable | smoke-test tx `GBQRG544QKNTvqXmioTT…` minted one owned by deployer |
| `TelemetryBlobAttached` event | Emitted | `suix_queryEvents` returns 1 event with expected shape |
| Tatum RPC swap | Implemented | `app/sui-provider.tsx` single-file fallback, `NEXT_PUBLIC_TATUM_API_KEY` documented in `.env.example` |
| Next.js app | Builds | `pnpm build` exit 0, 16/16 static pages |
| TypeScript | Clean | `pnpm typecheck` exit 0, 0 errors |
| Unit tests | Green | `pnpm test` 132 / 132 passing |
| Submission narrative | Drafted | `docs/SUBMISSION_WALRUS_TRACK.md` |
| Package ID | Live | `0x51542d1d4b43763d58e6f91f845f63157d5fc59bd95ead54dc370b0898d1185c` (Sui testnet) |

## Remaining for you (human)

1. **Record the demo video** (2-3 min). Script is in `docs/SUBMISSION_WALRUS_TRACK.md` §"Demo Video Script".
2. **Fill in the submission form fields** at https://overflow.sui.io:
   - Project name: `SpinChain`
   - One-liner: from `SUBMISSION_WALRUS_TRACK.md` §"One-Line Description"
   - Description: paste the §"Submission narrative (paste-ready, ≤ 1000 chars)" block
   - GitHub URL
   - Demo video URL
   - Live demo URL (optional)
3. **Press submit before June 21, 2026** end-of-day.
4. **Optional but unlocks 100% prize payout**: deploy Move package to Sui mainnet before Aug 27 (per Overflow handbook §prize terms).
