# SpinChain Architecture Guide

> **Purpose**: This document is the single source of truth for the SpinChain ride architecture. It captures lessons learned from past mistakes, defines the engine architecture, describes the visualization renderer system, and lays out the implementation plan.

---

## Part 1: Lessons Learned — The React #185 Postmortem

### Background

Commit `bb6be20` had a working-but-janky ride experience. Over the next **66 commits**, the codebase went through **23+ attempts** to fix "React #185" (Maximum update depth exceeded). The final fixes worked, but the journey revealed deep anti-patterns.

> **Reference branch**: The full 66-commit history of this struggle is preserved in `archive/react-185-journey`. Run `git log archive/react-185-journey --oneline` to see all 23+ fix attempts.

### The Cardinal Sins

#### Sin #1: setState Inside Real-Time Loops

**What happened**: `setState()` was called inside `requestAnimationFrame` callbacks and R3F's `useFrame`. This created a re-render on every animation frame — 60+ re-renders per second.

```
RAF callback → setState(state) → React re-render → new callback created → new setState → ...
```

**Rule**: Real-time data (telemetry at 10Hz) must **never** pass through React's reconciliation cycle. Use plain `useRef` mutation or Zustand stores with granular selectors.

#### Sin #2: Circular Hook Dependencies

**What happened**: Hook A depended on Hook B's return value. Hook B depended on Hook C. Hook C depended on Hook A. Every render created new function references, triggering cascading `useEffect` calls, creating an infinite re-render loop.

```
useRideCoach → useWorkoutAudio → useCoachVoice → useRideCoach
```

**Rule**: Hooks must form a **directed acyclic graph**. If Hook A is used by Hook B, Hook B must never be used by Hook A or any of Hook A's dependencies.

#### Sin #3: Fixing Symptoms Instead of Root Cause

**What happened**: 23+ commits targeted individual re-render sources (hook callback stability, memo barriers, etc.) without addressing the systemic problem: **React should not own real-time state**.

Each "fix" would stabilize one path, but the underlying architecture would re-introduce the same issue elsewhere.

**Rule**: Profile first. Identify the actual cycle. Fix the architecture, not the symptom.

#### Sin #4: God Component Orchestration

**What happened**: The ride page was 1834 lines managing telemetry, AI coaching, audio, rewards, BLE, UI state, and 3D rendering — all in one file. Every hook imported into this file created implicit coupling.

**Rule**: The ride page should be a thin layout shell (< 150 lines). Business logic lives in engines. UI state lives in stores. The page only composes components.

#### Sin #5: WebGL Coupled to React Lifecycle

**What happened**: R3F's `<Canvas>` component internally calls `setState` when WebGL context is lost. This `setState` triggers a React re-render, which re-mounts `<Canvas>`, which immediately loses context again — an unrecoverable death spiral that no error boundary can catch.

```
WebGL context loss → R3F setState → React re-render → Canvas remount → WebGL context loss → ...
```

**Rule**: WebGL must be decoupled from React lifecycle. Probe WebGL before mounting. Never retry WebGL if it fails. Degrade gracefully to 2D.

### The Anti-Pattern Catalog

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

## Part 2: The Engine Architecture

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

Engines live in `app/engines/` and are **not hooks**. They do not use `useState`, `useEffect`, `useCallback`, or any React API.

```typescript
// ✅ CORRECT — Plain TS class
class TelemetryEngine {
  private bus: EventBus;
  private rawSnapshot: TelemetrySnapshot;

  constructor(bus: EventBus) {
    this.bus = bus;
    this.rawSnapshot = createEmptySnapshot();
  }

  ingest(update: Partial<TelemetrySnapshot>): void {
    Object.assign(this.rawSnapshot, update);
    // Only emit when UI needs to react
    this.bus.emit("telemetry:ingest", this.rawSnapshot);
  }
}

// ❌ WRONG — Don't wrap engines in hooks
function useTelemetryEngine(): TelemetryData {
  // No. Engines are instantiated once in the coordinator.
}
```

#### Rule 2: React Reads From Zustand, Never From Engines

Components read state via Zustand selectors:

```typescript
// ✅ CORRECT — Granular selector
function PowerDisplay() {
  const power = useRideStore((s) => s.telemetry.power);
  return <span>{power}W</span>;
}

// ✅ CORRECT — Engine writes to Zustand when UI needs to update
class TelemetryEngine {
  commitToUI(): void {
    useRideStore.setState({
      telemetry: { ...this.rawSnapshot },
    });
  }
}

// ❌ WRONG — Don't read engine internals from components
function BadComponent() {
  const engine = useTelemetryEngine(); // No!
  return <span>{engine.rawSnapshot.power}W</span>;
}
```

