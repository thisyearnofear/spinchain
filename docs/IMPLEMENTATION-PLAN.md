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

### 5.2 Deploy Vercel From HEAD ✅ DONE 2026-09-24
- **What**: The live deployment is stale and causes Noir init failures. Redeploy.
- **Status**: Done — `vercel deploy --prod` from local HEAD (`4a90a87`); happy path verified in-browser at spinchain.vercel.app. `git push` still blocked (token lacks repo write scope).

### 5.3 Provision Supabase ✅ DONE 2026-09-24
- **What**: Create project, run schema, set env vars. Without it, all persistence falls back to localStorage.
- **Status**: Done — project `spinchain` provisioned, `schema.sql` applied, 3 env vars wired to Vercel production+preview. `SUPABASE_JWT_SECRET` pending manual dashboard copy.

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

## Phase 7: Brand Embodiment (Sylva + Maxima Techniques) ✅ SHIPPED 2026-09-01

**Goal**: Make the site feel like cycling/health, not SaaS.

- **Lenis + GSAP ticker** (`smooth-scroll.tsx` already wired, `layout.tsx`) — cadence `scrub:1.2`
- **Chainring wheel** (`chainring-carousel.tsx`): 4×90° rotated divs in wrapper (Maxima), GSAP `rotation`, Lottie per discipline (Endurance top-down route via `generateRouteData` mini SVG, Sprint MIT `cycle.json` 720°, Recovery heart, Mind wave), draft ripple on Mind `onMouseMove`
- **Matter.js chain** (`chain-tension.tsx`): `"CHAIN"` hangs from 2×6-segment ropes, `MouseConstraint` drag — tension metaphor, mounted in `training-studio.tsx`
- **Morph CTA** (`morph-cta.tsx`): `borderRadius 16→999 spring 400/12` square→wheel, replaces static gradient
- **Scroll-scrubbed route** (`how-it-works-section.tsx`): `ScrollTrigger scrub 1.2` draws SVG road + `EffortAuraCanvas` (`globalCompositeOperation source-in` dot pattern + radial mask) as you read 1-2-3
- **Stickers** (`how-it-works-section.tsx`): `🚴⚡️🧘` cycle on step click `elastic.out(1.2,0.8)`
- **Lotties**: 4 distinct, 11KB Sprint MIT + 3 inline pulses, all loopable 60f, `next/dynamic` ssr:false for Turbopack

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