# SpinChain Production Roadmap

**Updated**: 2026-06-23

---

## Current State

SpinChain has a working ride engine: BLE telemetry, 3D visualization, AI coaching (rule-based + LLM), ZK proof rewards, Walrus-anchored telemetry, on-chain class contracts, and a personalized onboarding flow. The codebase is clean (0 TS errors, 0 new lint warnings after DRY consolidation).

**What's done**: Dual-chain integration, ZK batch claims with real Noir proofs, Walrus persistence, rider quiz + personalized hero, ride history with effort tiers/zones/streaks/badges, post-ride comparison, data ownership dashboard, instructor class builder, instructor analytics (mocked), AI coach personalities, ghost racing.

**What's missing**: Persistent backend, instructor-rider loop, homework system, agentic insights, biometric personalization.

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

- [ ] Live telemetry integration in instructor yellow page (P1-4)
- [ ] End-to-end testing on Fuji testnet with real verifier + engine addresses
- [ ] Gas/performance validation for chunked ZK proofs on 45-min sessions
- [x] Resolve placeholder config values — SpinPack deployed (`0x2C8443...`), all 8 Fuji contracts verified. Only Kite agent passport remains undeployed (pending Kite SDK integration)
- [ ] Keep reward settlement and ride-summary anchoring status distinct across UI, storage, and relay flows
