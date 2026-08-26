# Ride Transitions & Modal Discipline

## Problem Statement

The ride experience had two critical UX problems:

1. **No transitions between states** — Loading → ride → completion was jarring and instant. Users felt a "wall" between screens rather than flowing through an experience.

2. **Modal/overlay stacking chaos** — Up to 6+ overlays visible simultaneously: tutorial overlay (z-200) on top of exit confirm (z-60) on top of coach message (z-50) on top of keyboard hints (z-55) on top of settlement stream (z-20) on top of the 3D visualization (z-20). Users couldn't find the dismiss path.

---

## Solution Overview

### 1. Cinematic Transition System

The ride now flows through states with smooth, choreographed transitions:

```
LOADING → ACTIVATION → RIDING → EXITING → COMPLETION → DONE
```

Each transition has defined durations and animation curves. No two blocking overlays are ever visible simultaneously.

### 2. Modal Stack Discipline

**Rule: Only 1 modal visible at a time.** The modal stack enforces priority ordering and prevents stacking.

---

## The Transition System

### State Machine

| State | Duration | Animation | Blocks View |
|-------|----------|-----------|-------------|
| `loading` | 0-4s (progress bar) | Fade in (400ms), fade out (400ms) | ✅ Full screen |
| `activation` | ~2.5s | 3-2-1 countdown, scale + fade | ✅ Partial (transparent) |
| `entering` | 500ms | Fade out activation, camera pushes in | No |
| `riding` | indefinite | Normal HUD | No |
| `exiting` | 500ms | Fade out HUD, save spinner | ✅ Partial (dim) |
| `completion` | indefinite | Celebration particles, fade in | Partial |
| `done` | indefinite | Dismiss to journey | Partial |

### Transition Components

#### `RideTransitionOverlay`
The central orchestration component. Manages the state machine and renders the active transition.

```typescript
<RideTransitionOverlay
  state={transitionState}         // "loading" | "activation" | "riding" | "exiting" | "completion" | "done"
  prevState={null}                // Previous state for direction detection
  onActivationComplete={...}      // Called when activation ends
  onSkipActivation={...}          // Called when user taps skip
  activationPhase={phase}         // Current interval phase for color
  hasData={true}                  // Whether class data is already loaded
  loadProgress={0.7}              // 0-1 progress indicator
  loadTotal={5000}                // Expected load time in ms
  reducedMotion={false}           // Disable animations for accessibility
/>
```

#### Loading → Activation Transition
- **Loading**: Dark overlay with spinning orbital ring and progress bar
- **Activation**: Semi-transparent overlay with 3-2-1 countdown in phase color
- **Transition**: Cross-fade (600ms) — loading fades out as countdown appears

#### Activation → Riding Transition
- Countdown 3 → 2 → 1 with scale + fade animations
- Phase-colored number text with glow
- "Focus" label on final tick
- Camera pushes forward (via CSS)
- Auto-skips after 2.5s

#### Riding → Exiting Transition
- When user taps exit, a brief "Saving your ride" spinner appears
- This covers the 200ms gap between clicking exit and the completion screen mounting
- Prevents the "I clicked but nothing happened" feeling

#### Exit Confirmation Flow
```
Tap Exit → ExitConfirmModal (z-60) → "End Ride" → Saving overlay → Completion screen
                                    → "Keep Riding" → Cancel
```

---

## Modal Stack Discipline

### Priority System

Modals are prioritized from highest to lowest:

| Priority | Type | Example | Dismissible? | Auto-dismiss? |
|----------|------|---------|--------------|---------------|
| 100 | CRITICAL | Exit confirmation | ✅ Yes | ❌ No |
| 90 | INFORMATIONAL | Tutorial | ✅ Yes | ❌ No |
| 80 | TRANSIENT | Milestone celebration | ✅ Yes | ✅ 2s |
| 70 | TRANSIENT | No-bike prompt | ✅ Yes | ❌ No |
| 60 | TRANSIENT | Keyboard hints | ✅ Yes | ✅ 3s |
| 50 | INFORMATIONAL | Demo complete | ✅ Yes | ❌ No |

