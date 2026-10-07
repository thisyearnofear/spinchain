# SpinChain: Implementation Plan — Wedge-First

> **Created**: 2026-08-17 — restructured 2026-10-04 around the approved receipt-first direction
> **Purpose**: Concrete tasks to enforce wedge discipline. Each task maps to a guardrail in [WEDGE.md](./WEDGE.md).
> **Status**: Active — receipt-first direction approved 2026-10-04
> **Read first**: [WEDGE.md](./WEDGE.md) defines the wedge and guardrails. This plan converts them into tasks.

---

## Guiding Principle

> Perfect the one loop (effort → visual transformation → dopamine) before expanding to the platform.
> Every task below must pass the wedge guardrails. If it doesn't, it doesn't go in this plan.

---

## Current Plan — Receipt-First (approved 2026-10-04)

Supersedes the old week-numbered timeline and the historical phases below. Evidence: [plans/wedge-contract-research.md](../plans/wedge-contract-research.md). Recovery detail: [plans/journey-claim-flow.md](../plans/journey-claim-flow.md). Phase headings record both code state and deployment state.

### Phase 0 — Reliability fixes (DEPLOYED 2026-10-04, `a3c7e37`)

Session-bound EVM wallet auth (nonce → `personal_sign` → HMAC cookie), owner-scoped ride persistence (insert-first + conflict-scoped update, 403 on identity mismatch), CTA-by-address routing, Noir beta.22 runtime compatibility, `useTransaction` receipt-status correctness. Verified locally: 301 unit + 6 browser tests + 10 Foundry real-verifier tests. **Deployed as part of `a3c7e37`; claims not approved.**

### Phase 1 — Privacy boundary: stop public personal-data writes (DEPLOYED 2026-10-04, `a3c7e37`; user browser/real-device feedback pending)

Local gate evidence: 366 unit tests across 42 files pass; `tsc --noEmit` clean; production build green under the isolated Playwright env; ESLint 0 errors (7 warnings). The final combined browser run was interrupted; remaining browser checks are user-owned on the live deployment (real-device feedback pending).

- Hard-disable public personal-data writes: telemetry, ride summaries, rider profiles, coach memory, Sui ride telemetry/anchors. Public world/route asset publishing is preserved.
- Prevent automatic proof generation on ride stop; save the completed ride locally BEFORE background work; attach a durable `RideReceiptV1` (interface in [ARCHITECTURE §2](./ARCHITECTURE.md)).
- Historical records preserved — no destructive cleanup; legacy reads stay migration-only and auth-owner-scoped.
- Block publishing instead of env-opting into existing plaintext paths; raw-data encryption/consent pipeline is explicitly NOT in this phase.
- File areas: ride completion/summary persistence (`app/lib/analytics/*`), receipt builder (`RideReceiptV1` type + derivation), write gates on telemetry/summary/profile/coach-memory/Sui-anchor call sites, journey/history status rendering.
- Acceptance: a completed ride persists locally with a durable receipt BEFORE background work; zero public personal-data requests and zero automatic proof/chain writes fire in browser E2E (negative privacy gates); legacy reads remain owner-scoped; local rule-based coach memory and shipped assets unchanged.

### Phase 2 — Private account sync + consent (implemented + prod migration applied 2026-10-07)

- Private account save/outbox/recoverable jobs; durable pending proof/receipt state independent of the finish screen.
- Granular, separate consents: cloud history, third-party AI/voice, instructor live view, public achievement export.
- Account auth beyond EOA (passkeys/embedded wallets) later; no smart-wallet compatibility promise on the existing EOA path.

### Phase 3 — Verification-provider interface + pilot (planned)

- Explicit verification-provider interface with provenance classes; studio/wearable pilot before any CRE/zkTLS adoption.
- Same user consent required before claiming privacy-ready for LLM coaching context and personalized TTS.
- General real-bike launch stays blocked until controls + audit; no medical/diagnostic claims.

### Phase 4 — AchievementRedeemerV2 design + tests (implemented 2026-10-07; design + tests only, no deploy)

Issuer auth; recipient/session/class + policy binding; EIP-712 domain (version/chain/contract); stable consumed nullifier; lifetime expiry; per-campaign and per-user budgets; gas-payer allowlist; incident pause + signer rotation with governance policy. Semantic replay registry survives verifier changes. Initial signed receipts carry honest SpinChain-issuer trust; a later ZK envelope may bind proof to the same receipt. Scoring/economics/ABI remain a separately approved spec — no numeric payout promises.

