# SpinChain Adaptive UX System

## Overview

SpinChain's adaptive UX system transforms a static ride into a **living, breathing experience** that responds to the rider's effort, emotional state, achievements, and environment. This document covers the complete adaptive architecture.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ADAPTIVE UX SYSTEM                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ World React. │  │  Flow State  │  │   Music Eng. │              │
│  │              │  │   Engine     │  │              │              │
│  │ Effort-based │  │ Sustained    │  │ BPM-synced   │              │
│  │ visual cues  │  │ performance  │  │ adaptive     │              │
│  │              │  │ tracking     │  │ intensity    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                      │
│         ▼                  ▼                  ▼                      │
│  ┌──────────────────────────────────────────────────┐              │
│  │              3D Visual Scene                      │              │
│  │  • Road emissive & glow                          │              │
│  │  • Fog color & density                           │              │
│  │  • Lighting (ambient + point)                    │              │
│  │  • Particles & stars                             │              │
│  │  • Post-processing (bloom, chromatic, vignette)  │              │
│  │  • Speed lines & trail                           │              │
│  └──────────────────────────────────────────────────┘              │
│         ▲                                  ▲                        │
│         │                                  │                        │
│  ┌──────┴──────────┐          ┌───────────┴──────────┐            │
│  │  Milestones &   │          │  Experience Level    │            │
│  │  Streaks        │          │  Proficiency Model   │            │
│  │  • 17 milestones│          │  • 4 tiers           │            │
│  │  • Daily streak│           │  • Adaptive UI       │            │
│  │  • Persistent  │           │  • Tutorial control  │            │
│  └─────────────────┘          └──────────────────────┘            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. World Reactivity

### Purpose
Makes the 3D ride world respond to the rider's immediate effort in real-time.

### Input
- **Power** (Watts) — normalized via compressed curve
- **HR** (beats per minute) — normalized via reserve calculation
- **Cadence** (RPM) — normalized to 120 RPM max
- **Interval Phase** — warmup, interval, sprint, recovery, cooldown

### Output
30+ reactive parameters computed per frame:

| Parameter | Range | Driven By |
|-----------|-------|-----------|
| `roadGlowColor` | Phase color | Interval phase |
| `roadGlowIntensity` | 0.2 → 1.0 | Cadence + phase |
| `fogColor` | Theme → phase | Interval phase |
| `fogDensity` | 20 → 40 | Effort level |
| `skyTopColor` | Phase gradient | Interval phase |
| `skyBottomColor` | Phase gradient | Interval phase |
| `ambientIntensity` | 0.3 → 0.5 | Effort (inverse) |
| `pointLightColor` | Phase color | Interval phase |
| `pointLightIntensity` | 1.0 → 2.5 | Power |
| `fovTarget` | 50° → 100° | Sprint intensity |
| `propEmissiveIntensity` | 0.5 → 2.0 | Effort |
| `speedLineSpeed` | 0.5 → 2.5 | Cadence |
| `speedLineColor` | Phase color | Interval phase |
| `riderAuraOpacity` | 0.05 → 0.55 | Power + HR |
| `riderAuraScale` | 1.0 → 1.7 | Power + HR |
| `riderTrailColor` | Phase color | Interval phase |
| `riderLightIntensity` | 5 → 23 | Power + HR |
| `sparkleOpacity` | 0.1 → 0.7 | Effort |
| `sparkleSpeed` | 0.3 → 1.0 | Cadence |
| `sparkleColor` | Phase color | Interval phase |
| `starsRotationSpeed` | 0.5 → 2.0 | Effort |
| `gridColor` | Phase color | Interval phase |
| `gridOpacity` | 0.0 → 0.6 | Effort |
| `bloomIntensity` | 0.5 → 3.0 | Effort |
| `chromaticOffset` | 0 → 0.008 | Power > 300W |
| `vignetteDarkness` | 0.8 → 1.0 | Effort |

### Computation
Located in `app/lib/flow-state.ts` → `computeFlowState()`