### Stack Rules

1. **Only 1 modal at a time** — pushing a new modal dismisses the current one if the stack is full
2. **Critical modals can't be bypassed** — exit confirm must be answered
3. **Transient modals auto-dismiss** — keyboard hints disappear after 3s, milestones after 2s
4. **Backdrop dismiss** — tapping the backdrop dismisses informationals and transients, but NOT critical modals
5. **Escape key** — always dismisses dismissable modals

### Implementation

```typescript
// Check what's currently on top
const activeModal = modalStack.activeModal();
// → { type: "keyboard-hints", priority: 60, dismissable: true, backdropClosable: true }

// Push a modal (only if stack empty)
modalStack.showModal("exit-confirm");
// → Renders ExitConfirmModal at z-60

// Dismiss a modal
modalStack.dismissModal("keyboard-hints");
// → Hides the modal
```

### Modal Types

#### ExitConfirmModal (z-60)
- **When**: User taps exit during active ride
- **Dismiss**: Confirm, Cancel, or Escape key
- **Backdrop**: Does NOT close (critical decision)
- **Animation**: Scale from 0.96, backdrop fade (250ms in, 200ms out)

#### Tutorial Overlay (z-60)
- **When**: First ride, or explicitly requested
- **Dismiss**: "Skip tutorial" button, Escape key, or tap X
- **Revisit**: Not persistent — must be re-requested
- **Animation**: Scale + fade (250ms)

#### NoBikeModal (z-60)
- **When**: User starts ride without connected bike and without simulator
- **Dismiss**: Enable simulator, or "Connect bike instead"
- **Backdrop**: Does NOT close (needs user choice)
- **Animation**: Scale from 0.96 (250ms)

#### KeyboardShortcutOverlay (z-55)
- **When**: Simulator mode activates during ride
- **Dismiss**: Auto-dismiss after 3s, or manual dismiss
- **Animation**: Fade in (400ms), then fade out over last 400ms of timeout
- **Reduced**: From 5s → 3s (shorter during active riding)

#### Milestone (z-60)
- **When**: Achievement unlocked (future)
- **Dismiss**: Auto-dismiss after 2s
- **Animation**: Scale + spin sparkle icon (250ms)

---

## Coach Channel (Replaces Full-Screen Overlay)

### The Problem
The old `CoachMessageOverlay` covered the entire 3D scene for 4 seconds, completely blocking the rider's view of their route.

### The Solution
`CoachChannel` is a bottom-aligned messaging system that sits above the HUD without blocking the 3D world:

**Compact state** (default):
- Small pill with coach icon + first line of message
- Taps expand to show full message
- Phase-colored accent bar at top
- Auto-expands on new message for 5s

**Expanded state**:
- Full message card with phase accent
- "Speaking" indicator when TTS is active
- Tap to collapse back to compact

**Visual design**:
- Sits above the HUD panel (not centered on screen)
- Never blocks the 3D world
- Phase color accent bar pulses when coach is speaking
- Glow behind card matches phase color
- Auto-collapses after 5-6 seconds

```
┌─────────────────────────────────────┐
│  Top bar                            │
├─────────────────────────────────────┤
│                                     │
│        [3D World]                   │
│                                     │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │ ● Coach  [Speaking]           │  │ ← CoachChannel
│  │ "Push through the climb —     │  │
│  │   you're at 80% effort now"   │  │
│  │      [v] tap to expand        │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌─── Power ───┐ ┌─── HR ──────┐   │  ← HUD
│  │    245 W    │ │    152 bpm  │   │
│  └─────────────┘ └─────────────┘   │
├─────────────────────────────────────┤
│  [Drag to reposition]               │  ← Bottom panel
└─────────────────────────────────────┘
```

