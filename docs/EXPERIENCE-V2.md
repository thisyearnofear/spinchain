# Ride Experience v2 — Design Upgrade Summary

## What Was Built

Five major upgrades to make the SpinChain ride experience truly delightful and game-changing:

---

## 1. Phase Theme Engine (`app/lib/phase-theme.ts`)

The **single source of truth** for how the entire ride looks and feels based on the current interval phase and effort level.

### Computes:
- **Phase colors**: Each phase has a distinct color palette (sprint=red, recovery=blue, warmup=green)
- **Intensity**: 0–1 derived from effort score, scaled per phase
- **Pulse rate**: How fast visual elements breathe (faster during sprints, slower during recovery)
- **Bloom multiplier**: Controls the 3D scene's intensity
- **Screen pulse opacity**: Edge glow during high-intensity moments

```typescript
computePhaseTheme(intervalPhase, effort)
// → { color, bg, glow, particle, intensity, pulseRate, bloomMultiplier, screenPulseOpacity }
```

### Why it matters:
Every visual element on the ride page reads from this — the background, HUD, particles, 3D scene, screen borders. **All synchronized to the same emotional state.**

---

## 2. Sensory Sync Store (`app/stores/sensory-store.ts`)

A **Zustand store** that acts as the conductor of the ride experience:

### Stores:
- `latestEvent`: The most recent sensory event (phase-change, sprint-start, pr-beat, etc.)
- `countdownPhase`: Pre-ride countdown state (none → three → two → one → go)

### Hook: `useSensorySync()`
Auto-detects events from store state changes and writes them to the store:
- **Phase changes** → writes `phase-change` event
- **Sprint enter/leave** → writes `sprint-start` / `sprint-end`
- **PR beaten** → writes `pr-beat` (fires once per ride)
- **Ride start** → writes `ride-start`

### Hook: `useSensoryEvent()`
Reads the latest event so visual components can animate in response.

### Why it matters:
This is the **synchronization layer** — when the interval changes, the audio cue, visual phase transition, haptic pulse, and coach message all fire within 200ms of each other because they're all reading from the same event store.

---

## 3. Pre-Ride Activation Sequence (`app/components/features/ride/ride-activation.tsx`)

**Replaces**: The loading screen with 4 progress steps + bottom settings panel

**Now**: A cinematic activation ritual with 3 phases:

### Phase 1: Route Reveal (0–3s)
- Ambient particles drift across the screen
- Class name fades in
- Phase indicator orb pulses with the workout's accent color
- Rider sees the world they're about to ride through

### Phase 2: Countdown (3–6s)
- "GET READY" → 3 → 2 → 1 → GO
- Each number pulses and scales with phase-colored glow
- Haptic feedback on each tick (heavy on final tick)
- "Focus" text appears on the final tick

### Phase 3: GO (6s+)
- Screen flashes to phase color
- Camera pushes forward
- Ride begins immediately

### Key features:
- **Respects reduced-motion** preference (instant skip)
- **Skip button** appears after 2 seconds
- **Color adapts** to the workout's interval phase

---

## 4. Reactive HUD Overlay v2 (`app/components/features/ride/ride-hud-overlay-v2.tsx`)

**Replaces**: 11+ simultaneous UI elements (4 metric cards, phase badge, ghost badge, gear badge, coach messages, settlement stream, multi-ghost list, performance graphs)

**Now**: 3 focal points during active riding, nothing else:

### Active Mode (default):
1. **Primary metric** (biggest, center) — adapts to phase:
   - Sprint → Cadence
   - Recovery → Heart Rate
   - Otherwise → Power
2. **Phase badge** (small, above primary) — color-coded with pulse
3. **Ghost status** (small, beside) — lead/lag time

### Expanded Mode (tap to toggle):
- All 4 metrics in a grid
- Coach message
- Multi-ghost list
- Tap to collapse

### Phase-reactive behavior:
- **Background glow** shifts color with phase
- **Metric cards breathe** — scale up on high effort values
- **Screen edges pulse** during sprints (inset box-shadow)
- **Particles accelerate** with effort (8–32 particles based on intensity)
- **Grid lines** appear during high intensity (>70%)

### Visual layers (back to front):
1. Ambient background radial gradient (phase color, effort-scaled opacity)
2. Intensity-based pulse overlay
3. Sprint edge flash
4. Floating particles
5. Phase badge
6. Primary metric card (with intensity bar)
7. Ghost badge + secondary metrics
8. Coach message overlay (when speaking)
9. Settlement stream (yellow mode only)

---

## 5. Enhanced Flow Background (`app/components/features/ride/enhanced-flow-background.tsx`)

**Replaces**: Simple FlowBackground with ambient color based on interval

**Now**: A 4-layer reactive background system:

### Layer 1: Base Gradient
- Phase color fills the screen at low opacity
- Opacity scales with effort intensity

