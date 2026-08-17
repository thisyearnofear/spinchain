# SpinChain

SpinChain is a Next.js + Capacitor prototype for AI-assisted spin classes, dual-chain reward settlement experiments, and privacy-preserving fitness telemetry.

Current state: testnet/demo stage, live on Vercel at https://spinchain.vercel.app/. The app is not ready for general users yet.

---

## Quick Start

```bash
pnpm install
cp .env.local.template .env.local
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000)

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

- Launch readiness: not ready (testnet stage; live Vercel build is stale — redeploy pending)
- Network posture: Avalanche Fuji + Sui testnet
- ZK proofs: real Noir circuit (`effort_threshold`) with Barretenberg/UltraHonk backend generates browser-side ZK proofs; on-chain verifier deployed to Fuji
- Demo data: gated behind `NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG` (off by default) — production shows only real on-chain classes and real telemetry/leaderboard data
- UI polish: tabular-nums on all live HUD numbers, mobile HUD tap-to-expand restored, reduced-motion support app-wide, landing mousemove no longer re-renders React
- Reward path: chunked ZK batch claims wired with real on-chain verification; Chainlink CRE fallback documented (pending Early Access)
- Builder flow: unified into single progressive builder (wizard removed); wallet connection prompted at publish step
- Verification: build + lint + 132 unit tests green; browser-level E2E still missing
- Persistence: Supabase code complete; **instance not yet provisioned** (falls back to localStorage until env vars are set)

---

## Documentation

| Doc | Description |
|-----|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Dual-engine design, ZK privacy, tech stack |
| [Getting Started](docs/GETTING_STARTED.md) | Local setup, current flows, testing, troubleshooting |
| [Features](docs/FEATURES.md) | Implemented features vs. planned features |
| [Deployment](docs/DEPLOYMENT.md) | Testnet deployment notes and current release blockers |
| [Production Roadmap](docs/PRODUCTION_ROADMAP.md) | Current launch blockers and launch checklist |

---

## Before User Launch

- [x] Remove mock/demo class fallbacks from user-facing flows — gated behind `NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG` (off by default; curated classes, instructor-live demo metrics, fake leaderboard only show when the flag is true)
- [x] Replace placeholder and zero-value addresses in runtime config — all 8 Fuji contracts deployed with real addresses; zero-values guarded via `isZeroAddress`
- [x] Complete real verifier + engine deployment and testnet claim validation — E2E Fuji fork tests + `scripts/e2e-verify-fuji.sh` passing
- [ ] Add coverage and operational validation for chunked ZK reward claims — gas benchmarks done; browser-level E2E of the full claim loop still missing
- [ ] Add reliable verification gates and release checklists — CI has lint/typecheck/test; needs E2E + a release checklist runbook

**Remaining blockers (2026-08-17):**

1. **Redeploy Vercel from current HEAD** — the live deployment is stale (pre-`bfa6d6c6e`) and still ships the broken `@noir-lang/backend_barretenberg` import, causing `[NoirProver] Initialization failed` for every user starting a ride. Current code uses `@aztec/bb.js` and is verified to build.
2. **Provision Supabase** — create project, run `app/lib/supabase/schema.sql`, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` locally and on Vercel. Without it, ride history/profiles/homework/auth silently fall back to localStorage.
3. **E2E happy-path tests** — wallet connect → class join → ride → ZK proof → claim; Supabase auth (nonce → sign → JWT); API routes.
4. **Chainlink CRE** — blocked on Early Access approval; ZK path works independently, not a launch blocker.
5. **Testnet soft-launch** — validate the full loop with real users on Fuji/Sui testnet.

## Security

```bash
# Verify hook is installed
./scripts/setup-hooks.sh

# Emergency bypass
git commit --no-verify
```

---

## Tech Stack

- **Blockchain**: Avalanche (EVM), Sui (Move), Chainlink CRE (pending Early Access)
- **Frontend**: Next.js 16, React Three Fiber, Tailwind CSS
- **Mobile**: Capacitor 5.7, BLE plugin
- **ZK**: Noir circuits, Barretenberg backend (UltraPlonk proving), on-chain Honk verifier
- **AI**: Venice AI, NVIDIA NIM (MiniMax-M3), and Gemini 3.0 Flash with multi-provider fallback (Venice → NVIDIA → Gemini)
- **Storage**: Walrus (verifiable data layer for ride telemetry, route GPX, AI coach memory)

---

## License

MIT © 2026 SpinChain Protocol