#### Rule 3: Telemetry Data Never Passes Through React State

- BLE/Simulator → writes directly to `TelemetryEngine`'s internal refs
- UI-relevant snapshots → committed to Zustand at throttled rate (2-4Hz)
- Ride recording, ghost comparison, W'bal calculations → happen in the engine, not in `useEffect`

```typescript
// ✅ CORRECT
class TelemetryEngine {
  private rawSnapshot = createEmptySnapshot(); // mutable, non-reactive
  private commitInterval: number = 250; // 4Hz for UI

  ingest(update: Partial<TelemetrySnapshot>): void {
    Object.assign(this.rawSnapshot, update);
    // No setState here. UI is updated at a fixed rate elsewhere.
  }

  flushToUI(): void {
    useRideStore.setState({ telemetry: { ...this.rawSnapshot } });
  }
}
```

#### Rule 4: WebGL Is Decoupled From React Re-renders

- Probe WebGL **before** mounting R3F Canvas
- If WebGL fails → degrade to 2D, **never retry**
- Canvas receives updates via refs, not props
- WebGL context loss is handled at the engine level, not in error boundaries

```typescript
class VisualizationEngine {
  private renderer: Renderer | null = null;
  private webglAvailable: boolean = false;

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.webglAvailable = await probeWebGLAvailable();
    if (!this.webglAvailable) {
      this.renderer = new SVGRenderer(canvas); // 2D fallback
      return;
    }
    this.renderer = new TronRenderer(canvas); // 3D
    this.renderer.mount();
  }
}
```

#### Rule 5: The EventBus Is the Only Cross-Engine Communication Channel

Engines never import other engines directly. They communicate through typed events:

```typescript
class RideCoordinator {
  constructor() {
    this.bus = new EventBus();

    this.bus.on("telemetry:ingest", (data) => {
      // engines react to telemetry
      this.coaching.onTelemetry(data);
      this.rewards.onTelemetry(data);
    });

    this.bus.on("lifecycle:complete", () => {
      this.rewards.finalize();
      this.audio.stopAll();
    });
  }
}
```

---

## Part 3: Visualization Renderer System

### Rider UX: When and How Visual Modes Are Used

The renderer system is designed for **pre-ride selection**, not mid-ride switching (to avoid re-initialization latency). The flow:

1. **Instructor or route sets a default** — Each class or route can specify a preferred visual mode (e.g., "Alpine Climb" uses Tron, "Coastal Ride" defaults to photogrammetry)
2. **Rider can override in settings** — Per-user preference: "I always want the Tron aesthetic" or "Surprise me with the best my GPU can handle"
3. **Auto-detection handles the rest** — If the rider selects "Photogrammetry" but their device doesn't support compute shaders, it gracefully falls back to Tron
4. **Future: mid-ride pause switch** — During a paused ride, the rider could switch modes (the engine would dispose the current renderer and mount the new one), but this is a post-MVP enhancement

The key insight: **the ride logic never changes regardless of the renderer**. Telemetry, coaching, rewards, and social features all work identically whether the rider sees neon vectors, photorealistic splats, or AI dreamscapes.

### The Renderer Interface

Each visual mode implements this interface:

```typescript
interface Renderer {
  /** Called once when the renderer is selected */
  mount(canvas: HTMLCanvasElement, options: RenderOptions): void;

  /** Called every frame with current telemetry */
  update(snapshot: TelemetrySnapshot, context: RenderContext): void;

  /** Called when the ride is paused */
  pause(): void;

  /** Called when the ride resumes */
  resume(): void;

  /** Called when the renderer is no longer needed */
  dispose(): void;

  /** Human-readable label for UI selection */
  readonly label: string;
  readonly supportsWebGL: boolean;
}
```

### Renderer Implementations

#### Tron Renderer (Default)

- **Description**: Neon vector-based aesthetic with Three.js/R3F
- **GPU Cost**: Low — works on most devices
- **Assets**: Procedurally generated geometry (no texture loading)
- **Fallback**: SVG 2D if WebGL unavailable

```typescript
class TronRenderer implements Renderer {
  label = "Tron";
  supportsWebGL = true;

  mount(canvas: HTMLCanvasElement, options: RenderOptions): void {
    // Initialize Three.js scene with neon shaders
    // No texture loading, fast startup
  }

  update(snapshot: TelemetrySnapshot, context: RenderContext): void {
    // Update track geometry, ghost riders, particle effects
    // All mutations happen outside React
  }
}
```

#### Splat Renderer (Future)

