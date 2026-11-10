# Docs

Index for the SpinChain documentation. Each doc has one job; none competes with the wedge.

## Core docs (active set)

| # | Doc | One job |
|---|-----|---------|
| 1 | [WEDGE.md](./WEDGE.md) | The product wedge + guardrails. Every feature decision passes through it. |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical reference: foreground engines, renderer, world system, background (chain/verification/storage). |
| 3 | [PROGRESSION.md](./PROGRESSION.md) | The rank ladder (Spark→Singularity), XP store, world unlocks, placement rules. |
| 4 | [THEME-PIPELINE.md](./THEME-PIPELINE.md) | How interval phases map to visual themes and the reactive renderer layer. |
| 5 | [SKILLS-PLAN.md](./SKILLS-PLAN.md) | The coach skill loop: play→call→replay→coach→train→match. |
| 6 | [OPERATIONS.md](./OPERATIONS.md) | Local dev, scripts, env, deployment, observability. |
| 7 | [WORLD-SYSTEM.md](./WORLD-SYSTEM.md) | The world/mode system, the (done) branch migration, asset slots, resolution. |

## Background / infrastructure docs (active set)

| Doc | One job |
|---|---------|
| [ARCHITECTURE.md §1–§2](./ARCHITECTURE.md) | Foreground engines + background: receipt-first, verification provider, wallet, privacy phases 1–5. |
| [PHASE-5-PILOT.md](./PHASE-5-PILOT.md) | Phase-5 contract deployment + dogfood evidence (Fuji 43113). |
| [ACHIEVEMENT-REDEEMER-V2.md](./ACHIEVEMENT-REDEEMER-V2.md) | `AchievementRedeemerV2` / `ClaimRegistry` contracts + redeem flow. |
| [cloud-ride.md](./cloud-ride.md) | Cloud ride / private sync / consent design. |
| [ride-lab.md](./ride-lab.md) | Ride telemetry, ride lab, instructor tooling. |
| [SERV_HACKATHON_EDITION_02.md](./SERV_HACKATHON_EDITION_02.md) | SERV Hackathon Ed. 02 entry plan (Kite track) — coach agents as budgeted spenders; due Nov 15, 2026. |
| [CHARACTER-SYSTEM.md](./CHARACTER-SYSTEM.md) | Characters (Atlas + books), assistant, coach voice, guild lore. |
| [DEMO.md](./DEMO.md) | 3-minute "holy shit" demo script. |
| [THEME-PIPELINE.md](./THEME-PIPELINE.md) | Theme production pipeline. |

## Legacy / superseded

| Doc | Status |
|---|---|
| [grants/](./grants/) | Legacy grant applications (team1). Superseded. |
| [plans/wedge-contract-research.md](./plans/wedge-contract-research.md) | Evidence base. Already linked from IMPLEMENTATION-PLAN. |
| [plans/journey-claim-flow.md](./plans/journey-claim-flow.md) | Receipt-first recovery detail. Already linked. |

## By need

- Running the app locally → [GETTING-STARTED.md](./GETTING-STARTED.md)
- Writing a new feature → WEDGE.md, then ARCHITECTURE.md
- Reviewing a refactor → WEDGE.md guardrails + IMPLEMENTATION-PLAN.md tasks
- On-chain receipts → PHASE-5-PILOT.md + ACHIEVEMENT-REDEEMER-V2.md
- Deploying / Vercel / env → OPERATIONS.md
- Architecture decisions → [ADR/](./ADR/) (see [ADR-001-receipt-first](./ADR/ADR-001-receipt-first.md))

## House rules

1. **One job per doc.** If a doc makes a subsystem the headline, move it (see root README: [The Wedge](./docs/WEDGE.md)).
2. **Rider language only.** No "ZK", "ERC", "hook", "agent", "chain" on rider surfaces ([WEDGE.md → Rider-Facing Language Only](./docs/WEDGE.md)).
3. **Receipt-first is the spine.** Foreground ride → local durable `RideReceiptV1` → optional settlement. "Progress saved" ≠ "verification pending" ≠ "redemption confirmed."
4. **A claim about live/on-chain status must be traceable** to code, deployment, or a transaction. Spec the address, chain, campaign ID, and block.