```typescript
// Pseudocode
const effort = Math.min(1, (power / 400) ** 0.6);
const cadenceFactor = Math.min(1, cadence / 120);
const hrFactor = Math.min(1, hr / 190);

// Phase color mapping
const phaseColors = {
  sprint: { roadGlow: "#f43f5e", fog: "#1a0a0a", skyTop: "#1a0505", ... },
  interval: { roadGlow: "#f59e0b", fog: "#1a1505", ... },
  // etc.
};

// Blend phase with theme
const phaseInfluence = effort; // 0.0 (neutral) → 1.0 (full phase color)
const roadGlowColor = lerpColor(themeColor, phaseColor, phaseInfluence);
```

### Visual Effects
- **Road glow** shifts color with phase, pulses with cadence
- **Fog** denser during high effort, color shifts with phase
- **Sky gradient** adapts to phase colors
- **Lighting** shifts color with interval phase
- **Camera FOV** widens during sprints (tunnel vision effect)
- **Props** pulse harder during high effort
- **Speed lines** accelerate with cadence
- **Rider aura** intensifies with HR and power
- **Particles** speed up and change color with effort
- **Post-processing** (bloom, chromatic aberration, vignette) intensifies

---

## 2. Flow State Engine

### Purpose
Tracks **sustained performance** to determine if the rider is in a flow state. Flow is not instant power — it's consistency near target over time.

### Flow Tiers

| Tier | State | Escalation | Visual Multiplier |
|------|-------|------------|-------------------|
| 0 | Calm | Baseline | 1.0x |
| 1 | Focused | 8s at target | 1.2x |
| 2 | Flow | 15s at target | 1.5x |
| 3 | Super Flow | 25s at target | 1.8x |
| 4 | Mastery | 35s at target | 2.2x |

### Scoring System

Composite score (0.0 → 1.0) calculated from 4 weighted factors:

1. **Consistency (40%)** — How close to interval target
   - Formula: `power / targetPower`
   - Clamped 0.0 → 1.5

2. **Trajectory (25%)** — Improving or declining
   - Rolling 10-second window
   - Compares recent 2s avg to previous 2s avg
   - Normalized -1.0 → 1.0

3. **Duration (20%)** — Time spent at current tier
   - 0 → 1 over escalation delay
   - Prevents tier flicker

4. **HR Zone (15%)** — Physiological effort
   - Karvonen formula: `(HR - rest) / (max - rest)`
   - Normalized 0.0 → 1.0

```typescript
// Formula
const composite =
  consistency * 0.40 +
  Math.max(0, (trajectory + 1) / 2) * 0.25 +
  durationScore * 0.20 +
  hrZone * 0.15;
```

### Escalation Delays
Prevents rapid tier switching:

| Tier | Delay | Rationale |
|------|-------|-----------|
| 0 → 1 | 8s | Quick to enter focused state |
| 1 → 2 | 15s | Flow requires consistency |
| 2 → 3 | 25s | Super flow is rare |
| 3 → 4 | 35s | Mastery is exceptional |

### Events

Flow events emitted on transitions:

```typescript
interface FlowStateEvent {
  type: 'tier-enter' | 'tier-rise' | 'tier-fall' | 'sustained' | 'peak';
  tier: FlowStateTier;
  previousTier: FlowStateTier;
  score: number;
  message?: string; // Coach-ready message
}
```

**Messages per event type:**

- `tier-enter`: "Flow state. Let it carry you."
- `tier-rise`: "Lock in — this is where it gets good."
- `tier-fall`: "Hold steady — you've got this."
- `sustained`: "Sustained. Consistent. That's how you train."
- `peak`: "10 minutes of flow — legendary."

### Hook API

```typescript
const flow = useFlowState(power, hr, hrResting);

// Returns:
{
  flowState: { tier, score, consistency, duration, trajectory },
  events: FlowStateEvent[],
  totalFlowMinutes: number,
  milestones: number[],
  flowTier: FlowStateTier,
  flowScore: number,
  flowLabel: string,
  registerFlowEventHandler, // For custom logic
  resetFlowState,
}
```

### Side Effects
When flow events fire:

1. **Coach message** → sent to coaching store
2. **Haptic feedback** → brief pulse on tier escalation
3. **Music intensity** → flow tier scales music
4. **Visual effects** → flow tier scales all reactive params
5. **Analytics** → flow time tracked for milestones

---

## 3. Music Engine

### Purpose
BPM-synced background music that adapts to rider state and integrates with TTS coaching.

### Track Library

12+ tracks across 6 categories:

