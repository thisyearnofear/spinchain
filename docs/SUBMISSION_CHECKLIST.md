# SpinChain: Sui Overflow 2026 Submission Checklist

**Deadline**: June 21, 2026 (build window closes). Demo Day Jul 20-21. Winners Aug 27.
**Target track**: Walrus Track (primary). Agentic Web / DeepBook / Entertainment & Culture are secondary submissions using the same code.

## Status snapshot (live)

- [ ] Sui CLI installed
- [ ] Move package upgraded/published on testnet with `anchor_telemetry_blob`
- [ ] `.env.local` re-pointed at new package ID
- [ ] End-to-end anchor flow verified on testnet
- [x] `pnpm typecheck` clean (was stale `tsconfig.tsbuildinfo` — deleted and re-ran, exit 0)
- [x] Tatum URL swap implemented (`app/sui-provider.tsx`, single-file fallback)
- [x] `.env.example` reconciled (added `NEXT_PUBLIC_TATUM_API_KEY` docs)
- [ ] Submission narrative drafted
- [ ] Demo video recorded
- [ ] Submitted to overflow.sui.io

## Pre-flight checklist for the move publish/upgrade

- [ ] Verify `SUI_PRIVATE_KEY` corresponds to `SUI_WALLET_ADDRESS` in `.env.local`
- [ ] Verify `SUI_UPGRADE_CAP_ID` matches an upgrade cap that the deployer owns
- [ ] Confirm decision: **upgrade** (preserves package ID 0xc42b32ab) vs **fresh publish** (new package ID)
