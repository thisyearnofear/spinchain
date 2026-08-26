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

### 2.3 Make The Demo Ride World Feel Alive
- **File**: `app/components/features/route/route-visualizer.tsx` + `app/components/features/ride/enhanced-flow-background.tsx`
- **What**: Ensure the demo ride uses the full reactive world:
  - Road glow responds to keyboard cadence
  - Fog density responds to simulated power
  - Speed lines accelerate with simulated sprint
  - Particles and bloom scale with effort
- **Why**: If the demo ride feels less magical than a real ride, the wedge is broken.
- **Test**: Pedal with arrow keys. Sprint with ↑. The world should visibly react within one frame.

### 2.4 Add Milestone Pop-Up On First Achievement
- **File**: `app/components/features/ride/` — new component `MilestonePopUp.tsx`
- **What**: When the rider hits their first milestone (e.g., "1 minute in flow"), show a celebratory pop-up with the milestone badge.
- **Why**: Dopamine hit. This is the moment the rider realizes "I'm actually doing something." Strava's segment badges, Duolingo's streak fire, Fortnite's first kill — all are momentary celebrations.
- **Design**: 2-second pop-up, particle burst, badge animation. Respects reduced-motion.
- **Uses**: Existing milestone definitions from `app/lib/milestones.ts`

---

## Phase 3: Language Cleanup (1 week)

**Goal**: Remove infrastructure language from rider-facing UX. The rider should never know about ZK, state channels, or smart contracts.

### 3.1 Rewrite Coach Cards
- **File**: `app/rider/page.tsx` → `featuredInstructors` array
- **What**: Replace `agenticPowers` array with `specialties` that are rider-facing:
  ```
  BEFORE: "agenticPowers": ["Dynamic pricing based on demand", "Liquidity management via Uniswap v4 hooks"]
  AFTER:  "specialties": ["Pushes harder on climbs", "Optimizes your pacing with data"]
  ```
- **Why**: [Rider language guardrail](./WEDGE.md#wedge-guardrails)
- **Scope**: All coach profile cards, agent pages, and instructor listings.

### 3.2 Remove "Preview" Badges
- **File**: Search for `Preview` or `preview` badges in rider-facing components.
- **What**: Either implement the feature fully or remove the badge. Do not ship half-built features with a "Preview" label.
- **Why**: [No preview badges guardrail](./WEDGE.md#wedge-guardrails)
- **Target**: Reward settlement status badge, rider avatar (Rive) slot, ghost rider system, TCX export.

### 3.3 Simplify Completion Screen Language
- **File**: `app/components/features/ride/ride-completion-v2.tsx`
- **What**: Replace infrastructure references ("Walrus blob attached", "Sui anchor minted") with rider outcomes:
  ```
  BEFORE: "Walrus blob ID: practice-route-001"
  AFTER:  "Your ride data saved ✓"
  ```
- **Why**: Riders don't care about the storage mechanism. They care that their data is saved and they earned a reward.

---

## Phase 4: Onboarding Reorder (1 week)

**Goal**: Get riders into the ride before asking anything of them.

### 4.1 Move Quiz Post-Ride
- **File**: `app/components/features/common/rider-quiz.tsx` + `app/page.tsx`
- **What**: Currently the quiz fires after 3 seconds on the landing page. Move it to fire after the first ride completes:
  1. First visit: show landing, let them ride demo
  2. After first ride: show quiz
  3. After quiz: show profile with personalized stats
- **Why**: [30-second rule](./WEDGE.md#the-core-loop-must-be-under-30-seconds). Let them experience the product before asking for information.
- **Implementation**: Set `localStorage[RIDER_QUIZ_KEY] = "post-ride"` after first ride, show quiz on next visit.

### 4.2 Remove Wallet Requirement From Demo
- **File**: `app/rider/ride/[classId]/page.tsx`
- **What**: The demo ride should not check wallet connection at all. Remove any `isConnected` gate on the demo ride path.
- **Why**: Wallet connection is friction. Demo rides are the wedge entrance. Don't put a lock on the door.
- **Implementation**: Check `demo=true` query param. If present, skip wallet check and use simulated rewards.

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