| Phase | Category | BPM | Duration | Intensity |
|-------|----------|-----|----------|-----------|
| Sprint | High-energy | 138-145 | 3min | 0.85-1.0 |
| Interval | Focus | 120-125 | 5min | 0.6-0.7 |
| Warmup | Ambient | 100-105 | 5min | 0.4-0.5 |
| Recovery | Ambient | 75-80 | 5min | 0.25-0.3 |
| Cooldown | Ambient | 70 | 10min | 0.2 |
| Celebration | Celebration | 125-130 | 2-3min | 0.9-1.0 |

### BPM Sync

Beat events generated from track BPM:

```typescript
interface BeatEvent {
  time: number;         // ms from track start
  intensity: number;    // 0.4 (soft) → 0.7 (accent) → 1.0 (downbeat)
  category: 'downbeat' | 'accent' | 'soft';
}
```

Downbeats every 4 beats, accents every 2 beats.

### Ducking System

Handles music/TTS overlap:

```typescript
interface DuckingConfig {
  duckAmount: number;   // 0.7 = 70% reduction during TTS
  duckRecovery: number; // 0.5 = 50% return per second
}
```

- Ducking starts when `isSpeaking` → `true`
- Ducking stops when `isSpeaking` → `false`
- Smooth volume transitions, no clicks

### Flow Integration

Music scales with flow state:

- **BPM**: +2% per flow tier (capped at 160 BPM)
- **Intensity**: +20% per flow tier
- **Track selection**: higher intensity tracks preferred at higher tiers

### Hook API

```typescript
const {
  state,           // Current music state
  isPlaying,       // Boolean
  currentTrack,    // MusicTrack | null
  volume,          // Current volume (0-1)
  beat,            // { progress, intensity, isDownbeat }
  playTrack,       // (track) => void
  selectTrackForPhase, // (phase, flowTier) => void
  transitionToPhase,   // (phase) => void
  setVolume,       // (volume) => void
  startDucking,    // Start TTS ducking
  stopDucking,     // Stop TTS ducking
  updateFlowState, // (tier) => void
} = useMusicEngine();
```

---

## 4. Milestones & Streaks

### Purpose
Persistent achievement system that remembers rider progress across sessions, creating emotional attachment through shared memory.

### Session Milestones (17 definitions)

**Duration:**
- Bronze: 5 minutes
- Silver: 15 minutes
- Gold: 30 minutes
- Platinum: 60 minutes
- Diamond: 90 minutes

**Power:**
- Bronze: 100W max
- Silver: 200W max
- Gold: 300W max
- Platinum: 400W max
- Diamond: 500W max

**Heart Rate:**
- Silver: 160 BPM max
- Gold: 180 BPM max
- Platinum: 190 BPM max

**Cadence:**
- Bronze: 90 RPM max
- Silver: 100 RPM max
- Gold: 110 RPM max
- Platinum: 120 RPM max

**Flow:**
- Bronze: 2 minutes in flow
- Silver: 5 minutes in flow
- Gold: 10 minutes in flow
- Platinum: 15 minutes in flow
- Diamond: 20 minutes in flow

**Peak Flow Tier:**
- Gold: Reached super flow (tier 3)
- Platinum: Reached mastery (tier 4)

### Tier Display

| Tier | Color | Icon | Scale |
|------|-------|------|-------|
| Bronze | `#b45309` | 🥉 | 1.0x |
| Silver | `#475569` | 🥈 | 1.1x |
| Gold | `#ca8a04` | 🥇 | 1.2x |
| Platinum | `#6366f1` | 💎 | 1.4x |
| Diamond | `#a855f7` | 👑 | 1.6x |

### Streak Tracking

- **Current streak**: consecutive daily rides
- **Longest streak**: all-time best
- Streak calculated from localStorage records
- Broken if gap > 1 day from last ride

### Persistent Memory

Stored in `localStorage` under `spinchain-user-memory`:

```typescript
interface UserMemory {
  totalRides: number;
  totalFlowMinutes: number;
  totalCalories: number;
  longestStreak: number;
  currentStreak: number;
  lastRideDate: string;
  firstRideDate: string;
  bestAvgPower: number;
  bestMaxPower: number;
  bestDuration: number;
  bestFlowMinutes: number;
  rides: Record<string, RideStats>;
}
```

---

## 5. Experience Level

