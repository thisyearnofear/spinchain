# SpinChain Production Roadmap

**Updated**: 2026-08-17

---

## Current State

SpinChain has a working ride engine: BLE telemetry, 3D visualization, AI coaching (rule-based + LLM), ZK proof rewards, Walrus-anchored telemetry, on-chain class contracts, Supabase-backed persistence, instructor-rider loop, and a personalized onboarding flow. Codebase is clean (0 TS errors, 1 lint warning, 132 tests passing, CI green).

**What's done**: Phases 0–3 complete (Supabase backend + wallet auth, instructor-rider loop, agentic AI insights), real ZK batch claims on Fuji, all 8 EVM contracts deployed + verified, Sui package v2 on testnet, Walrus persistence, ride history/analytics/badges, gym registry + calibration, ghost racing, Rive rider avatar slot (CSS fallback until `rider.riv` is exported).

**What's missing for users**: Vercel redeploy (live build is stale), Supabase provisioning on Vercel, browser-level E2E tests, testnet soft-launch validation.

---

## Scale Risks (Must Fix Before Features)

| Risk | Severity | Detail |
|------|----------|--------|
| localStorage as primary store | **High** | Ride history, profile, panel state, analytics events — all in localStorage. 200-ride cap is arbitrary. Data lost on browser clear. No sync conflict resolution. |
| Mocked instructor analytics | **High** | `attendanceRate: 0.85`, `repeatRiderRate: 0.35` — hardcoded. Revenue is `ticketsSold * 15` with no contract data. |
| No backend | **High** | API routes exist for AI but no persistent backend for rider-instructor relationships, homework, or progress tracking. Everything client-side or on-chain. |
| No auth | Medium | Wallet address is the only identity. No sessions, no access control for instructor vs. rider features. |
| 2 ESLint errors | Low | `use-rider-stats.ts` module-level mutable cache — works but fragile |
| 127 lint warnings | Low | Unused vars, unused catch errors — cosmetic |

---

## Phase 0: Backend Infrastructure ✅ Complete

**Goal**: Move from localStorage-primary to Supabase-primary with localStorage as cache only.

### Storage Tiering

| Tier | Store | What lives here |
|------|-------|----------------|
| 1. On-chain (Sui) | Already built | Class contracts, payments, reward claims, attendance |
| 2. Walrus blobs | Already built | Raw telemetry, coach prompts, share cards |
| 3. Supabase (Postgres) | **NEW** | Rider profiles, ride summaries, homework, progress, instructor-rider relationships, analytics aggregates |
| 4. localStorage | **Downgraded** | UI state only (panel positions, welcome dismissed, draft forms) |

### Auth: Wallet-Based

- User signs a nonce with their Sui wallet
- Backend verifies signature, issues JWT in httpOnly cookie
- JWT contains: `address`, `role` (rider/instructor), `expiresAt`
- Supabase RLS enforces: riders see own data, instructors see roster's data
- Role detection: `instructor` = has published >=1 on-chain class

### Steps

1. **Set up Supabase + schema + wallet auth** (3-4 days)
   - Tables: `rider_profiles`, `ride_summaries`, `homework_assignments`, `progress_snapshots`
   - `/api/auth/sui-login` endpoint with JWT middleware
   - RLS policies for rider/instructor access control

2. **Migrate ride history** (2-3 days)
   - `/api/rides` CRUD endpoints
   - `getRideHistory()` reads from Supabase, falls back to localStorage cache
   - `saveRideSummary()` writes to Supabase + Walrus (telemetry blob)
   - Zustand store stays synchronous — hydrate from Supabase on mount, write-through on save
   - One-time migration script: localStorage rides -> Supabase

3. **Migrate rider profile** (1-2 days)
   - Profile changes sync to Supabase `rider_profiles` table
   - Quiz completion writes to Supabase, not just localStorage

4. **Downgrade localStorage** (1 day)
   - Panel positions, welcome banner, class draft, analytics events -> stay in localStorage
   - Everything else -> Supabase

5. **Real instructor analytics** (1-2 days)
   - Replace mocked `attendanceRate` and `repeatRiderRate` with actual Postgres queries
   - Real revenue from on-chain ticket sales + Supabas joins

### Schema (Draft)