### Layer 2: Floating Particles
- Count scales with intensity (8–32 particles)
- Speed increases with effort
- Color varies by phase (warm vs cool tones)
- Golden-angle distribution for natural-looking dispersion

### Layer 3: Grid Lines
- Appear only during high intensity (>70%)
- Creates "tunnel vision" effect during sprints
- Fade in/out smoothly

### Layer 4: Event Flash
- Brief screen-wide flash on phase changes
- PR beat celebration flash
- Sprint enter/leave transitions

### Sprint edge glow:
- Inset box-shadow pulses during sprints
- Color and intensity match the phase theme

---

## 6. Completion Celebration v2 (`app/components/features/ride/ride-completion-v2.tsx`)

**Replaces**: The administrative "3-tab dashboard" (Summary/Rewards/Storage)

**Now**: A celebration sequence with 3 phases:

### Phase 1: CELEBRATION (0–2.5s)
- Big "DONE" text with particle burst (30 particles, 5 colors)
- PR celebration badge if a PR was beaten
- Agent debrief as hero message (not in a tab)
- Duration and telemetry source shown
- Loading indicator fades in for next phase

### Phase 2: STATS (2.5s+)
- Clean stat row (Avg HR, Avg Power, Effort, Duration) — no cards
- Max stats (Peak Power, Peak HR) shown if they beat averages
- SPIN earned in a golden highlight box
- Share card as prominent action
- Ride comparison vs previous ride
- Next ride recommendation

### Phase 3: ACTIONS (persistent bottom bar)
- Primary action button (View History or Ride Again)
- Claim rewards button with SPIN amount
- Export TCX button

### Storage & Rewards Details:
- Collapsed by default (tap to expand)
- Shows Walrus + Sui anchoring info
- Settlement status
- Coach rating stars

---

## How It All Fits Together

```
Ride Page (app/rider/ride/[classId]/page.tsx)
│
├── RideActivationSequence      ← Shows when ride starts, auto-dismisses
│   └── useSensorySync()        ← Writes countdown events to store
│
├── RideVisualization           ← 3D route (unchanged)
│   └── EnhancedFlowBackground  ← Reads phase theme + sensory events
│       └── computePhaseTheme() ← Single source of truth
│
├── RideHUDOverlayV2            ← 3 focal points + expanded mode
│   ├── useSensoryEvent()       ← Reads latest event for reactions
│   └── computePhaseTheme()     ← Drives all colors
│
└── RideCompletionV2            ← Celebration → Stats → Actions
    ├── useSensoryStore         ← PR celebration event
    └── Agent debrief           ← Hero message, not a tab
```

---

## Testing Checklist

### Pre-Ride:
- [ ] Activate a ride → see 3s route reveal with particles
- [ ] See countdown: 3 → 2 → 1 → GO with color matching the interval phase
- [ ] Haptic feedback on each countdown tick (mobile)
- [ ] Skip button appears after 2s
- [ ] Reduced-motion mode skips to ride immediately

### During Ride:
- [ ] HUD shows only 3 elements: primary metric, phase badge, ghost status
- [ ] Primary metric changes with phase (Power → Cadence during sprint)
- [ ] Background color shifts with phase (warm during sprint, cool during recovery)
- [ ] Particles appear and accelerate during high effort
- [ ] Grid lines appear during sprints (>70% effort)
- [ ] Screen edge flash during sprint transitions
- [ ] Tap the bottom button to expand full HUD
- [ ] Coach messages still appear when spoken

### Completion:
- [ ] "DONE" appears with particle burst
- [ ] PR badge appears if a PR was beaten
- [ ] Agent debrief as hero message
- [ ] Auto-advances to stats after 2.5s
- [ ] Clean stat row (no cards)
- [ ] SPIN earned prominently displayed
- [ ] Share card visible
- [ ] Storage/rewards details collapsed by default

---

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `app/lib/phase-theme.ts` | NEW | Phase theme engine |
| `app/stores/sensory-store.ts` | NEW | Sensory events state |
| `app/components/features/ride/ride-activation.tsx` | NEW | Pre-ride activation sequence |
| `app/components/features/ride/ride-hud-overlay-v2.tsx` | NEW | Simplified reactive HUD |
| `app/components/features/ride/ride-completion-v2.tsx` | NEW | Celebration completion |
| `app/components/features/ride/enhanced-flow-background.tsx` | NEW | 4-layer reactive background |
| `app/hooks/ride/use-sensory-sync.ts` | NEW | Sensory sync hook |
| `app/components/features/ride/index.ts` | MODIFIED | Export new components |
| `app/rider/ride/[classId]/page.tsx` | MODIFIED | Wire everything together |

---

## Migration Notes

- The old components (`FlowBackground`, `RideHUDOverlay`, `RideCompletion`) are still in the codebase and can be reverted to if needed
- The new v2 components are opt-in via the ride page wiring — removing the import blocks reverts to old behavior
- No database changes, no API changes, no contract changes
- All new behavior is pure UI/UX enhancement