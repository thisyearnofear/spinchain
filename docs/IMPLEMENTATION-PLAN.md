# SpinChain: Implementation Plan — Wedge-First

> **Created**: 2026-08-17
> **Purpose**: Concrete tasks to enforce wedge discipline. Each task maps to a guardrail in [WEDGE.md](./WEDGE.md).
> **Status**: Active
> **Read first**: [WEDGE.md](./WEDGE.md) defines the wedge and guardrails. This plan converts them into tasks.

---

## Guiding Principle

> Perfect the one loop (effort → visual transformation → dopamine) before expanding to the platform.
> Every task below must pass the wedge guardrails. If it doesn't, it doesn't go in this plan.

---

## Phase 1: Surface The Game ✅ COMPLETE

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

## Phase 2: Perfect The Demo Ride (2–3 weeks)

**Goal**: Make the demo ride the best gamified indoor cycling session anyone has ever experienced. Even with a keyboard.

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

### 2.2 Polish The Activation Sequence
- **File**: `app/components/features/ride/ride-activation.tsx`
- **What**: The activation sequence already exists (3s reveal, 3-2-1 countdown, GO). Make it feel like a real ceremony:
  - Route thumbnail appears with parallax during reveal
  - Countdown numbers pulse with haptic sync
  - GO flash transitions smoothly into the 3D world
- **Why**: First impressions compound. A weak activation undercuts the visual magic that follows.
- **Not in scope**: New mechanics. Polish existing ones.

### 2.3 Make The Demo Ride World Feel Alive ✅
- **Commit**: `pending` — `app/hooks/ride/use-demo-effort.ts` + `app/rider/ride/[classId]/page.tsx`
- **File**: New hook `useDemoEffort` that generates keyboard-driven cadence/power for practice mode
- **What**: W/↑ = pedal harder, S/↓ = brake, idle = coast. Feeds metrics into `coordinator.ingestSimulatorMetrics()` at 10Hz; the coordinator gates commits behind `shouldCommit` (no synchronous store write per keydown).
- **Why**: Practice mode was excluded from the simulator (`shouldSimulate = isTrainingMode || isGuestMode`), so `flowTier` stayed at 0 and the reactive world never fired.
- **Wired in**: `app/rider/ride/[classId]/page.tsx` line 401
- **Test**: In demo mode, press W — world should visibly respond (particles, road glow, flow badge) within one frame.

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

## Phase 3: Language Cleanup ✅ COMPLETE

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

## Phase 4: Onboarding Reorder ✅ COMPLETE

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

## Phase 5: Real Users (2–4 weeks, parallel)

**Goal**: Get real people with spin bikes riding. Validate the wedge with sweat.

### 5.1 Soft Launch With 10 Riders
- **What**: Find 10 people with connected spin bikes (Schwinn IC4, Bowflex C6, Keiser M3i) and get them through the full flow:
  1. Connect bike via BLE
  2. Join a class
  3. Ride (real HR, real power)
  4. See world react to their effort
  5. Complete ride, see milestones
- **Where to find them**: Local spin studios, cycling communities, Reddit r/spin, r/zwift
- **Success criteria**: 7/10 say "I want to do this again" without mentioning rewards.

### 5.2 Deploy Vercel From HEAD
- **What**: The live deployment is stale and causes Noir init failures. Redeploy.
- **Status**: Blocker. Not in the wedge plan but blocks everything else. Do this first.
- **Command**: `vercel deploy --prod` from current HEAD.

### 5.3 Provision Supabase
- **What**: Create project, run schema, set env vars. Without it, all persistence falls back to localStorage.
- **Status**: Blocker. Blocks ride history, profiles, homework.
- **Priority**: Second only to Vercel deploy.

---

## Phase 6: Tooling & Visualization Polish ✅ SHIPPED 2026-09-01

**Goal**: Make 2D/3D switching discoverable + delightful and lock in agent quality gates.