```sql
CREATE TABLE rider_profiles (
  address TEXT PRIMARY KEY,
  goal TEXT, experience TEXT, frequency TEXT, motivation TEXT,
  coach_personality TEXT, display_name TEXT,
  ftp INTEGER, max_hr INTEGER, resting_hr INTEGER,
  weight_kg DECIMAL(5,1), height_cm INTEGER,
  injuries JSONB DEFAULT '[]', training_zones JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ride_summaries (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE,
  rider_address TEXT REFERENCES rider_profiles(address),
  class_id TEXT, class_name TEXT, instructor TEXT,
  completed_at TIMESTAMPTZ, elapsed_time INTEGER,
  avg_effort INTEGER, avg_heart_rate INTEGER, avg_power INTEGER,
  effort_tier TEXT, zones JSONB,
  walrus_blob_id TEXT,
  sync_status TEXT DEFAULT 'synced',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE homework_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_address TEXT, rider_address TEXT, class_id TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(), due_at TIMESTAMPTZ,
  workout_config JSONB,
  status TEXT DEFAULT 'assigned',
  completed_at TIMESTAMPTZ,
  ride_id TEXT REFERENCES ride_summaries(id)
);

CREATE TABLE progress_snapshots (
  rider_address TEXT, snapshot_date DATE,
  avg_power_7d INTEGER, avg_effort_7d INTEGER,
  total_rides_7d INTEGER, streak_days INTEGER,
  ftp_estimate INTEGER,
  PRIMARY KEY (rider_address, snapshot_date)
);
```

---

## Phase 1: Fix the Foundation ✅ Complete

- **Fix 2 ESLint errors** in `use-rider-stats.ts` — replace module-level mutable cache with `useRef`
- **Clean 127 lint warnings** — `eslint --fix` + manual cleanup of unused vars, catch errors
- **Extend RiderProfile** with physical/biometric fields: FTP, maxHR, restingHR, weight, height, injuries, training zones
- **Adaptive difficulty** — adjust `getRecommendedDifficulty()` and `getRecommendedDuration()` based on ride history (avg effort trend, recent PRs) instead of static quiz answers

## Phase 2: Instructor-Rider Loop ✅ Complete

- **Rider roster view** ✅ — instructors see who attended, their progress over time (`/api/instructor/roster`, `InstructorRoster` component)
- **Homework assignment system** ✅ — instructor assigns a practice ride after class (`/api/homework` CRUD, `useInstructorHomework` hook, assign modal)
- **Post-class practice flow** ✅ — rider sees "Homework from your coach" on journey page (`RiderHomeworkCard` component)
- **Progress tracking between classes** ✅ — "Since your last class with [instructor], your avg power went from 180W to 205W" (`/api/progress/delta`, `useProgressDelta` hook, delta badges in roster)

## Phase 3: Agentic Intelligence ✅ Complete

- **Post-ride AI analysis** ✅ — LLM compares latest ride vs history, returns improvements, focus areas, tips, trend comparison (`/api/ai/ride-analysis`, `RideAnalysisCard`)
- **AI homework recommendations** ✅ — Generates practice workout from ride history + profile (`/api/ai/homework-recommendations`, `useHomeworkRecommendation` hook)
- **Instructor AI insights** ✅ — Analyzes roster: engagement, improvements, concerns, roster health (`/api/ai/instructor-insights`, `InstructorInsightsPanel`)
- **Personalized training plans** ✅ — Multi-week structured plans with daily workouts, progression, tips (`/api/ai/training-plan`, `TrainingPlanCard`)

## Phase 4: Scale (in progress)

- **Real contract data for analytics** ✅ — replaced mocked sparklines with real daily trend buckets from Supabase, real attendance/repeat rider rates wired into hook
- **Cross-gym support** ✅ — gym registry + bike calibration schema, `/api/gyms` CRUD API, `GymManager` UI with brand selection and per-gym power/HR offsets, telemetry normalization utilities
- **Revenue tracking** ✅ — `getAccumulatedRevenue` now queries Supabase ride_summaries instead of returning mock zeros, Kite settlement marked as pending stub
- **Load testing** — pending testnet deployment
- **Security audit** — pre-mainnet

---

## Remaining Pre-Launch Items

Carried over from previous remediation work:

- [x] Live telemetry integration in instructor yellow page (P1-4) — riders push HR/power/cadence via `/api/live-telemetry`, instructor page polls aggregated feed with per-rider table
- [x] End-to-end testing on Fuji testnet — `E2EFujiDeployment.t.sol` fork test + `scripts/e2e-verify-fuji.sh` verification script
- [x] Gas/performance validation for chunked ZK proofs on 45-min sessions — see benchmarks below
- [x] Resolve placeholder config values — SpinPack deployed (`0x2C8443...`), all 8 Fuji contracts verified. Kite SDK integrated (gokite-aa-sdk) — agent vault + AA wallet addresses set via env vars when deployed
- [x] Keep reward settlement and ride-summary anchoring status distinct across UI, storage, and relay flows — separate `getRideRewardStatus` / `getRideAnchoringStatus` functions, separate UI badges in journey page, separate settlement section in ride completion storage tab