- **Description**: 3D Gaussian splats from real-world photogrammetry
- **GPU Cost**: Medium-High — requires WebGL 2.0 compute shaders
- **Assets**: Loads `.ply`/`.splat` files from Walrus storage
- **Fallback**: Degrades to Tron if GPU doesn't support compute shaders
- **Data source**: Drone capture + Google Maps aerial photogrammetry — the route's real-world path becomes a fully navigable 3D environment

```typescript
class SplatRenderer implements Renderer {
  label = "Photogrammetry";
  supportsWebGL = true;

  async mount(canvas: HTMLCanvasElement, options: RenderOptions): Promise<void> {
    const supported = await checkComputeShaderSupport();
    if (!supported) throw new Error("Compute shaders not available");
    // Load splat data, initialize WebGL compute pipeline
    // Stream route-specific splat data from Walrus
  }
}
```

#### AI Renderer (Future/Experimental)

- **Description**: AI-generated 3D environments from latent diffusion models. Takes the route's GPX data as input and generates a dreamlike, immersive world around it — "Gaussian splats combined with AI generate fully navigable 3D environments"
- **GPU Cost**: Very High — requires dedicated GPU and WebGPU
- **Assets**: Streamed latent representations (lightweight, ~1MB per scene)
- **Fallback**: Degrades to Tron if WebGPU unavailable

```typescript
class AIGenRenderer implements Renderer {
  label = "Dreamscape";
  supportsWebGL = true;
  requiresWebGPU = true;

  async mount(canvas: HTMLCanvasElement, options: RenderOptions): Promise<void> {
    if (!navigator.gpu) throw new Error("WebGPU not available");
    // Initialize WebGPU compute pipeline
    // Load latent scene representation
    // Begin streaming denoising steps
  }
}
```

### VisualizationEngine

```typescript
class VisualizationEngine {
  private currentRenderer: Renderer | null = null;
  private fallbackRenderer: FocusRenderer;
  private canvasRef: HTMLCanvasElement | null = null;

  /** Probes WebGL, selects best renderer, mounts it */
  async selectAndMount(
    canvas: HTMLCanvasElement,
    preferredMode: VisualMode,
  ): Promise<void> {
    this.canvasRef = canvas;
    const webgl = await probeWebGLAvailable();

    if (preferredMode === "splat" && webgl) {
      const splat = new SplatRenderer();
      if (await supportsComputeShaders()) {
        this.currentRenderer = splat;
        await splat.mount(canvas, {});
        return;
      }
    }

    if (preferredMode === "immersive" && webgl) {
      this.currentRenderer = new TronRenderer();
      this.currentRenderer.mount(canvas, {});
      return;
    }

    // Default: 2D fallback (always works, zero GPU)
    this.currentRenderer = new FocusRenderer();
    this.currentRenderer.mount(canvas, {});
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

### Renderer Selection Logic

```
Device loads ride page
       │
       ▼
Probe WebGL availability (app/lib/gpu-probe.ts)
       │
       ├── WebGL available ──┬── User prefers "immersive" → Tron Renderer
       │                     ├── User prefers "splat" → test compute shaders → Splat or Tron
       │                     └── User prefers "dreamscape" → test WebGPU → AI or Tron
       │
       └── WebGL unavailable → Focus Renderer (2D SVG, always works)
```

### GPU Probe Utility (`app/lib/gpu-probe.ts`)

A shared utility module for all GPU capability detection:

```typescript
// app/lib/gpu-probe.ts

/** Tests WebGL support with a throwaway canvas (never mount R3F without this check) */
export async function probeWebGLAvailable(): Promise<boolean> {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) return false;
  // Check for required extensions
  const ext = gl.getExtension("WEBGL_lose_context");
  if (ext) ext.loseContext();
  return true;
}

/** Tests WebGL 2.0 compute shader support (required for SplatRenderer) */
export async function supportsComputeShaders(): Promise<boolean> {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) return false;
  return Boolean(gl.getExtension("WEBGL_compute_shader"));
}

