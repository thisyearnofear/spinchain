# SpinChain: Architecture

> **Purpose**: The single technical reference for SpinChain. Covers blockchain infrastructure, engine architecture, adaptive UX, ride experience, transitions, and Yellow Network.
>
> **Discipline**: This is the **background** layer — infrastructure and engines. The **foreground** (the wedge: effort → visual transformation) is defined in [WEDGE.md](./WEDGE.md). All new features must pass the wedge guardrails.
>
> **Supersedes**: ARCHITECTURE.md, ARCHITECTURE_GUIDE.md, ADAPTIVE-UX-SYSTEM.md, EXPERIENCE-V2.md, EXPERIENCE-V2-TRANSITIONS.md, YELLOW_NETWORK.md

---

## Table of Contents

1. [Blockchain Infrastructure](#1-blockchain-infrastructure)
2. [Engine Architecture](#2-engine-architecture)
3. [Visualization Renderer System](#3-visualization-renderer-system)
4. [Adaptive UX System](#4-adaptive-ux-system)
5. [Ride Experience v2](#5-ride-experience-v2)
6. [Transitions & Modal Discipline](#6-transitions--modal-discipline)
7. [Yellow Network](#7-yellow-network)
8. [Performance Guidelines](#8-performance-guidelines)

---

## 1. Blockchain Infrastructure

> **Discipline note**: This is the background layer. The rider should never see ZK proofs, state channels, or smart contracts in the UI. Infrastructure language belongs in docs, not in rider-facing components.

### Dual-Engine Execution Model

| Engine | Chain | Role | Primitive |
| :--- | :--- | :--- | :--- |
| **Settlement** | **Avalanche (EVM)** | High-value / Low-frequency | ERC-721, ERC-20, ZK Verifiers |
| **Agent Settlement**| **Kite AI (EVM)** | AI Identity / Autonomy | Agent Passport, x402 Payments |
| **Performance** | **Sui (Move)** | Low-value / High-frequency | Move Objects, Dynamic Fields |

### Why These Chains?

- **Avalanche**: Liquidity depth (Uniswap v4), ZK verification (on-chain Noir proofs), ENS identity for instructors
- **Sui**: Parallel execution (independent telemetry transactions), Move safety, 480ms finality for real-time AI reactivity
- **Kite AI**: Agent identity, revenue settlement, autonomous payments

### Data Flow

```
AI Instructors → Avalanche (ENS identity) → Kite AI (settlement)
Riders → purchase tickets (ERC-721) on Avalanche
During Ride: 10Hz telemetry → Sui RiderStats objects
Local Oracle: browser-side proof generation, 60-second proof windows
Settlement: IncentiveEngine.submitZKProofBatch() → verify on Avalanche
Agent Autonomy: AI agents settle revenue on Kite AI for API costs
```

### ZK Circuit: `effort_threshold`

Proves HR > threshold without revealing actual values:

```rust
// Private inputs (never revealed)
heart_rates: [u16; 60],  // 60 seconds of HR data

// Public inputs
threshold: u16,          // Target HR (e.g., 150)
min_duration: u32,       // Minimum seconds required

// Outputs
threshold_met: bool,     // Did they meet the goal?
effort_score: u16,       // 0-1000 calculated score
```

**Implementation**: Real Noir circuit with Barretenberg WASM backend generates proofs in-browser. On-chain `HonkVerifier` deployed to Fuji. Chunked batch claims (60-second windows).

### Privacy Tiers

| Tier | Revealed | Hidden | Use Case |
|------|----------|--------|----------|
| High | effort_score, zone | All raw metrics | Public leaderboards |
| Medium | + duration, ranking | GPS, biometrics | Friend competitions |
| Low | Full disclosure | - | Medical/insurance |

### Storage Layers

| Data Type | Storage | Compression | Retention |
|-----------|---------|-------------|-----------|
| Raw Telemetry | Walrus Blobs | Delta encoding | 30 epochs |
| Ghost Replays | Walrus Blobs | N/A | Permanent |
| 3D Worlds | Walrus Blobs | N/A | Permanent |
| ZK Proofs | Avalanche Events | N/A | Permanent |
| Agent Audits | Kite AI Events | N/A | Permanent |

### Walrus-as-Memory Data Flow

1. **During a ride**: 10Hz telemetry → Sui `RiderStats` via batched PTB transactions (~50 points per tx, ~80% gas reduction)
2. **At ride completion**: Full telemetry → compressed JSON blob → Walrus
3. **On-chain anchoring**: `TelemetryAnchor` Move object on Sui stores Walrus blob ID, storage epoch, point count
4. **AI Coach memory**: `Coach` struct carries `system_prompt_cid` referencing Walrus blobs

### Physiological Intelligence

- **Skiba W'bal model**: Tracks anaerobic work capacity depletion/recovery. AI personalities adjust resistance to protect or utilize this "fuel tank"
- **Virtual Drivetrain**: 50/34 front, 11-28 rear gear ratios simulated for fixed-resistance spin bikes
- **Physics-Based Speed**: Aerodynamic drag + gravity model for realistic pacer and route progress metrics

### Competitive Analysis

| Competitor | Model | Data Ownership | Economics |
|------------|-------|----------------|-----------|
| Peloton/Strava | Centralized | Platform-owned | Extractive |
| STEPN/Sweatcoin | Token-first | User-owned | Speculative |
| **SpinChain** | **Dual-Engine** | **User-owned** | **Revenue + Tokens** |

---

## 2. Engine Architecture

### Data Flow

```
┌─────────────────────────────────────────────┐
│           React Components (Views)           │
│  Reads from Zustand via granular selectors  │
│  NEVER writes to telemetry or lifecycle     │
├─────────────────────────────────────────────┤
│           Zustand Stores (UI State)         │
│  ride-store.ts, coaching-store.ts, etc.     │
│  Only state that UI needs to react to       │
├─────────────────────────────────────────────┤
│           RideCoordinator (Singleton)        │
│  Wires engines together via EventBus        │
│  Owns start/stop/pause/dispose lifecycle    │
├────────────────────┬────────────────────────┤
│  TelemetryEngine   │  VisualizationEngine   │
│  CoachingEngine    │   ├─ TronRenderer      │
│  AudioEngine       │   ├─ SplatRenderer     │
│  DeviceEngine      │   └─ AIGenRenderer     │
│  RewardsEngine     │  (Swappable, each      │
│  SuiEngine         │   renders differently) │
│  SocialEngine      │                        │
└────────────────────┴────────────────────────┘
          ↕ EventBus ↕
┌─────────────────────────────────────────────┐
│         External Services                   │
│  BLE hardware, Simulator, Walrus storage,   │
│  Sui Move contracts, EVM settlement         │
└─────────────────────────────────────────────┘
```

### Design Rules (Non-Negotiable)

#### Rule 1: Engines Are Plain TypeScript Classes

Engines live in `app/engines/` and are **not hooks**. No React APIs.

```typescript
// ✅ CORRECT
class TelemetryEngine {
  private bus: EventBus;
  private rawSnapshot: TelemetrySnapshot;
  constructor(bus: EventBus) {
    this.bus = bus;
    this.rawSnapshot = createEmptySnapshot();
  }
  ingest(update: Partial<TelemetrySnapshot>): void {
    Object.assign(this.rawSnapshot, update);
    this.bus.emit("telemetry:ingest", this.rawSnapshot);
  }
}

// ❌ WRONG — don't wrap engines in hooks
function useTelemetryEngine(): TelemetryData {
  // No.
}
```

#### Rule 2: React Reads From Zustand, Never From Engines

```typescript
// ✅ CORRECT — granular selector
function PowerDisplay() {
  const power = useRideStore((s) => s.telemetry.power);
  return <span>{power}W</span>;
}

// ❌ WRONG — don't read engine internals from components
function BadComponent() {
  const engine = useTelemetryEngine(); // No!
  return <span>{engine.rawSnapshot.power}W</span>;
}
```

#### Rule 3: Telemetry Data Never Passes Through React State

- BLE/Simulator → writes directly to `TelemetryEngine`'s internal refs
- UI-relevant snapshots → committed to Zustand at throttled rate (2-4Hz)
- W'bal, recording, ghost comparison → happen in the engine, not in `useEffect`

#### Rule 4: WebGL Is Decoupled From React Re-renders

- Probe WebGL **before** mounting R3F Canvas
- If WebGL fails → degrade to 2D, **never retry**
- Canvas receives updates via refs, not props

#### Rule 5: The EventBus Is the Only Cross-Engine Communication Channel

Engines never import other engines directly. Typed events only.

### Lessons Learned — The React #185 Postmortem

Commit `bb6be20` had a working-but-janky ride. Over the next **66 commits**, the codebase went through **23+ attempts** to fix "React #185" (Maximum update depth exceeded).

> **Reference branch**: `archive/react-185-journey`

#### The Cardinal Sins

| Sin | What Happened | Rule |
|-----|--------------|------|
| **#1: setState Inside Real-Time Loops** | setState() inside requestAnimationFrame → 60+ re-renders per second | Real-time data (10Hz telemetry) must **never** pass through React's reconciliation cycle. Use refs or Zustand with granular selectors. |
| **#2: Circular Hook Dependencies** | Hook A → Hook B → Hook C → Hook A. Every render created new function references → infinite loop | Hooks must form a **directed acyclic graph**. |
| **#3: Fixing Symptoms Instead of Root Cause** | 23+ commits targeted individual re-render sources without addressing: React should not own real-time state | Profile first. Fix the architecture, not the symptom. |
| **#4: God Component Orchestration** | Ride page was 1834 lines managing telemetry, AI coaching, audio, rewards, BLE, UI state, and 3D rendering | The ride page should be a thin layout shell (< 150 lines). Business logic lives in engines. UI state lives in stores. |
| **#5: WebGL Coupled to React Lifecycle** | R3F's `<Canvas>` calls setState on context loss → re-render → remount → context loss → death spiral | WebGL must be decoupled from React lifecycle. Probe before mounting. Never retry if it fails. |

### Anti-Pattern Catalog

| Anti-Pattern | Why It's Bad | Correct Approach |
|---|---|---|
| `setState` inside RAF/`useFrame` | Re-render on every frame | Direct ref mutation for real-time data |
| Array/object spread in high-frequency paths | GC pressure → frame drops | Pre-allocated buffers, direct mutation |
| `setInterval` for telemetry commit | Not synced to browser paint | RAF-aligned loop with throttled commits |
| Hooks returning new objects each render | Cascading `useEffect` dependencies | Stable refs or Zustand selectors |
| Custom `useCallback` chains | Impossible to verify correctness | Plain functions in engines |
| Props drilled through 5+ component layers | Fragile, hard to trace | Zustand store with granular selectors |
| Error boundaries for WebGL errors | Can't catch R3F's internal `setState` | WebGL probe + proactive degradation |
| Multiple timer sources competing with React | Unpredictable scheduling | Single EventBus + RAF |

---

## 3. Visualization Renderer System

### Renderer UX: Pre-Ride Selection

The renderer system is designed for **pre-ride selection**, not mid-ride switching:

1. **Instructor or route sets a default** — "Alpine Climb" uses Tron, "Coastal Ride" defaults to photogrammetry
2. **Rider can override in settings** — "I always want the Tron aesthetic" or "Surprise me"
3. **Auto-detection handles the rest** — "Photogrammetry" without compute shaders → falls back to Tron
4. **Future**: mid-ride pause switch (engine disposes current renderer, mounts new one)

**Key insight**: The ride logic never changes regardless of the renderer. Telemetry, coaching, rewards, and social features all work identically whether the rider sees neon vectors, photorealistic splats, or AI dreamscapes.

### The Renderer Interface

```typescript
interface Renderer {
  mount(canvas: HTMLCanvasElement, options: RenderOptions): void;
  update(snapshot: TelemetrySnapshot, context: RenderContext): void;
  pause(): void;
  resume(): void;
  dispose(): void;
  readonly label: string;
  readonly supportsWebGL: boolean;
}
```

### Renderer Implementations

#### Tron Renderer (Default)
- Neon vector-based aesthetic with Three.js/R3F
- GPU Cost: Low — works on most devices
- Assets: Procedurally generated (no texture loading)
- Fallback: SVG 2D if WebGL unavailable

#### Splat Renderer (Future)
- 3D Gaussian splats from photogrammetry
- GPU Cost: Medium-High — requires WebGL 2.0 compute shaders
- Assets: `.ply`/`.splat` files from Walrus
- Fallback: Degrades to Tron

#### AIGen Renderer (Future/Experimental)
- AI-generated 3D environments from latent diffusion models
- GPU Cost: Very High — requires WebGPU
- Assets: Streamed latent representations (~1MB per scene)
- Fallback: Degrades to Tron

### VisualizationEngine

```typescript
class VisualizationEngine {
  private currentRenderer: Renderer | null = null;
  private canvasRef: HTMLCanvasElement | null = null;

  async selectAndMount(canvas: HTMLCanvasElement, preferredMode: VisualMode): Promise<void> {
    this.canvasRef = canvas;
    const webgl = await probeWebGLAvailable();
    // ... select best renderer based on capability + preference
  }

  update(snapshot: TelemetrySnapshot, context: RenderContext): void {
    this.currentRenderer?.update(snapshot, context);
  }

  dispose(): void {
    this.currentRenderer?.dispose();
    this.currentRenderer = null;
  }
}
```

### GPU Probe Utility (`app/lib/gpu-probe.ts`)

```typescript
// probeWebGLAvailable() — test WebGL with throwaway canvas (never mount R3F without this)
// supportsComputeShaders() — required for SplatRenderer
// supportsWebGPU() — required for AIGenRenderer
```

### Renderer Selection Logic

```
Device loads ride page
       │
       ▼
Probe WebGL availability
       │
       ├── WebGL available ──┬── User prefers "immersive" → Tron
       │                     ├── User prefers "splat" → test compute → Splat or Tron
       │                     └── User prefers "dreamscape" → test WebGPU → AI or Tron
       │
       └── WebGL unavailable → Focus Renderer (2D SVG, always works)
```

---

## 4. Adaptive UX System

> **This is where the wedge lives.** The world reacts to the rider's effort in real-time. This is what makes SpinChain different.

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ADAPTIVE UX SYSTEM                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ World React. │  │  Flow State  │  │   Music Eng. │              │
│  │ Effort-based │  │ Sustained    │  │ BPM-synced   │              │
│  │ visual cues  │  │ performance  │  │ adaptive     │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         ▼                  ▼                  ▼                      │
│  ┌──────────────────────────────────────────────────┐              │
│  │              3D Visual Scene                      │              │
│  │  • Road emissive & glow, fog, lighting           │              │
│  │  • Particles, post-processing, speed lines       │              │
│  └──────────────────────────────────────────────────┘              │
│         ▲                                  ▲                        │
│  ┌──────┴──────────┐          ┌───────────┴──────────┐            │
│  │  Milestones &   │          │  Experience Level    │            │
│  │  Streaks (17)   │          │  (4 tiers)           │            │
│  └─────────────────┘          └──────────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.1 World Reactivity

Makes the 3D ride world respond to the rider's immediate effort.

**Input**: Power (W), HR (bpm), Cadence (RPM), Interval Phase (warmup/interval/sprint/recovery/cooldown)

**30+ reactive parameters per frame:**

| Parameter | Range | Driven By |
|-----------|-------|-----------|
| `roadGlowColor` | Phase color | Interval phase |
| `roadGlowIntensity` | 0.2 → 1.0 | Cadence + phase |
| `fogColor` | Theme → phase | Interval phase |
| `fogDensity` | 20 → 40 | Effort level |
| `skyTopColor` | Phase gradient | Interval phase |
| `ambientIntensity` | 0.3 → 0.5 | Effort (inverse) |
| `pointLightColor` | Phase color | Interval phase |
| `pointLightIntensity` | 1.0 → 2.5 | Power |
| `fovTarget` | 50° → 100° | Sprint intensity |
| `propEmissiveIntensity` | 0.5 → 2.0 | Effort |
| `speedLineSpeed` | 0.5 → 2.5 | Cadence |
| `riderAuraOpacity` | 0.05 → 0.55 | Power + HR |
| `riderAuraScale` | 1.0 → 1.7 | Power + HR |
| `sparkleOpacity` | 0.1 → 0.7 | Effort |
| `bloomIntensity` | 0.5 → 3.0 | Effort |
| `chromaticOffset` | 0 → 0.008 | Power > 300W |
| `vignetteDarkness` | 0.8 → 1.0 | Effort |
| `gridOpacity` | 0.0 → 0.6 | Effort |

**Computation**: `app/lib/flow-state.ts` → `computeFlowState()`

```typescript
// Pseudocode
const effort = Math.min(1, (power / 400) ** 0.6);
const roadGlowColor = lerpColor(themeColor, phaseColor, effort);
```

**Visual Effects**:
- Road glow shifts color with phase, pulses with cadence
- Fog denser during high effort
- Camera FOV widens during sprints (tunnel vision effect)
- Speed lines accelerate with cadence
- Rider aura intensifies with HR/power
- Post-processing (bloom, chromatic aberration, vignette) intensifies with effort

### 4.2 Flow State Engine

Tracks **sustained performance** to determine if the rider is in a flow state. Flow is not instant power — it's consistency near target over time.

**Flow Tiers:**

| Tier | State | Escalation Delay | Visual Multiplier |
|------|-------|-----------------|-------------------|
| 0 | Calm | Baseline | 1.0x |
| 1 | Focused | 8s at target | 1.2x |
| 2 | Flow | 15s at target | 1.5x |
| 3 | Super Flow | 25s at target | 1.8x |
| 4 | Mastery | 35s at target | 2.2x |

**Composite Score** (0.0 → 1.0):
1. **Consistency (40%)** — How close to interval target: `power / targetPower`, clamped 0.0 → 1.5
2. **Trajectory (25%)** — Improving or declining: rolling 10s window
3. **Duration (20%)** — Time spent at current tier (0 → 1 over delay)
4. **HR Zone (15%)** — Karvonen formula: `(HR - rest) / (max - rest)`

**Flow Events** (`tier-enter`, `tier-rise`, `tier-fall`, `sustained`, `peak`):
- Coach message → coaching store
- Haptic feedback → tier escalation
- Music intensity → flow tier scales music
- Visual effects → all reactive params scaled
- Analytics → flow time tracked

**Hook API**: `useFlowState(power, hr, hrResting)` returns tier, score, events, totalFlowMinutes, milestones.

### 4.3 Music Engine

BPM-synced background music that adapts to rider state and integrates with TTS coaching.

**Track Library** (12+ tracks, 6 categories):

| Phase | Category | BPM | Duration | Intensity |
|-------|----------|-----|----------|-----------|
| Sprint | High-energy | 138-145 | 3min | 0.85-1.0 |
| Interval | Focus | 120-125 | 5min | 0.6-0.7 |
| Warmup | Ambient | 100-105 | 5min | 0.4-0.5 |
| Recovery | Ambient | 75-80 | 5min | 0.25-0.3 |
| Cooldown | Ambient | 70 | 10min | 0.2 |
| Celebration | Celebration | 125-130 | 2-3min | 0.9-1.0 |

**BPM Sync**: Beat events generated from track BPM. Downbeats every 4 beats, accents every 2 beats.

**Ducking System**: Music reduces 70% during TTS, recovers at 50%/second. Smooth transitions, no clicks.

**Flow Integration**: BPM +2% per flow tier (capped 160). Intensity +20% per tier. Higher intensity tracks preferred at higher tiers.

### 4.4 Milestones & Streaks

Persistent achievement system. 17 milestone definitions across bronze → diamond tiers.

**Categories**: Duration (5m → 90m), Power (100W → 500W), HR (160 → 190 bpm), Cadence (90 → 120 RPM), Flow (2m → 20m in flow), Peak Flow Tier (super flow tier 3, mastery tier 4).

**Streak Tracking**: Current streak (consecutive daily rides), longest streak (all-time best). Broken if gap > 1 day.

**Persistent Memory** (`localStorage` key `spinchain-user-memory`): `totalRides`, `totalFlowMinutes`, `totalCalories`, `longestStreak`, `currentStreak`, `lastRideDate`, `firstRideDate`, `bestAvgPower`, `bestMaxPower`, `bestDuration`, `bestFlowMinutes`, `rides: Record<string, RideStats>`.

### 4.5 Experience Level

Adapts UI complexity based on rider proficiency.

| Tier | Rides | Label | Tutorial | HUD | Coach Style |
|------|-------|-------|----------|-----|-------------|
| 0 | 0-2 | New Rider | Full | Full | Guiding (40 words) |
| 1 | 3-9 | Developer | Reduced | Compact | Guiding |
| 2 | 10-29 | Racer | None | Compact | Concise (15 words) |
| 3 | 30+ | Veteran | None | Minimal | Concise |

**Persistent Profile** (`localStorage` key `spinchain-experience`): `totalRides`, `currentTier`, `preferredTheme`, `preferredCoach`, `tutorialDismissed: string[]`, `featureFlags: Record<string, boolean>`.

### 4.6 Context-Aware Palette

Adapts ride world to real-world conditions.

| Condition | Effect |
|-----------|--------|
| Time of day | Sky gradient shifts (dawn → night) |
| Season | Tint overlay (spring green, autumn orange, winter blue) |
| Weather | Extra fog, rain/snow particles, ambient multiplier |
| UI brightness | Scales with ambient lux |

**Key Files**:
- `app/lib/flow-state.ts` — Flow state engine
- `app/lib/music-engine.ts` — Music engine
- `app/lib/milestones.ts` — Milestones & streaks
- `app/lib/experience-level.ts` — Experience level
- `app/lib/context-palette.ts` — Context-aware palette
- `app/lib/phase-theme.ts` — Phase theme engine (single source of truth for ride colors/intensity)

---

## 5. Ride Experience v2

Five upgrades that make the SpinChain ride experience truly delightful:

### 5.1 Phase Theme Engine (`app/lib/phase-theme.ts`)

**Single source of truth** for how the entire ride looks and feels based on the current interval phase and effort level.

```typescript
computePhaseTheme(intervalPhase, effort)
// → { color, bg, glow, particle, intensity, pulseRate, bloomMultiplier, screenPulseOpacity }
```

Every visual element reads from this — background, HUD, particles, 3D scene, screen borders. **All synchronized to the same emotional state.**

### 5.2 Sensory Sync Store (`app/stores/sensory-store.ts`)

Zustand store acting as the conductor of the ride experience.

**Stores**: `latestEvent` (phase-change, sprint-start, pr-beat, ride-start), `countdownPhase` (none → three → two → one → go)

**Hook: `useSensorySync()`** — auto-detects events from store changes.
**Hook: `useSensoryEvent()`** — reads the latest event so visual components can animate.

**Why it matters**: When the interval changes, the audio cue, visual phase transition, haptic pulse, and coach message all fire within 200ms because they read from the same event store.

### 5.3 Pre-Ride Activation Sequence (`app/components/features/ride/ride-activation.tsx`)

Cinematic activation ritual with 3 phases:

| Phase | Time | What Happens |
|-------|------|-------------|
| Route Reveal | 0–3s | Ambient particles drift, class name fades in, phase orb pulses |
| Countdown | 3–6s | "GET READY" → 3 → 2 → 1 → GO with haptic sync |
| GO | 6s+ | Screen flashes to phase color, camera pushes forward, ride begins |

**Features**: Respects reduced-motion (instant skip), skip button after 2s, color adapts to workout phase.

### 5.4 Reactive HUD Overlay v2 (`app/components/features/ride/ride-hud-overlay-v2.tsx`)

Replaces 11+ simultaneous UI elements with **3 focal points** during active riding:

**Active Mode** (default):
1. Primary metric (biggest, center) — adapts to phase (sprint→Cadence, recovery→HR, otherwise→Power)
2. Phase badge (small, above primary) — color-coded with pulse
3. Ghost status (small, beside) — lead/lag time

**Expanded Mode** (tap to toggle): All 4 metrics, coach message, multi-ghost list.

**Phase-reactive behavior**: Background glow shifts color, metric cards breathe, screen edges pulse during sprints, particles accelerate, grid lines appear during high intensity (>70%).

### 5.5 Enhanced Flow Background (`app/components/features/ride/enhanced-flow-background.tsx`)

4-layer reactive background system:

| Layer | What |
|-------|------|
| Base Gradient | Phase color at low opacity, scales with effort |
| Floating Particles | 8–32 particles, golden-angle distribution |
| Grid Lines | Appear only >70% effort, "tunnel vision" effect |
| Event Flash | Phase change flash, PR celebration, sprint transitions |

### 5.6 Completion Celebration v2 (`app/components/features/ride/ride-completion-v2.tsx`)

Replaces the administrative "3-tab dashboard" with a celebration sequence:

| Phase | Time | What |
|-------|------|------|
| CELEBRATION | 0–2.5s | "DONE" text with particle burst, PR badge, agent debrief as hero message |
| STATS | 2.5s+ | Clean stat row, SPIN in golden highlight box, share card |
| ACTIONS | persistent | View History / Ride Again / Claim rewards / Export TCX |

**Visual layers (back to front)**: Background gradient → pulse overlay → sprint edge flash → particles → phase badge → primary metric → ghost badge → coach message → settlement stream (yellow mode only).

### How It All Fits Together

```
Ride Page
├── RideActivationSequence
│   └── useSensorySync() → writes countdown events
├── RideVisualization
│   └── EnhancedFlowBackground → reads phase theme + sensory events
│       └── computePhaseTheme() → single source of truth
├── RideHUDOverlayV2
│   ├── useSensoryEvent() → reads latest event
│   └── computePhaseTheme() → drives all colors
└── RideCompletionV2
    ├── useSensoryStore → PR celebration event
    └── Agent debrief → hero message, not a tab
```

---

## 6. Transitions & Modal Discipline

### The Transition System

The ride flows through states with smooth, choreographed transitions:

```
LOADING → ACTIVATION → RIDING → EXITING → COMPLETION → DONE
```

| State | Duration | Animation | Blocks View |
|-------|----------|-----------|-------------|
| `loading` | 0-4s | Fade in/out (400ms) | ✅ Full screen |
| `activation` | ~2.5s | 3-2-1 countdown, scale + fade | ✅ Partial (transparent) |
| `entering` | 500ms | Fade out activation, camera pushes in | No |
| `riding` | indefinite | Normal HUD | No |
| `exiting` | 500ms | Fade out HUD, save spinner | ✅ Partial (dim) |
| `completion` | indefinite | Celebration particles, fade in | Partial |
| `done` | indefinite | Dismiss to journey | Partial |

**Key rule**: No two blocking overlays are ever visible simultaneously.

### Modal Stack Discipline

**Rule: Only 1 modal visible at a time.**

| Priority | Type | Example | Dismissible? | Auto-dismiss? |
|----------|------|---------|--------------|---------------|
| 100 | CRITICAL | Exit confirmation | ✅ Yes | ❌ No |
| 90 | INFORMATIONAL | Tutorial | ✅ Yes | ❌ No |
| 80 | TRANSIENT | Milestone celebration | ✅ Yes | ✅ 2s |
| 70 | TRANSIENT | No-bike prompt | ✅ Yes | ❌ No |
| 60 | TRANSIENT | Keyboard hints | ✅ Yes | ✅ 3s |
| 50 | INFORMATIONAL | Demo complete | ✅ Yes | ❌ No |

**Stack Rules**:
1. Only 1 modal at a time — new modal dismisses the current one
2. Critical modals can't be bypassed — exit confirm must be answered
3. Transient modals auto-dismiss after timeout
4. Backdrop dismisses informationals and transients, NOT critical modals
5. Escape key always dismisses dismissable modals

### Coach Channel (`app/components/features/ride/coach-channel.tsx`)

Replaces full-screen coach overlay. Bottom-aligned messaging system that sits above the HUD without blocking the 3D world.

- **Compact state** (default): Small pill with coach icon + first line of message, auto-expands for 5s on new message
- **Expanded state**: Full message card with "Speaking" indicator when TTS active, tap to collapse
- **Design**: Sits above the HUD panel, never blocks the 3D world, phase color accent bar pulses when speaking

### Mobile Gesture Support

| Gesture | Action | When |
|---------|--------|------|
| Swipe down | Dismiss transient modals (keyboard hints) | Active riding |
| Swipe up | Expand coach channel messages | Coach message visible |
| Swipe right from left edge | Go back / dismiss modal | Any overlay visible |
| Swipe left from right edge | Open options menu | Active riding |

**Implementation**: `useSwipeGesture` hook — min 80px, max 300ms, ignores buttons/links/inputs, respects reduced-motion.

### Reduced Motion Respect

All transitions respect `prefers-reduced-motion`: loading/activation 500ms→150ms, countdown instant skip, modals instant, swipe gestures disabled entirely, auto-animations disabled.

---

## 7. Yellow Network

Real-time reward settlement via state channels. High-fidelity, real-time reward accrual for riders without on-chain gas fees for every telemetry update.

### Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Off-Chain Accrual | Nitro RPC + ClearNode | Telemetry → signed state updates → reward calculation every few seconds |
| Participant Co-signing | EIP-712 typed data | Rider signs final state, Instructor co-signs via Settlement Hub |
| On-Chain Settlement | Avalanche Fuji | Batch settlement, gas savings up to 85%, proof verification before minting |

### User Experience

**For Riders**: Live SPIN ticker in HUD, stream status indicator (ClearNode connection health), instant finality on ride summary.

**For Instructors**: Queue management dashboard, one-click settle via ERC-7715 permissions, gas savings visualization.

### Technical Details

- **Transport**: WebSocket (`wss://`) to ClearNode
- **Signing**: Ephemeral Session Keys (localStorage, high-frequency) + Wallet Signing (EIP-712, final settlement)
- **Contracts**: `YellowSettlement.sol` on Avalanche Fuji — verifies rider + instructor signatures before minting SPIN

### Why Yellow?
1. **Zero-Latency Rewards**: Users see balance grow every second
2. **Zero-Cost Telemetry**: High-resolution workout data verified without gas
3. **Decentralized Trust**: Rewards only minted when both athlete and coach agree

---

## 8. Performance Guidelines

### Writing Engines

```typescript
// ✅ GOOD: Explicit dependencies, no hidden state
class TelemetryEngine {
  constructor(
    private readonly bus: EventBus,
    private readonly config: EngineConfig,
  ) {
    this.bus.on("telemetry:ingest", this.handleIngest);
  }
}

// ❌ BAD: Implicit global state
class TelemetryEngine {
  constructor() {
    // Don't import Zustand stores directly in constructors
    // Don't use globals
  }
}
```

### Writing Components

```typescript
// ✅ GOOD: Granular selector, no unnecessary re-renders
function PowerGauge() {
  const power = useRideStore((s) => s.telemetry.power);
  return <Gauge value={power} max={500} label="Power" />;
}

// ❌ BAD: Whole-store subscription
function BadPowerGauge() {
  const store = useRideStore(); // Re-renders on EVERY state change
  return <Gauge value={store.telemetry.power} max={500} label="Power" />;
}
```

### Performance Profiling

Before merging any PR that touches the ride experience:

1. Open Chrome DevTools → Performance tab
2. Record 10 seconds of ride experience
3. Verify:
   - No frame drops below 30fps on desktop
   - No frame drops below 20fps on mobile emulation
   - No forced reflows or layout thrashing
   - `setState` is never called inside `requestAnimationFrame`
   - Zustand subscriptions are granular (no full-store subscriptions)

### Measuring Success

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Ride page line count | < 150 lines | `wc -l app/rider/ride/[classId]/page.tsx` |
| Re-renders per second | < 3 | React DevTools profiler |
| Telemetry commit rate | 2-4Hz | Console log timestamps |
| WebGL probe time | < 50ms | `performance.mark()` |
| Renderer switch time | < 100ms | `performance.mark()` |
| TypeScript errors | 0 | `npx tsc --noEmit` |
| Memory growth during ride | < 50MB | Chrome Memory tab |

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

## File Map

### Engines Directory (`app/engines/`)

```
app/engines/
├── event-bus.ts          # Typed event bus
├── types.ts              # All shared types
├── coordinator.ts        # RideCoordinator — wires everything
├── telemetry-engine.ts   # BLE/simulator ingestion, W'bal, recording
├── device-engine.ts      # BLE connection management, simulator
├── coaching-engine.ts    # AI coaching logic
├── audio-engine.ts       # Sound effects, voice synthesis
├── rewards-engine.ts     # SPIN reward accrual, Yellow, ZK batch
├── sui-engine.ts         # Sui Move contract interactions
├── social-engine.ts      # Multi-ghost, social feed
├── visualization-engine.ts  # Renderer management, WebGL lifecycle
├── renderers/
│   ├── interface.ts        # Renderer interface
│   ├── tron-renderer.ts    # Neon vector 3D ("immersive")
│   ├── focus-renderer.ts   # 2D SVG fallback ("focus" mode)
│   ├── splat-renderer.ts   # Gaussian splats (future)
│   └── ai-renderer.ts      # AI-gen environments (future)
└── index.ts              # Re-export all
```

### Stores (Read by Components)

```
app/stores/
├── ride-store.ts       # Telemetry, lifecycle, workout state
├── coaching-store.ts   # AI coach state, agent decisions
├── ui-store.ts         # HUD mode, panel state, view preferences
├── sensory-store.ts    # Sensory events state
└── ride-modal-store.ts # Modal state
```

### Migrated Hooks

```
app/hooks/ride/
├── use-ride-lifecycle.ts   → Merged into LifecycleEngine
├── use-ride-coach.ts       → Merged into CoachingEngine
├── use-workout-agent.ts    → Merged into CoachingEngine
├── use-workout-audio.ts    → Merged into AudioEngine
├── use-coach-voice.ts      → Merged into AudioEngine
├── use-rewards.ts          → Merged into RewardsEngine
├── use-simulated-rewards.ts → Merged into RewardsEngine
├── use-multi-ghost.ts      → Merged into SocialEngine
```

### Key Libraries

```
app/lib/
├── flow-state.ts           # Flow state engine
├── music-engine.ts         # Music engine
├── milestones.ts           # Milestones & streaks
├── experience-level.ts     # Experience level
├── context-palette.ts      # Context-aware palette
├── phase-theme.ts          # Phase theme engine
├── gpu-probe.ts            # GPU capability detection
├── route-library.ts        # Route storage
├── route-generation.ts     # Route generation
└── profile-service.ts      # Rider profiles
```

---

*Last updated: 2026-08-17*
*This document supersedes all earlier architectural notes. When in doubt, follow the rules in Section 2 and the wedge discipline in [WEDGE.md](./WEDGE.md).*

**Single source of truth** for how the entire ride looks and feels based on the current interval phase and effort level.

```typescript
computePhaseTheme(intervalPhase, effort)
// → { color, bg, glow, particle, intensity, pulseRate, bloomMultiplier, screenPulseOpacity }
```

Every visual element reads from this — background, HUD, particles, 3D scene, screen borders. **All synchronized to the same emotional state.**

### 5.2 Sensory Sync Store (`app/stores/sensory-store.ts`)

Zustand store acting as the conductor of the ride experience.

**Stores**: `latestEvent` (phase-change, sprint-start, pr-beat, ride-start), `countdownPhase` (none → three → two → one → go)

**Hook: `useSensorySync()`** — auto-detects events from store changes.
**Hook: `useSensoryEvent()`** — reads the latest event so visual components can animate.

**Why it matters**: When the interval changes, the audio cue, visual phase transition, haptic pulse, and coach message all fire within 200ms because they read from the same event store.

### 5.3 Pre-Ride Activation Sequence (`app/components/features/ride/ride-activation.tsx`)

Cinematic activation ritual with 3 phases:

| Phase | Time | What Happens |
|-------|------|-------------|
| Route Reveal | 0–3s | Ambient particles drift, class name fades in, phase orb pulses |
| Countdown | 3–6s | "GET READY" → 3 → 2 → 1 → GO with haptic sync |
| GO | 6s+ | Screen flashes to phase color, camera pushes forward, ride begins |

**Features**: Respects reduced-motion (instant skip), skip button after 2s, color adapts to workout phase.

### 5.4 Reactive HUD Overlay v2 (`app/components/features/ride/ride-hud-overlay-v2.tsx`)

Replaces 11+ simultaneous UI elements with **3 focal points** during active riding:

**Active Mode** (default):
1. Primary metric (biggest, center) — adapts to phase (sprint→Cadence, recovery→HR, otherwise→Power)
2. Phase badge (small, above primary) — color-coded with pulse
3. Ghost status (small, beside) — lead/lag time

**Expanded Mode** (tap to toggle): All 4 metrics, coach message, multi-ghost list.

**Phase-reactive behavior**: Background glow shifts color, metric cards breathe, screen edges pulse during sprints, particles accelerate, grid lines appear during high intensity (>70%).

### 5.5 Enhanced Flow Background (`app/components/features/ride/enhanced-flow-background.tsx`)

4-layer reactive background system:

| Layer | What |
|-------|------|
| Base Gradient | Phase color at low opacity, scales with effort |
| Floating Particles | 8–32 particles, golden-angle distribution |
| Grid Lines | Appear only >70% effort, "tunnel vision" effect |
| Event Flash | Phase change flash, PR celebration, sprint transitions |

### 5.6 Completion Celebration v2 (`app/components/features/ride/ride-completion-v2.tsx`)

Replaces the administrative "3-tab dashboard" with a celebration sequence:

| Phase | Time | What |
|-------|------|------|
| CELEBRATION | 0–2.5s | "DONE" text with particle burst, PR badge, agent debrief as hero message |
| STATS | 2.5s+ | Clean stat row, SPIN in golden highlight box, share card |
| ACTIONS | persistent | View History / Ride Again / Claim rewards / Export TCX |

**Visual layers (back to front)**: Background gradient → pulse overlay → sprint edge flash → particles → phase badge → primary metric → ghost badge → coach message → settlement stream (yellow mode only).

### How It All Fits Together

```
Ride Page
├── RideActivationSequence
│   └── useSensorySync() → writes countdown events
├── RideVisualization
│   └── EnhancedFlowBackground → reads phase theme + sensory events
│       └── computePhaseTheme() → single source of truth
├── RideHUDOverlayV2
│   ├── useSensoryEvent() → reads latest event
│   └── computePhaseTheme() → drives all colors
└── RideCompletionV2
    ├── useSensoryStore → PR celebration event
    └── Agent debrief → hero message, not a tab
```