### 6.1 Delightful 2D/3D Switching
- **Commits**: `e6520a0` + `32c4dba` — `ride-visualization.tsx` + `page.tsx` + `gpu-probe.ts` + `enhanced-flow-background.tsx` + `visualization-engine.ts` wiring
- **Before**: hard ternary unmount, `Suspense` spinner flash, `probeGpu` treated unknown `deviceMemory`/`cores` as low-end (every Chromium-less browser → `focus-2d`), pill only visible mid-ride and disabled on low-end, `EnhancedFlowBackground` popped via `return null`, `visualization:degraded` never fired (no `onFrame` feed)
- **After**: keep-alive stacked (`motion` 220ms crossfade, both bundles preloaded on mount), `probeGpu` only counts `cores`/`memory` when explicitly available (`cores <=2`, `memory <=4`, `maxTexture <2048`), `effectiveMode = viewMode === "focus" ? "focus-2d" : "tron-3d"` so user override wins, pre-ride segmented `2D Focus | 3D Immersive` above `Start Ride` + `Press V` hint, mid-ride pill always enabled with `Low GPU` badge + `warning` haptic, `frameloop="demand"` pauses hidden renderer, `Background` fades opacity, rAF feeds `visualization.onFrame()` and `visualization:degraded` auto-flips to Focus at <25fps ×3

### 6.2 Agent Skills Evaluation
- **Doc**: `docs/SKILLS-PLAN.md` (review only, no installs executed)
- **Verdict**: `react-doctor` 14.7k★ → **Install now** (deterministic lint + `scan http://localhost:3000` chrome trace + diff-only CI gate); `threejs-game-skills` 1.4k★ → **Evaluate selectively** (`aaa-graphics-builder` + `debug-profiler` + `qa-release` only); `webgpu-claude-skill` 1.2k★ → **Park** until `three/webgpu` migration
- **Flagged prompts not run**: `npx skills add ...` / `./install.sh --codex` / `npx react-doctor@latest` / `npx react-doctor@latest ci install` / `npx react-doctor@latest scan` / `/skill install webgpu-threejs-tsl@...`

## What NOT To Build (Yet)

These are explicitly deferred until the wedge is validated with real users:

| Deferred | Why |
|----------|-----|
| Multi-sport adapter (running, rowing, etc.) | Focus on cycling first. One sport done right beats three done poorly. |
| Mindbody/ClassPass bridge | Network effects require riders first. Don't build distribution before product. |
| Uniswap v4 dynamic pricing | Instructor economics is a platform feature. Riders don't need to see it. |
| ERC-7715 permissions / agent co-signing | Infrastructure. Hide it. |
| Cross-gym calibration | Important for scale. Not for the wedge. |
| 22-speed virtual shifting | Nice-to-have physics detail. Cadence and power are enough for the reactive world. |
| Full E2E tests across the claim loop | Testing is important but not wedge-critical. Manual testing through the ride flow is sufficient for now. |

---

## Timeline

```
Week 1-2  Phase 1: Surface the game (visible gamification on landing)
Week 2-4  Phase 2: Perfect the demo ride (30 seconds, zero friction)
Week 3    Phase 3: Language cleanup (concurrent, low effort)
Week 3    Phase 4: Onboarding reorder (concurrent with Phase 2)
Week 3-6  Phase 5: Real users (parallel, ongoing)
```

**Hard dependency**: Vercel deploy and Supabase provisioning must happen before Phase 5 (real users). Everything else can start immediately.

---

## Review Cadence

- **Weekly**: Check each task against [WEDGE.md](./WEDGE.md) guardrails
- **After Phase 1**: Show the rider landing to 5 people. Do they immediately see the gamification?
- **After Phase 2**: Run the demo ride with eyes closed first. Does the audio + haptics + world still feel good?
- **After Phase 5**: If <50% of riders say "I want to come back," the wedge is broken. Re-evaluate.

---

## Sign-Off

This plan is the source of truth for feature priority. When new features are proposed:

1. Does it serve the wedge? → Add to Phase 1-4
2. Is it infrastructure/moat? → Add to backlog, build in parallel
3. Is it platform creep? → Reject until wedge is validated with real users

**Approved by**: team
**Date**: 2026-08-17
**Next review**: After Phase 1 completion