### Phase 5 — Validation then operator-approved testnet deployment (code complete 2026-10-07; deploy pending)

Measured real-verifier benchmarks (legacy "364k/45min" figures used MockVerifier and are not real-verifier measurements; real Honk `verify` ≈1.19M gas, `redeem` ≈142k — `Phase5Benchmark.t.sol`), contract boundary matrix, local full loop, documented migration, then operator-approved testnet deployment and an integrated production dogfood pass on testnets.

Implemented: Fuji deploy script (`deploy-phase5-pilot.s.sol`), issuer signing route `POST /api/redeem/sign` (session auth → synced-ride policy → EIP-712), journey-page redeem flow behind `NEXT_PUBLIC_PILOT_REDEEM_ENABLED`, local redemption store, vitest coverage. Full spec/runbook: `docs/PHASE-5-PILOT.md`. Remaining: operator deploy + dogfood.

### Parked / gates

- Yellow channels, sui-native earning, Uniswap pricing: parked until a funded use case exists.
- Class access: one ERC-1155 registry vs per-class ERC-721 evaluated only if a portable entitlement need appears; no NFT gating of digital features absent an Apple policy review; token ownership is not a legal route-IP claim; creators are human/AI names, not autonomous economic counterparties by default.
- Chainlink CRE: new docs still require deployment approval; repository workflow is mockRequest + placeholder wearable URL — not a deploy toggle. Avalanche ACP-209 is Proposed, not proof of Fuji 7702 support.
- The 10-rider "want again" signal is a qualitative product hypothesis, not statistical evidence.


---

## Historical: shipped wedge phases (record, not current priorities)

The phases below shipped before the receipt-first re-plan and are kept for context. They are not the current roadmap.

## Historical Phase 1: Surface The Game ✅ COMPLETE (shipped wedge work)

**All tasks done.** Gamification now visible on the front door. One primary CTA dominates. Class grid is secondary.

### 1.1 Add Gamification Bar To Rider Landing Page ✅
- **Commit**: `6c005f1` — `app/components/features/common/gamification-bar.tsx`
- Shows streak 🔥, total rides, best power, flow minutes
- Empty state: "Start your first ride to unlock streaks, milestones, and flow tracking"

### 1.2 Distill Rider Landing — One Primary CTA ✅
- **Commit**: `222d96c` — `app/rider/page.tsx` + `app/components/features/common/primary-cta.tsx`
- Before: 7+ competing CTAs causing analysis paralysis
- After: ONE dominant action — green "Start Demo Ride" (disconnected) or accent "Your Next Class" (connected)
- Class grid collapsed behind "Browse All Classes" accordion
- Removed: WelcomeBanner, OnboardingChecklist, GuestDemoClass section

### 1.3 Personalize The Rider Hero ✅
- **Commit**: `6c005f1` — `app/rider/page.tsx` + `app/components/features/rider/rider-hero.tsx`
- Greeting logic: streak > flow > generic
- Shows: "Good to see you — 3 day streak 🔥" or "You've logged 85m in flow — time to build on that?"

### 1.4 Remove Network Status Banner From Rider Landing ✅
- **Commit**: `6c005f1` — `app/rider/page.tsx`
- Removed `NetworkStatusBanner` — infrastructure belongs on admin page, not rider landing

---

## Historical Phase 2: Perfect The Demo Ride

**Goal (historical)**: Make the demo ride the best gamified indoor cycling session anyone has ever experienced. Even with a keyboard. Delight lives *inside* the ride — see `ARCHITECTURE.md §1` (only two curated moments: sprint=beam, flow=unlock).

