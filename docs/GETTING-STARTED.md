# Getting Started

How to run SpinChain locally, run the test suite, and navigate the repo.

## Prerequisites

- **Node 20+** (matching `engines` in `package.json`)
- **pnpm** 9+ (`npm i -g pnpm` or use corepack)
- **Git** (with the repo hooks installed)
- Optional: **Foundry** (Forge) for contract tests; **WSL/Git Bash** for WSL-style tooling
- Optional: **Ollama** (for local LLM fallback — see `PRIVACY.md` note below)

## 1. Clone & install

```bash
git clone <repo> spinchain && cd spinchain
pnpm install
cp .env.local.template .env.local
```

If your `.env.local` is not committed (it is not), copy `.env.example` and fill in only the values you need.

## 2. Start the app

```bash
pnpm run dev        # http://localhost:3210
```

Open `http://localhost:3210/rider/ride/demo?mode=practice&demo=true&auto=true` to skip straight to the wedge (no wallet needed).

## 3. Run the tests

```bash
pnpm run test       # vitest (unit + component tests)
pnpm run test:e2e   # Playwright (visual regression + user flows)
pnpm run typecheck  # tsc --noEmit
pnpm run lint       # ESLint
./scripts/setup-hooks.sh   # install git hooks (secret detection + prettier)
```

The marriage of the full suite is `pnpm run test && pnpm run test:e2e`.

## 4. Run the contract suite

```bash
cd contracts/evm
forge test -vv
forge script src/deploy-phase5-pilot.s.sol --rpc-url fuji --broadcast   # phase-5 pilot (testnet only)
```

> Forked EVM tests require a local Anvil node with a funded FUJI account. See `scripts/` for the helper.

## 5. Environment variables

Copy `.env.local.template` → `.env.local` and set:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect project (boots Wagmi/RainbowKit) |
| `REDEEMER_ISSUER_PRIVATE_KEY` | Issuer key for pilot redeem (testnet only) |
| `NEXT_PUBLIC_ACHIEVEMENT_REDEEMER_ADDRESS` | Phase-5 redeemer address (if pilot unflagged → leave empty) |
| `PILOT_REDEEM_ENABLED` | Toggle phase-5 redeem UI (`"true"`/`"false"`) |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | AI model routing (coach, agent) |
| `NEXT_PUBLIC_VENICE_API_KEY` etc. | Multi-provider AI provider keys |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Cloud ride sync (private account sync) |

Never commit `.env.local`. The pre-commit hook blocks secret patterns.

## 6. Project shape

```text
app/                Next.js App Router: /rider, /instructor, /admin, /agent, /api
app/engines/        Core TS engines (Telemetry, EventBus, RideCoordinator) — no hooks
app/lib/            domain logic: progression, themes/worlds, verification providers, analytics
app/stores/         Zustand stores (ride, progress, auth)
app/components/     React components (caller-owned, screen-aware)
contracts/evm/      Forge: ClaimRegistry, AchievementRedeemerV2, PilotSpinToken, redeems
contracts/move/     Sui Move contracts (route/world assets)
circuits/effort_threshold/  Noir effort-threshold circuit + Barretenberg proof generation
tests/              vitest + Playwright specs
docs/               this index + all feature docs (see README)
```

## 7. First-time onboarding checklist

- [ ] `pnpm install` succeeds
- [ ] `pnpm run dev` boots on 3210
- [ ] Demo ride loop works without a wallet (`?mode=practice&demo=true&auto=true`)
- [ ] `pnpm run test` + `pnpm run test:e2e` green locally
- [ ] `pnpm run typecheck` clean
- [ ] Git hooks installed (`./scripts/setup-hooks.sh`)
