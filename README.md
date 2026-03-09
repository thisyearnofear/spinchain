# SpinChain: The Dual-Engine Fitness Protocol

SpinChain combines **Avalanche** settlement with **Sui** parallel execution to enable AI-powered fitness classes with real-time biometric telemetry and ZK privacy.

---

## Quick Start

```bash
pnpm install
cp .env.local.template .env.local
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Dual-Engine** | Avalanche (settlement) + Sui (10Hz telemetry) |
| **AI Instructors** | Autonomous agents with dynamic pricing (Uniswap v4) |
| **Route Worlds** | 3D WebGL visualization from GPX data |
| **ZK Privacy** | Prove effort without revealing raw biometrics |
| **Guest Mode** | Try demo rides without wallet or hardware |
| **Mobile BLE** | Native iOS/Android via Capacitor |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  EVM (Avalanche)          │  Sui (Testnet)              │
│  ├─ SpinClass NFT         │  ├─ Session (shared)        │
│  ├─ Ticket purchase       │  ├─ RiderStats (owned)      │
│  ├─ SPIN rewards          │  ├─ Telemetry events (10Hz) │
│  └─ ZK verification       │  └─ Story beat events       │
└─────────────────────────────────────────────────────────┘
```

**Chainlink CRE** orchestrates decentralized biometric verification using Confidential HTTP to fetch private wearable data without exposing it on-chain.

---

## Documentation

| Doc | Description |
|-----|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Dual-engine design, ZK privacy, tech stack |
| [Getting Started](docs/GETTING_STARTED.md) | Setup, onboarding, testing, troubleshooting |
| [Features](docs/FEATURES.md) | AI, routes, mobile/BLE, agentic finance |
| [Deployment](docs/DEPLOYMENT.md) | Contracts, Sui, ZK verifier, mobile apps |

---

## Security

Pre-commit hook blocks secret commits (API keys, private keys, `.env.*` files).

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
- **AI**: Venice AI (default), Gemini 3 (fallback)

---

## License

MIT © 2026 SpinChain Protocol