From the 2026-08-17 launch-prep session:

- [x] Demo/mock data gated behind `NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG` (off by default) — curated classes, instructor-live demo metrics, fake leaderboard no longer reach production users
- [x] Walrus 400 spam eliminated — placeholder blob IDs (`practice-*`, `demo-*`) skip the aggregator fetch
- [x] NaN tangent guards in route visualizer (rider marker + camera follow)
- [x] Ride HUD polish — `tabular-nums` on all live numbers, mobile tap-to-expand restored, swipe/click conflict guard, chevron affordance, 7px→9px labels
- [x] Landing page perf — mousemove gradient now writes direct to DOM (no full-tree re-renders)
- [x] Reduced-motion support — `<MotionConfig reducedMotion="user">` app-wide
- [ ] **Redeploy Vercel from HEAD** — live site still serves the pre-`bfa6d6c6e` bundle with the broken `@noir-lang/backend_barretenberg` import (causes `[NoirProver] Initialization failed` for every ride start)
- [ ] **Provision Supabase** — create project, run `app/lib/supabase/schema.sql`, set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` locally + on Vercel. Until then all persistence/auth silently falls back to localStorage
- [ ] **Browser-level E2E tests** — wallet connect → class join → ride → ZK proof → claim; Supabase auth (nonce → sign → JWT); API routes (`/api/rides`, `/api/homework`, `/api/auth/*`)
- [ ] **Testnet soft-launch validation** — real users through the full loop on Fuji + Sui testnet
- [ ] UI/UX polish backlog (LOW): hero infinite pulse loop, `aria-label` on mobile HUD widget, scattered `transition-all` on low-frequency targets, `text-[8px]` labels on mobile
- [ ] Chainlink CRE — blocked on Early Access approval (ZK path is independent, not a launch blocker)
- [ ] Rive rider asset — export `rider.riv` per `public/rive/README.md` contract (HUD falls back to CSS orb until then)
- [ ] Load testing — pending testnet deployment
- [ ] Security audit — pre-mainnet

### Gas Benchmark Results (Foundry, mock verifier)

| Chunks | Ride Duration | Gas (batch) | Gas (individual) | Savings | Fuji Block Headroom |
|--------|--------------|-------------|-------------------|---------|---------------------|
| 1      | 5 min        | 159k        | 159k              | —       | 98%                 |
| 3      | 15 min       | 95k         | ~477k             | 80%     | 99%                 |
| 6      | 30 min       | 299k        | —                 | —       | 96%                 |
| 9      | 45 min       | 364k        | 492k              | 40%     | 95%                 |
| 12     | 60 min       | 442k        | —                 | —       | 94%                 |

- **Per-chunk cost** stabilizes at ~28k gas for batches of 3-9 chunks
- **45-min session** (9 chunks, realistic effort zones): 364k gas, avg effort 716, reward 71.47 SPIN
- **Worst case** (12 chunks, max effort 1000): 442k gas, 94% block headroom
- **All batch sizes fit comfortably within Fuji's 8M block gas limit**
- **Recommendation**: Use batch submission for rides >= 3 chunks; single proof for short sessions

### Test Commands

```bash
# Gas benchmarks
cd contracts/evm && forge test --match-contract ZKGasBenchmark -vvv --gas-report

# 45-min session simulation
cd contracts/evm && forge test --match-contract Session45MinSimulation -vvv --gas-report

# E2E deployment verification (forks Fuji)
cd contracts/evm && forge test --match-contract E2EFujiDeployment --fork-url fuji -vvv

# Manual verification script
./scripts/e2e-verify-fuji.sh
```

---

## Mainnet Migration Path (post-testnet)

When ready to leave testnet:

- [ ] Publish `spinsession.move` package to Sui mainnet (`sui client publish` with mainnet env) → update `NEXT_PUBLIC_SUI_PACKAGE_ID`
- [ ] Flip Walrus to mainnet: `NEXT_PUBLIC_WALRUS_NETWORK=mainnet` (aggregator `https://aggregator.walrus-mainnet.walrus.space`)
- [ ] Deploy `IncentiveEngine.sol` + supporting contracts to Avalanche C-Chain mainnet (replacing Fuji) → update all `NEXT_PUBLIC_*_ADDRESS` env vars
- [ ] Re-run the full claim flow end-to-end on mainnet (single + batched ZK proofs)
- [ ] Security audit of contracts before real-value deployment

---

## Session Log

### 2026-08-17 — Launch-prep: production bug fixes + UI/UX pass

**Production bugs reported by test users (ride start):**

- ✅ **NoirProver init failure** (`Failed to resolve module specifier '@noir-lang/backend_barretenberg'`) — root cause: the live Vercel build predates `bfa6d6c6e`, where the old code used `import(/* webpackIgnore: true */ '@noir-lang/backend_barretenberg')` and the browser couldn't resolve the bare specifier. Current HEAD already uses `@aztec/bb.js` UltraHonk. **Action left: redeploy Vercel from HEAD** — no code change needed.
- ✅ **Walrus 400 spam** (`aggregator.walrus-testnet.walrus.space/v1/blobs/practice-...`) — practice/demo classes carried fake blob IDs that were sent to the aggregator 3× before falling back. `resolveRouteForMetadata` now skips the fetch for `practice-*` / `demo-*` blob IDs (use-class-data.ts).
- ✅ **NaN tangent poisoning** (route-visualizer.tsx) — `getTangentAt` can return NaN near a closed curve's degenerate segments; previously NaN-poisoned the Trail buffer and permanently broke the camera follow lerp. Both paths now guard with `Number.isFinite`.

**Demo data out of production:**

- ✅ New `DEMO_MODE` flag in `app/config.ts` driven by `NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG` (defaults to **off**).
- ✅ Curated fake classes (Coach Atlas / Dr. Spin / Coach Nova / Zen Master) no longer show when the chain has no classes — rider page gets the real empty state instead.
- ✅ Instructor live page: hardcoded metrics, benchmark, revenue, conversion copy, and fake leaderboard all gated; real telemetry/leaderboard API data or zeros/empty states otherwise.
- ✅ `.env.local` keeps the flag on for local dev; production stays clean.

**UI/UX pass (make-interfaces-feel-better + emil-design-eng + impeccable skills installed in `.agents/skills/`):**

- ✅ `tabular-nums` on every live-updating number (MetricCard, mobile compact/expanded values, ghost lead/lag, multi-ghost gap badges, top-bar reward ticker, ride-progress stats) — 10Hz telemetry no longer shifts layout.
- ✅ MetricCard value: `transition-all` → `transition-colors` (no transitions on a text node).
- ✅ Mobile compact HUD: tap now expands/collapses (expanded state was previously unreachable dead code), swipe still cycles the metric, click-after-swipe guard added, chevron affordance on collapsed state.
- ✅ Landing page: mousemove gradient now writes straight to the DOM via ref — no more full React tree re-render per mouse move.
- ✅ `<MotionConfig reducedMotion="user">` in providers — all framer-motion animations respect the OS reduce-motion preference.
- ✅ Ghost gap label bumped 7px → 9px.

**Remaining (priority order):**

1. **Redeploy Vercel from HEAD** — fixes the Noir error users see right now.
2. **Provision Supabase** — create project, run `app/lib/supabase/schema.sql`, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and Vercel env vars. Until then ride history / profiles / homework / auth fall back to localStorage (data loss risk).
3. **Verify `NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG` stays unset on Vercel** (defaults to off; `.env.local` has it true for dev).
4. **Browser-level E2E tests** — wallet connect → class join → ride → ZK proof → claim; Supabase auth (nonce → sign → JWT); API routes (`/api/rides`, `/api/homework`, `/api/auth/*`).
5. **LOW UI polish backlog** — hero infinite pulse loop (`scale [1,1.02,1]` repeating), `aria-label` on the mobile HUD widget button, ~19 `transition-all` on low-frequency targets (top-bar/bottom-panel/tutorial), 14× `text-[8px]` labels (fine on desktop, borderline on mobile).
6. **Rive rider asset** — export `rider.riv` per the contract in `public/rive/README.md` (HUD renders a CSS fallback orb until then).
7. **Testnet soft-launch** — real users through the full loop on Fuji + Sui testnet.
8. **Chainlink CRE** — blocked on Early Access approval; ZK path works independently (not a blocker).

Commits: `7eb30e2` (Walrus + NaN fixes), `533bd6b` (Rive slot), `88c2ca0` (HUD numbers + mobile expand), `6fd96b3` (demo flag), `17c2108` (landing perf), `8c3112b` (reduced motion).