### Purpose
Adapts UI complexity and tutorial frequency based on rider proficiency.

### Experience Tiers

| Tier | Rides | Label | Tutorial | HUD | Coach Style |
|------|-------|-------|----------|-----|-------------|
| 0 | 0-2 | New Rider | Full | Full | Guiding |
| 1 | 3-9 | Developer | Reduced | Compact | Guiding |
| 2 | 10-29 | Racer | None | Compact | Concise |
| 3 | 30+ | Veteran | None | Minimal | Concise |

### Adaptation Surfaces

**Tutorial Frequency:**
- Newbie: All 6 steps shown
- Developer: First 3 steps only
- Racer/Veteran: No tutorials

**HUD Complexity:**
- Full: All metrics visible, expanded panels
- Compact: Primary metrics only, condensed layout
- Minimal: Single metric, gesture controls

**Coach Style:**
- Guiding: Longer messages (40 words), more explanations
- Concise: Shorter messages (15 words), direct instructions

**Feature Discovery:**
- Newbie/Developer: Prompts for unused features
- Racer/Veteran: No prompts

### Persistent Profile

Stored in `localStorage` under `spinchain-experience`:

```typescript
interface ExperienceProfile {
  totalRides: number;
  currentTier: ExperienceTier;
  preferredTheme: string;
  preferredCoach: string;
  tutorialDismissed: string[];
  featureFlags: Record<string, boolean>;
}
```

---

## 6. Context-Aware Palette

### Purpose
Adapts ride world to real-world conditions: time of day, season, ambient light, weather.

### Time-of-Day Palettes

| Time | Sky Top | Sky Bottom | Horizon Glow | Ambient |
|------|---------|------------|--------------|---------|
| Dawn | `#1a1040` | `#ff6b35` | `#ff8c42` | 0.4 |
| Morning | `#1e3a8a` | `#60a5fa` | `#93c5fd` | 0.8 |
| Afternoon | `#0ea5e9` | `#bae6fd` | `#e0f2fe` | 1.0 |
| Dusk | `#1e1b4b` | `#f97316` | `#fb923c` | 0.5 |
| Evening | `#0f172a` | `#312e81` | `#6366f1` | 0.3 |
| Night | `#020617` | `#0f172a` | `#1e293b` | 0.2 |

### Seasonal Tints

| Season | Tint Color | Effect |
|--------|-----------|--------|
| Spring | `#90ee90` | Green tint to world |
| Summer | `#ffffe0` | Warm yellow tint |
| Autumn | `#ffa500` | Orange tint |
| Winter | `#b0e0e6` | Cool blue tint |

### Weather Adjustments

| Weather | Extra Fog | Rain | Snow | Ambient Multiplier |
|---------|-----------|------|------|-------------------|
| Clear | 0 | 0 | 0 | 1.0x |
| Cloudy | 5 | 0 | 0 | 0.7x |
| Rain | 10 | 1.0 | 0 | 0.5x |
| Fog | 20 | 0 | 0 | 0.4x |
| Snow | 8 | 0 | 1.0 | 0.8x |

### UI Adaptation

- **Brightness**: scales with ambient lux (0 → 1)
- **Opacity**: minimum 0.5, maximum 1.0 based on conditions

---

## Integration Points

### Ride Page Wiring

```typescript
// app/rider/ride/[classId]/page.tsx

// 1. Flow state tracking
const flow = useFlowState(power, hr, hrResting);

// 2. Music engine integration
musicEngine.transitionToPhase(phase);
musicEngine.updateFlowState(flow.flowTier);

// 3. TTS ducking
useEffect(() => {
  if (coachIsSpeaking) musicEngine.startDucking();
  else musicEngine.stopDucking();
}, [coachIsSpeaking]);

// 4. Milestone recording
milestonesAndStreaks.recordRide({ ... });
milestonesAndStreaks.detectAndRecordMilestones({ ... });

// 5. Experience level
experienceManager.recordRide();
const config = experienceManager.getConfig();

// 6. Context palette
const palette = generateContextPalette(contextProfile);
```

### Visual Scene Wiring

