# SpinChain

SpinChain is a Next.js + Capacitor prototype for AI-assisted spin classes: effort drives real-time world/flow/coaching changes in the foreground, with optional future achievement settlement in the background.

Current state: testnet/demo stage, live on Vercel at https://spinchain.vercel.app/. Direction approved 2026-10-04: **receipt-first architecture** — ride completion and progression are saved independently of any chain; value-bearing redemption is an optional, separately-approved future layer. Phase 2 (granular consent + durable outbox) and phase 4 (`AchievementRedeemerV2` design + tests) landed on main 2026-10-07, and the `rider_consents` production migration was applied the same day — consent enforcement is live. The app is not ready for general users: real-bike launch stays blocked pending legal review and real-device validation.

---

## The Wedge

> **SpinChain makes indoor cycling addictive by turning physical effort into real-time visual transformation in a 3D world.**

Every feature decision, UI change, and refactor must reference [docs/WEDGE.md](./docs/WEDGE.md). It defines what we build in the foreground (the core loop) vs. the background (infrastructure/moats). When in doubt, read the wedge doc before implementing.

---

## Quick Start

```bash
pnpm install
cp .env.local.template .env.local
pnpm run dev
```

Open [http://localhost:3210](http://localhost:3210)

---

## Current Scope

| Feature | Description |
|---------|-------------|
| **Rider + Instructor UI** | Landing, rider, instructor, route builder, and analytics screens |
| **Wallet Integration** | EVM wallet connection via RainbowKit/Wagmi |
| **Route Visualization** | GPX and route-preview flows with themed class cards |
| **BLE + Mobile Foundation** | Capacitor setup, bike pairing from the ride start screen (Web Bluetooth + native), WebGL→2D fallback when the GPU can't run |
| **On-Chain Prototype** | Avalanche/Sui contract integration with testnet config |
| **ZK Proofs** | Real Noir effort-threshold circuit with Barretenberg backend — generates browser-side ZK proofs |

---

## Status

- Launch readiness: not ready — general real-bike launch stays blocked until a legal review is done and real-device validation passes (consent controls are live)
- Network posture: Avalanche Fuji + Sui testnet for existing experiments; no chain migration planned
- Direction: receipt-first. Foreground ride → completion/progression saved locally → optional private account sync → optional future campaign settlement. Three separate ledgers: local runtime, private account progression, optional settlement. "Progress saved", "verification pending", and "redemption confirmed" are never interchangeable.
- Phase 2 (merged 2026-10-07): four granular consents (`cloud_history`, `ai_voice`, `instructor_live`, `public_export`, all off by default, `consent-v1` policy version) enforced client- and server-side, plus a durable outbox (`spinchain:outbox:v1`) that retries cloud-history uploads instead of dropping them. Production migration `app/lib/supabase/migrations/20261007_rider_consents.sql` applied 2026-10-07 — consent enforcement is live.
- Local hardening (deployed 2026-10-04 as application release `a3c7e37`): session-bound wallet auth, owner-scoped ride persistence, CTA-by-address routing, Noir beta.22 compatibility, receipt-status correctness, plus phase-1 public-write boundary + `RideReceiptV1` — verified locally (506 unit tests / 53 files + Foundry real-verifier tests)
- Production known-broken: the deployed EffortThresholdVerifier wrapper forwards the wrong public-input slice (reverts on real proofs); the underlying Honk verifier accepts them. No redeploy/adapter is the next step — settlement redesign comes first.
- Persistence: private Supabase account sync exists session-gated (now behind the `cloud_history` consent) and durable outbox; the `summary jsonb` column was applied to production Supabase (`avcihfixqlofvkpvwmiq`) on 2026-10-04 (additive, nullable). Public telemetry/profile/coach-memory publication is disabled. localStorage is device-local and NOT encrypted.
- ZK proofs: real Noir `effort_threshold` circuit + UltraHonk backend prove only three public outputs (`threshold_met`, `seconds_above`, `effort_score`); class/rider/threshold/min-duration are attached metadata, not proven inputs. ZK is an optional future privacy layer over issuer-bound commitments — no trustless physical-effort claims.
- Demo data: gated behind `NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG` (off by default)
- Reward path: live claims are not approved — the deployed wrapper rejects real proofs and the app-side legacy-claim gate (`NEXT_PUBLIC_ENABLE_LEGACY_REWARD_CLAIMS`, Fuji-only) deployed with production set to `false`. Future bounded campaigns would use a signed `RideReceipt`/nullifier redeemer — `AchievementRedeemerV2` + `ClaimRegistry` design and Foundry tests merged 2026-10-07 (docs/ACHIEVEMENT-REDEEMER-V2.md), deliberately not deployed
- Verification: build + typecheck + unit tests + desktop/mobile Playwright + real-verifier Foundry tests

---

## Documentation

| Doc | Description |
|-----|-------------|
| [WEDGE](docs/WEDGE.md) | The wedge: effort → visual transformation. Feature discipline, guardrails, anti-examples. **Read first.** |
| [IMPLEMENTATION-PLAN](docs/IMPLEMENTATION-PLAN.md) | Phased, actionable plan aligned to the approved receipt-first direction. |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Foreground engine/renderer facts plus the ledger/privacy boundary model. |
| [OPERATIONS](docs/OPERATIONS.md) | Local setup, test commands, production preflight findings, dogfooding checklist. |
| [DEMO](docs/DEMO.md) | 3-minute pitch script (standalone). |
| [Contract research](plans/wedge-contract-research.md) | Evidence base for the approved receipt-first direction (2026-10-04). |
| [Journey claim flow](plans/journey-claim-flow.md) | Receipt-first recovery phases (V1 record vs future claim). |
| [Contract deploy](contracts/DEPLOY.md) | Retired default deployment; operator-guarded testnet plan only. |

---

## Before User Launch

Phase gates per the approved plan (see IMPLEMENTATION-PLAN):

- [x] Phase 1 (deployed 2026-10-04, `a3c7e37`): disabled the covered public personal-data publishing paths (telemetry, ride summaries, rider profiles, coach memory, Sui ride telemetry/anchors); completed rides save locally with a durable `RideReceiptV1`; plaintext publishing is blocked in code
- [x] Apply the `summary jsonb` migration to production Supabase (applied 2026-10-04, additive, nullable)
- [x] Phase 2 (merged 2026-10-07): private account save/outbox/recoverable jobs + granular consent (cloud history, third-party AI/voice/instructor live view, public achievement export are separate consents) — `20261007_rider_consents.sql` applied to production Supabase 2026-10-07; consent enforcement is live
- [ ] Phase 3: explicit verification-provider interface/provenance; studio/wearable pilot before any CRE/zkTLS adoption; third-party AI/TTS biometric context needs the same user consent
- [x] Phase 4 (merged 2026-10-07): AchievementRedeemerV2 + ClaimRegistry design + Foundry tests (signed receipt + nullifier redeemer); no numeric payout promises; deployment gated on phase 5
- [ ] Phase 5: real-verifier benchmarks, boundary matrix, local full loop, documented migration, operator-approved testnet deployment, integrated production dogfood on testnets
- [ ] Reviews are separate concerns, all pending before monetization: (a) EDPB privacy — minimization, retention, erasure (encrypted data is still personal data); (b) Apple platform rules — 3.1.1 digital-goods/NFT, 5.1 third-party AI/health-sharing consent; (c) jurisdictional financial review for any tradable/cash reward. No health/diagnostic claims without validation. Details: `plans/wedge-contract-research.md` §§5–7.

## Security

```bash
# Verify hook is installed
./scripts/setup-hooks.sh
```

The hook blocks accidental secret commits — do not bypass it; fix the flagged content.

---

## Tech Stack

- **Blockchain**: Avalanche (EVM), Sui (Move), Chainlink CRE (pending Early Access)
- **Frontend**: Next.js 16, React Three Fiber, Tailwind CSS
- **Mobile**: Capacitor 8.5, BLE plugin
- **ZK**: Noir circuits, Barretenberg backend (UltraHonk proving), on-chain Honk verifier
- **AI**: Venice AI, NVIDIA NIM (MiniMax-M3), and Gemini 3.0 Flash with multi-provider fallback (Venice → NVIDIA → Gemini) — third-party AI/TTS receive biometric context behind the `ai_voice` consent (implemented and live in production; legal review pending, so no overall privacy-ready claim)
- **Storage**: Walrus (route/world assets; personal-data writes disabled in the live phase-1 build)

---

## License

MIT © 2026 SpinChain Protocol
