# SpinChain

SpinChain is a Next.js + Capacitor prototype for AI-assisted spin classes, dual-chain reward settlement experiments, and privacy-preserving fitness telemetry.

Current state: testnet/demo stage. The app is not ready for general users yet.

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
| **ZK Prototype** | Noir effort-threshold circuit for short telemetry windows |

---

## Status

- Launch readiness: not ready
- Network posture: Avalanche Fuji + Sui testnet
- Data posture: some user-facing screens still fall back to mock/demo data
- Reward path: chunked ZK batch claims are wired, but configured verifier/engine validation is still incomplete
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
- **ZK**: Noir circuits, UltraPlonk verifier
- **AI**: Venice AI and Gemini integrations

---

## License

MIT © 2026 SpinChain Protocol