### 2.1 Cut The Demo Ride To Under 30 Seconds
- **File**: `app/rider/page.tsx` → `getDemoRideUrl()` + `app/rider/ride/[classId]/page.tsx`
- **What**: Current flow: landing → connect wallet (or skip) → select class → preview route → start ride. New flow: landing → click "Try Demo Ride" → 3s activation → riding.
- **Why**: [30-second rule](./WEDGE.md#the-core-loop-must-be-under-30-seconds)
- **Implementation**:
  - Direct link to demo ride URL bypasses class selection
  - Auto-select the demo class
  - Skip wallet check
  - Skip quiz (show it after first ride)
  - Auto-start activation sequence

### 2.2 Polish The Activation Sequence ✅
- **Live path**: `ActivationTransition` in `ride-transition-overlay.tsx` (not orphan `ride-activation.tsx`)
- **What**: Ceremony polish on the live overlay:
  - Route thumbnail behind countdown with subtle parallax during reveal (`routeThumbnailForTheme` + existing `/images/routes/*`)
  - Countdown numbers pulse; GO flash dissolves into the 3D world
  - Haptic/SFX ticks + GO stinger retained; prefers-reduced-motion → simple fade, no parallax
  - No double countdown / no pedal delay after GO
- **Why**: First impressions compound. A weak activation undercuts the visual magic that follows.
- **Not in scope**: New mechanics. Polish existing ones. Do not redo Phase 6/7 viz keep-alive / world-reactivity math.

### 2.3 Make The Demo Ride World Feel Alive ✅
- **Live path**: `PedalSimulator` (`← → / A D`, also ↑↓/WS auto-alternate) → `coordinator.ingestSimulatorMetrics` via ModalStack. Single keyboard→stats source.
- **Removed orphan**: `use-demo-effort.ts` (W/S hold-to-effort model) was never imported; deleted so copy and input schemes cannot diverge.
- **Test**: In demo mode, alternate ← → (or A D) — world should visibly respond (particles, road glow, flow badge) within ~1s of pedaling.

### 2.5 Coach As In-Ride Presence ✅ SHIPPED 2026-09-25
- **Files**: `app/engines/coaching-engine.ts`, `app/engines/coordinator.ts`, `app/engines/audio-engine.ts`, `app/lib/walrus/coach-memory.ts` (new)
- **What**: The coach now reacts to live effort, not just the script:
  - Pacing cues when power sits outside the interval's target band for 15s (once per interval, per direction)
  - Encouragement after 45s holding the band during work phases
  - Adaptive difficulty *suggestions*: ease off when anaerobic reserve (W'bal) drops under 20% mid-interval; push more when consistently overpowering with a full tank (once per ride). Suggestions only — no automatic resistance changes.
  - 20s minimum gap between engine cues so the coach never nag-stacks
  - All output routes through `coaching:message` / `coaching:sound`; AudioEngine now subscribes to `coaching:sound` (previously a dead channel) and the TTS voice follows the class's coaching personality
- **Cross-session memory**: Walrus coach blobs (`coach-memory.ts`, system_prompt_cid pattern). Loaded at ride start → factual welcome-back line ("Ride 4 on record — last ride you averaged 182 watts…"). Saved at ride end (averages + completion + best-power note). Pointer per rider+coach in localStorage; local cache is offline fallback only, flagged `pendingSync`. No fake familiarity: no memory, no greeting.
- **Scale flag**: the pointer should move on-chain (Sui Coach struct) or to Supabase for multi-device sync — localStorage pointer is single-browser only.

### 2.6 Data-Driven Theme Pipeline ✅ SHIPPED 2026-09-24
- **Files**: `app/lib/themes/registry.ts` (new), `world-reactivity.ts`, `route-visualizer.tsx`, Supabase `visualizer_themes` table, `docs/THEME-PIPELINE.md`
- **What**: World reactivity derives from `computePhaseTheme()` (no parallel color table); adding an environment is a SQL INSERT into `visualizer_themes`, not a redeploy. Built-ins always win over remote rows; invalid rows fall back to neon.

### 2.7 Coach-Built Class (Agentic Builder) ✅ SHIPPED 2026-09-26
- **Files**: `app/lib/agent/class-composer.ts` (new), `app/lib/agent/agent-class-store.ts` (new), `app/lib/agent/resolve-ride-plan.ts` (new), `app/instructor/agent/page.tsx` (new), `app/rider/ride/[classId]/page.tsx`, `app/hooks/ride/use-practice-config.ts`, `app/lib/contracts.ts`, `app/hooks/instructor/use-class-draft.ts`
- **What**: One shared authoring primitive — `composeClass(intent)` turns { goal, duration, coach voice, world } into a complete class: a `WorkoutPlan` with per-interval power bands and personality-voiced cues, an environment (any theme registry name, built-in or Supabase-remote), and route parameters. Human instructors and AI coaches emit the same class shape through the same primitive.
- **Plan travels with the class**: the ride page no longer hardcodes `PRESET_WORKOUTS[1]` — it resolves `?plan=<presetId>` → stored coach-built plan for the classId → default preset.
- **Flow**: `/instructor/agent` (linked from instructor dashboard) — pick goal/length/coach/world → live class preview → "Ride it now" (practice ride, no wallet) or "Open in class builder" (pre-fills the instructor draft, `mode: "agentic"` — the previously unused draft mode).
- **Theme type widened**: `EnhancedClassMetadata.route.theme` is now `string` (theme registry name; unknown names render as neon), so remote themes are valid class environments.
- **Deterministic by design**: no LLM keys required; LLM-authored cues (e.g. `/api/ai/synthesize-workout`) can replace the line banks later without changing the emitted shape.
- **Scale flag**: coach-built classes hand off via localStorage (same pattern as the instructor draft). Durable storage needs a Supabase `classes`/`class_plans` table — provisioning follow-up, not built here.

### 2.4 Add Milestone Pop-Up On First Achievement ✅
- **Commit**: `pending` — `app/rider/ride/[classId]/page.tsx`
- **What**: Real-time milestone detection during ride. When the rider hits their first milestone (e.g., "1 minute in flow"), show a celebratory pop-up with the milestone badge.
- **Why**: Dopamine hit. This is the moment the rider realizes "I'm actually doing something." Strava's segment badges, Duolingo's streak fire, Fortnite's first kill — all are momentary celebrations.
- **Design**: 2-second pop-up with emoji badge, respects reduced-motion.
- **Uses**: Existing milestone definitions from `app/lib/milestones.ts`
- **Implementation**:
  - Added `useEffect` that checks for milestones at each minute boundary during the ride
  - Tracks shown milestone IDs to avoid duplicate pop-ups in the same ride
  - Shows the highest-value new milestone (sorted by tier: bronze < silver < gold < platinum < diamond)
  - Auto-dismisses after 2 seconds via `setShowMilestone(null)`
  - Uses existing `MilestoneOverlay` component in modal stack

---

## Historical Phase 3: Language Cleanup ✅ COMPLETE (shipped)

**All tasks done.** Infrastructure language removed from rider-facing UX.

### 3.1 Rewrite Coach Cards ✅
- **Commit**: `pending` — `app/rider/page.tsx`
- Renamed `agenticPowers` → `specialties` (values were already good cycling terms)
- Removed "AI-Powered" badge from coach cards

### 3.2 Remove "Preview" Badges ✅
- **Commit**: `pending` — `app/rider/ride/[classId]/page.tsx`
- Removed `RidePreviewBadge` from ride page
- `NetworkStatusBanner` already removed from rider landing in Phase 1

### 3.3 Simplify Completion Screen Language ✅
- **Commit**: `pending` — `app/components/features/ride/ride-completion-v2.tsx`
- "Anchored on Walrus + Sui" → "Your ride data saved ✓"
- Removed "View on Walrus" / "View on SuiScan" links
- "Anchored to Walrus + Sui" → "Ride data saved"
- "Submit ZK Claim" → "Claim your reward"
- "Storage & Rewards Details" → "Details"
- Removed unused `WALRUS_AGGREGATOR_URL` and `ExternalLink` imports

---

## Historical Phase 4: Onboarding Reorder ✅ COMPLETE (shipped)

**All tasks done.** Riders experience the product before being asked for information.

### 4.1 Move Quiz Post-Ride ✅
- **Commit**: `pending` — `app/page.tsx` + `app/rider/ride/[classId]/page.tsx` + `app/lib/analytics/ride-history.ts`
- Removed 3-second auto-fire timer from landing page
- Added `STORAGE_KEYS.quizPostRide` flag set when first ride completes
- Quiz now shows on next landing visit only after first ride is done
- Wedge: let them experience the product before asking for information

### 4.2 Remove Wallet Requirement From Demo ✅
- Already done — `PrimaryCTA` shows "Start Demo Ride — No Wallet Needed" for disconnected users
- Practice mode (`isPracticeMode`) bypasses all wallet checks
- No changes needed

---

## Review Cadence

- **Weekly**: Check each task against [WEDGE.md](./WEDGE.md) guardrails
- **After phase 1**: verify zero public personal-data requests in a ride E2E and a durable `RideReceiptV1` on the saved summary; the rule-based local coach memory and shipped assets remain unchanged.
- **After phase 2**: consent gates cover cloud history, third-party AI/voice, instructor live view, and public export separately.
- **After phase 5**: integrated production dogfood on testnets; the 10-rider "want again" signal remains a qualitative hypothesis.

---

## Sign-Off

This plan is the source of truth for feature priority. When new features are proposed:

1. Does it serve the wedge? → Slot into the receipt-first phases
2. Is it infrastructure/moat? → Backlog until a funded use case exists
3. Is it platform creep? → Reject until wedge is validated with real users

**Direction approved by**: user, 2026-10-04
**Next review**: after user browser/real-device feedback on the live phase-1 build (`a3c7e37`)