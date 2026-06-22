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

- Launch readiness: not ready (testnet/demo stage)
- Network posture: Avalanche Fuji + Sui testnet
- ZK proofs: real Noir circuit (`effort_threshold`) with Barretenberg backend generates browser-side ZK proofs; on-chain verifier deployed to Fuji
- UI polish: demo data on instructor live page labeled as "Preview Mode"; phase tags removed from UI; SpinPack labeled as preview
- Reward path: chunked ZK batch claims wired with real on-chain verification; Chainlink CRE fallback documented
- Builder flow: unified into single progressive builder (wizard removed); wallet connection prompted at publish step
- Verification: build and lint should be treated as required release gates

---

## Documentation

| Doc | Description |
|-----|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Dual-engine design, ZK privacy, tech stack |
| [Getting Started](docs/GETTING_STARTED.md) | Local setup, current flows, testing, troubleshooting |
| [Features](docs/FEATURES.md) | Implemented features vs. planned features |
| [Deployment](docs/DEPLOYMENT.md) | Testnet deployment notes and current release blockers |
| [Production Roadmap](docs/PRODUCTION_ROADMAP.md) | Current launch blockers and launch checklist |
| [Hackathon Plan](docs/HACKATHON_PLAN.md) | Sui Overflow 2026 (Walrus Track) + Tatum × Walrus submissions, file-level change list, and phasing |

---

## Before User Launch

- Remove mock/demo class fallbacks from user-facing flows
- Replace placeholder and zero-value addresses in runtime config
- Complete real verifier + engine deployment and testnet claim validation
- Add coverage and operational validation for chunked ZK reward claims
- Add reliable verification gates and release checklists

## Security

```bash
# Verify hook is installed
./scripts/setup-hooks.sh

# Emergency bypass
git commit --no-verify
```

---

## Tech Stack

- **Blockchain**: Avalanche (EVM), Sui (Move), Chainlink CRE
- **Frontend**: Next.js 16, React Three Fiber, Tailwind CSS
- **Mobile**: Capacitor 5.7, BLE plugin
- **ZK**: Noir circuits, Barretenberg backend (UltraPlonk proving), on-chain Honk verifier
- **AI**: Venice AI, NVIDIA NIM (MiniMax-M3), and Gemini 3.0 Flash with multi-provider fallback (Venice → NVIDIA → Gemini)
- **Storage**: Walrus (verifiable data layer for ride telemetry, route GPX, AI coach memory)

---

## License

MIT © 2026 SpinChain Protocol