```typescript
// app/components/features/route/route-visualizer.tsx

function Scene({ flowTier, reactive, contextPalette }) {
  // Flow state scales all reactive params
  const FLOW_SCALING = [1, 1.2, 1.5, 1.8, 2.2];
  const flowScale = FLOW_SCALING[flowTier];
  
  const reactive = useMemo(() => {
    const base = computeReactiveParams(theme, stats, intervalPhase, progress);
    return {
      ...base,
      bloomIntensity: base.bloomIntensity * flowScale,
      chromaticOffset: base.chromaticOffset * flowScale,
      // etc.
    };
  }, [flowTier, ...]);
  
  // Context palette applied to lighting and sky
  const fog = reactive || contextPalette?.fogColor;
  const skyColor = reactive?.skyTopColor || contextPalette?.skyTop;
}
```

---

## Performance Considerations

### Frame Budget
- **React re-renders**: Flow state computed at ~10Hz (not 60Hz)
- **Three.js frame**: Reactive params passed via refs (no React state)
- **Music beats**: Updated at 60fps from beat engine
- **Ducking**: Smooth interpolation at 60fps

### Memory
- **localStorage**: ~2KB per user (memories, experience)
- **In-memory**: Beat events (~100KB for 2-hour ride)
- **No GC pressure**: Mutable refs for hot paths

### Battery
- **No idle rendering**: `frameloop="demand"` in Three.js
- **Reduced particles**: Quality tier scales particle count
- **No background tasks**: All updates suspended when tab hidden

---

## Testing Checklist

### World Reactivity
- [ ] Road color shifts with sprint/recovery
- [ ] Fog density increases during high effort
- [ ] Sky gradient adapts to phase
- [ ] Camera FOV widens during sprints
- [ ] Props pulse faster during high effort
- [ ] Speed lines accelerate with cadence
- [ ] Rider aura scales with HR
- [ ] Post-processing intensifies with power

### Flow State
- [ ] Tier 0 (Calm) shows when below target
- [ ] Tier 1 (Focused) enters after ~8s consistency
- [ ] Tier 2 (Flow) enters after ~15s consistency
- [ ] Tier 3 (Super Flow) enters after ~25s consistency
- [ ] Tier 4 (Mastery) enters after ~35s consistency
- [ ] Coach messages fire on tier transitions
- [ ] Haptic pulses on tier-up
- [ ] Music intensity scales with flow tier

### Music Engine
- [ ] Track changes on phase transition
- [ ] Ducking starts on TTS
- [ ] Ducking stops on TTS end
- [ ] Smooth volume transitions
- [ ] Beat detection accurate to ±50ms
- [ ] BPM scales with flow tier

### Milestones & Streaks
- [ ] Milestone detected on ride completion
- [ ] Milestone displayed in completion screen
- [ ] Streak increments on consecutive days
- [ ] Streak resets on gap > 1 day
- [ ] Persistent across page reloads

### Experience Level
- [ ] Tutorial shows for new riders
- [ ] Tutorial reduced for developers
- [ ] No tutorial for veterans
- [ ] Tutorial dismissal tracked
- [ ] HUD complexity adapts to tier

### Context Palette
- [ ] Dawn/dusk palette applied correctly
- [ ] Seasonal tint visible
- [ ] Weather fog density increases
- [ ] UI brightness adapts to ambient light

---

## Future Extensions

### HRV Integration
- Morning freshness score affects ride tone
- Recovery HR tracks fitness improvements
- Stress detection softens coaching language

### Social/Competitive
- Ghost riders adapt to flow state
- Head-to-head mode with flow sync
- Leaderboard milestones

### Biometric Sync
- Heart rate zones trigger visual effects
- Cadence syncs to beat engine
- Power zones drive color shifts

### Personalization
- Custom theme preferences saved
- Favorite coaches remembered
- Personal best celebrations

---

## Credits

Built for SpinChain as part of the ride experience overhaul.

**Key Files:**
- `app/lib/flow-state.ts` — Flow state engine
- `app/lib/music-engine.ts` — Music engine
- `app/lib/milestones.ts` — Milestones & streaks
- `app/lib/experience-level.ts` — Experience level
- `app/lib/context-palette.ts` — Context-aware palette
- `app/components/features/route/route-visualizer.tsx` — 3D scene
- `app/components/features/ride/ride-hud-overlay-v2.tsx` — HUD overlay
- `app/components/features/ride/ride-completion-v2.tsx` — Completion screen

**Core Principle:** *The world should feel alive, remember your achievements, and adapt to who you are.*