/** Tests WebGPU support (required for AIGenRenderer) */
export async function supportsWebGPU(): Promise<boolean> {
  return Boolean(navigator.gpu);
}
```

---

## Part 4: Implementation Plan

### Build Order

Each step produces a working, type-checked codebase. Steps are designed to be mergeable independently.

#### Step 1: Engine Skeleton

**Files to create**: `app/engines/event-bus.ts`, `app/engines/types.ts`, `app/engines/coordinator.ts`, `app/engines/telemetry-engine.ts`, `app/engines/device-engine.ts`, `app/engines/index.ts`

**What it does**: Creates the engine directory structure with typed EventBus and skeleton engines. No existing code is removed. The coordinator is instantiated alongside the existing hooks for cross-validation.

**Validation**: `npx tsc --noEmit` passes. Engines can be instantiated in a test.

#### Step 2: Wire Coordinator Into Ride Page

**What it does**: The coordinator's `TelemetryEngine.ingest()` replaces the inline ref mutation in `page.tsx`. The page's `handleBleMetrics` and `handleSimulatorMetrics` delegate to the engine. The UI still reads from the same Zustand state.

**Key change**: The telemetry commit logic moves from `setInterval` in `useEffect` to `TelemetryEngine.flushToUI()` called at a throttled RAF rate.

**Validation**: Ride page works exactly as before. Same data, same UI, but the telemetry pipeline now flows through the engine.

#### Step 3: Migrate Features to Engines (One at a Time)

**Order of migration**:
1. `AudioEngine` — from `useWorkoutAudio` + `useCoachVoice`
2. `CoachingEngine` — from `useRideCoach` + `useWorkoutAgent`
3. `RewardsEngine` — from `useRewards` + `useSimulatedRewards`
4. `SuiEngine` — from Sui session hooks
5. `SocialEngine` — from social ride hooks

**Each migration**: Create the engine class + tests. The hook still exists but delegates to the engine. The page imports are updated one at a time.

**Validation**: After each engine migration, the ride still works. TypeScript check passes.

#### Step 4: Decouple Visualization

**Files to create/restructure**: `app/engines/visualization-engine.ts`, renderer implementations

**What it does**:
- Extracts R3F Canvas lifecycle from `page.tsx` into `VisualizationEngine`
- Adds WebGL probe before Canvas mount
- Creates SVG 2D fallback renderer
- Canvas receives telemetry via refs, not props

**Key fix**: The WebGL context loss death spiral is eliminated. If WebGL fails once, the session permanently uses 2D.

**Validation**: Ride works in both immersive (3D) and focus (2D) modes. WebGL failure degrades gracefully.

#### Step 5: Delete the God Component

**What it does**: The 1834-line `page.tsx` becomes a thin layout shell:
- Reads from Zustand stores
- Composes existing components (`RideHUDOverlay`, `RideModals`, etc.)
- Instantiates `RideCoordinator` via context
- Calls coordinator.start/stop on user actions

**Target size**: ~100-150 lines.

**Validation**: Ride works identically to before. No behavior change.

#### Step 6: Add Renderer Abstraction

**What it does**:
- Defines the `Renderer` interface
- Refactors existing R3F code into `TronRenderer`
- Creates `SVGRenderer` from existing focus mode
- `VisualizationEngine.selectAndMount()` handles renderer selection
- Device capability detection + user preference determines renderer choice

**Validation**: Tron and SVG modes work. Future renderers can be added without touching ride logic.

### Testing Strategy Per Step

> **Note on test infrastructure**: The project currently uses Foundry for Solidity tests and Nargo for Noir circuits. TypeScript tests (`vitest` recommended) should be configured in a future step. For now, validation relies on TypeScript compilation (`npx tsc --noEmit`) and manual ride testing.

| Step | Validation |
|------|-----------|
| 1 | `npx tsc --noEmit`, manual EventBus wire test |
| 2 | Manual ride test, telemetry appears in HUD |
| 3 | After each engine: manual ride test, `npx tsc --noEmit` |
| 4 | WebGL probe test, 2D fallback test, immersive mode works |
| 5 | Full ride flow E2E (start → ride → exit) |
| 6 | Renderer switching test, GPU capability detection |

### Risk & Rollback Strategy

Each step in the implementation plan produces a **self-contained, mergeable commit**. If a step introduces a regression:

1. **Revert the last commit**: `git revert <commit-hash>` — this is atomic and safe because each step is self-contained
2. **The engines co-exist with hooks during migration** — Steps 1-3 never delete existing hooks, they just add engines alongside them. The page continues to work via the old hooks even if the engine wiring has a bug
3. **Branch strategy**: Work on `feature/engine-architecture` branch. Merge to `main` only when all 6 steps pass validation
4. **Fallback**: If the entire migration fails, `main` can be reset to `bb6be20` (the last known working state, preserved in `archive/react-185-journey`)

---

## Part 5: Code Quality & Performance Guidelines

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

---

## Appendix: File Map

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

### Stores (Read by Components)
```
app/stores/
├── ride-store.ts       # Telemetry, lifecycle, workout state
├── coaching-store.ts   # AI coach state, agent decisions
└── ui-store.ts         # HUD mode, panel state, view preferences
```
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

### Stores (Read by Components)
```
app/stores/
├── ride-store.ts       # Telemetry, lifecycle, workout state
├── coaching-store.ts   # AI coach state, agent decisions
└── ui-store.ts         # HUD mode, panel state, view preferences
```

---

*Last updated: June 2, 2026*
*This document supersedes all earlier architectural notes. When in doubt, follow the rules in Part 2.*
