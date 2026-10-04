# SpinChain

SpinChain is a Next.js + Capacitor prototype for AI-assisted spin classes: effort drives real-time world/flow/coaching changes in the foreground, with optional future achievement settlement in the background.

Current state: testnet/demo stage, live on Vercel at https://spinchain.vercel.app/ (application release `a3c7e37` deployed 2026-10-04). Direction approved 2026-10-04: **receipt-first architecture** — ride completion and progression are saved independently of any chain; value-bearing redemption is an optional, separately-approved future layer. The app is not ready for general users: public personal-data publication is disabled in the live phase-1 build and real-bike launch stays blocked pending consent controls and legal review.

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
| **BLE + Mobile Foundation** | Capacitor setup and BLE integration scaffolding |
| **On-Chain Prototype** | Avalanche/Sui contract integration with testnet config |
| **ZK Proofs** | Real Noir effort-threshold circuit with Barretenberg backend — generates browser-side ZK proofs |

---

## Status

- Launch readiness: not ready — general real-bike launch stays blocked until privacy/consent controls and a legal review are done (2026-10-04)
- Network posture: Avalanche Fuji + Sui testnet for existing experiments; no chain migration planned
- Direction: receipt-first. Foreground ride → completion/progression saved locally → optional private account sync → optional future campaign settlement. Three separate ledgers: local runtime, private account progression, optional settlement. "Progress saved", "verification pending", and "redemption confirmed" are never interchangeable.
- Local hardening (deployed 2026-10-04 as application release `a3c7e37`): session-bound wallet auth, owner-scoped ride persistence, CTA-by-address routing, Noir beta.22 compatibility, receipt-status correctness, plus phase-1 public-write boundary + `RideReceiptV1` — verified locally (366 unit tests / 42 files + 10 Foundry real-verifier tests; final combined browser run interrupted)
- Production known-broken: the deployed EffortThresholdVerifier wrapper forwards the wrong public-input slice (reverts on real proofs); the underlying Honk verifier accepts them. No redeploy/adapter is the next step — settlement redesign comes first.
- Persistence: private Supabase account sync exists session-gated; the `summary jsonb` column was applied to production Supabase (`avcihfixqlofvkpvwmiq`) on 2026-10-04 (additive, nullable). Public telemetry/profile/coach-memory publication is disabled in the live phase-1 build. localStorage is device-local and NOT encrypted.
- ZK proofs: real Noir `effort_threshold` circuit + UltraHonk backend prove only three public outputs (`threshold_met`, `seconds_above`, `effort_score`); class/rider/threshold/min-duration are attached metadata, not proven inputs. ZK is an optional future privacy layer over issuer-bound commitments — no trustless physical-effort claims.
- Demo data: gated behind `NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG` (off by default)
- Reward path: live claims are not approved — the deployed wrapper rejects real proofs and the app-side legacy-claim gate (`NEXT_PUBLIC_ENABLE_LEGACY_REWARD_CLAIMS`, Fuji-only) deployed with production set to `false`. Future bounded campaigns would use a signed `RideReceipt`/nullifier redeemer (AchievementRedeemerV2, design phase 4)
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
- [ ] Phase 2: private account save/outbox/recoverable jobs + granular consent (cloud history, third-party AI/voice/instructor live view, public achievement export are separate consents)
- [ ] Phase 3: explicit verification-provider interface/provenance; studio/wearable pilot before any CRE/zkTLS adoption; third-party AI/TTS biometric context needs the same user consent
- [ ] Phase 4: AchievementRedeemerV2 design + tests (signed receipt + nullifier redeemer); no numeric payout promises
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
- **Mobile**: Capacitor 5.7, BLE plugin
- **ZK**: Noir circuits, Barretenberg backend (UltraHonk proving), on-chain Honk verifier
- **AI**: Venice AI, NVIDIA NIM (MiniMax-M3), and Gemini 3.0 Flash with multi-provider fallback (Venice → NVIDIA → Gemini) — third-party AI/TTS receive biometric context; granular consent controls are PLANNED (phase 2), so no overall privacy-ready claim
- **Storage**: Walrus (route/world assets; personal-data writes disabled in the live phase-1 build)

---

## License

MIT © 2026 SpinChain Protocol