---

## Mobile Gesture Support

### Swipe Gestures

The ride page responds to swipe gestures on mobile:

| Gesture | Action | When |
|---------|--------|------|
| **Swipe down** | Dismiss transient modals (keyboard hints) | Active riding |
| **Swipe up** | Expand coach channel messages | Coach message visible |
| **Swipe right from left edge** | Go back / dismiss modal | Any overlay visible |
| **Swipe left from right edge** | Open options menu | Active riding |

### Implementation

```typescript
const swipe = useSwipeGesture({
  onSwipeDown: () => {
    // Dismiss transient modals
    if (store.showKeyboardHints) {
      store.setShowKeyboardHints(false);
    }
  },
  disabled: deviceType !== "mobile",
});

// Attach to main container
<div ref={swipe.ref}>
```

### Gesture Rules
- Min swipe distance: 80px
- Max swipe duration: 300ms
- Ignores swipes from buttons, links, inputs
- Respects reduced-motion preference
- Coalesced with React touch events

---

## Keyboard Hints Improvement

### Before
- Showed for 5 seconds during active riding
- Blocked the 3D world view
- Re-appeared every time simulator toggled
- Required manual dismiss

### After
- Shows for 3 seconds (reduced from 5s)
- Appears only when simulator mode **starts** (not on toggle)
- Fades out smoothly in last 400ms
- Auto-dismisses without manual interaction
- Keyboard hints overlay sits at z-55 (below modals)

---

## Reduced Motion Respect

All transitions respect `prefers-reduced-motion`:

- Loading → Activation: 500ms → 150ms
- Activation countdown: 700ms intervals → instant skip
- Coach message transition: 300ms → 100ms
- Modal entrance: 250ms → instant
- Swipe gestures: disabled entirely
- Auto-animations (spinning, pulsing): disabled

---

## File Reference

| File | Purpose |
|------|---------|
| `ride-transition-overlay.tsx` | State machine, loading/activation/exiting transitions |
| `coach-channel.tsx` | Bottom-aligned coach messages, no world blocking |
| `modal-stack.tsx` | Modal discipline, priority ordering, dismiss rules |
| `use-swipe-gesture.ts` | Mobile swipe gesture support |
| `ride-modal-store.ts` | Modal state (existing, unchanged) |
| `ride-modals.tsx` | Legacy modal component (kept for compat) |

---

## Testing Checklist

### Transitions
- [ ] Loading screen shows progress bar, auto-transitions when done
- [ ] Skip loading button appears after 1.5s
- [ ] Activation: 3-2-1 countdown with phase color
- [ ] Activation: "Focus" text on final tick
- [ ] Activation: Skip button appears after 1.5s
- [ ] Escape key skips activation
- [ ] Riding → Exit: brief "Saving" spinner between tap and completion
- [ ] Completion screen: particle burst on entry
- [ ] All transitions respect reduced-motion

### Modal Discipline
- [ ] Only 1 modal visible at a time
- [ ] Exit confirm: cannot dismiss via backdrop
- [ ] Keyboard hints: auto-dismiss after 3s
- [ ] Tutorial: dismissable via X button
- [ ] Escape dismisses non-critical modals
- [ ] Priority ordering works (milestone over tutorial)

### Coach Channel
- [ ] Coach messages appear as compact pill at bottom
- [ ] Coach channel does NOT block 3D world
- [ ] Tap to expand shows full message
- [ ] Auto-expands on new message for 5s
- [ ] Phase color accent matches interval phase
- [ ] "Speaking" indicator when TTS active

### Mobile Gestures
- [ ] Swipe down dismisses keyboard hints
- [ ] Swipe right from left edge dismisses modals
- [ ] Gestures ignored on desktop
- [ ] Gestures ignored on buttons/links/inputs
- [ ] Swipe disabled with reduced-motion