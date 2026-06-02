/**
 * VisualizationEngine — Probes GPU capabilities, selects the optimal
 * render mode (Tron 3D vs Focus 2D), and monitors runtime performance
 * for graceful degradation.
 *
 * Design rules:
 * - Pure TS class — no React imports.
 * - GPU probe is synchronous and cached (see gpu-probe.ts).
 * - Degradation is event-driven via EventBus so the React layer can react.
 * - The engine recommends a mode but the UI layer ultimately decides
 *   whether to render the 3D scene or the 2D fallback.
 */

import { EventBus } from "./event-bus";
import { probeGpu, getQualitySettings } from "@/app/lib/gpu-probe";
import type { VisualizationConfig, RenderMode } from "./types";

export interface VisualizationEngineConfig {
  /** Allow override — "auto" lets the engine decide based on probe */
  preferredMode?: RenderMode | "auto";
  /** How often to re-check FPS for degradation (ms). 0 = no monitoring */
  monitorIntervalMs?: number;
  /** FPS below this threshold triggers a degradation event */
  fpsThreshold?: number;
  /** Number of consecutive low-FPS samples before degrading */
  lowFpsSampleCount?: number;
}

const DEFAULTS: Required<VisualizationEngineConfig> = {
  preferredMode: "auto",
  monitorIntervalMs: 5_000,
  fpsThreshold: 25,
  lowFpsSampleCount: 3,
};

export class VisualizationEngine {
  private readonly bus: EventBus;
  private config: Required<VisualizationEngineConfig>;
  private monitorTimerId: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  /** Current configuration (recomputed when mode changes) */
  currentConfig: VisualizationConfig;

  /** Rolling FPS samples for degradation detection */
  private fpsHistory: number[] = [];

  /** Last N timestamps for FPS computation */
  private frameTimestamps: number[] = [];

  /** Whether degradation has been emitted (avoids spamming) */
  private degradedEmitted = false;

  constructor(
    bus: EventBus,
    config?: VisualizationEngineConfig,
  ) {
    this.bus = bus;
    this.config = { ...DEFAULTS, ...config };

    const probe = probeGpu();
    const quality = getQualitySettings(probe);

    const mode: RenderMode =
      this.config.preferredMode === "auto"
        ? probe.recommendedMode
        : this.config.preferredMode;

    this.currentConfig = {
      mode,
      canRender3d: probe.recommendedMode === "tron-3d",
      quality,
      gpu: {
        webgl2: probe.webgl2,
        webgpu: probe.webgpu,
        vendor: probe.vendor,
        isLowEnd: probe.isLowEnd,
        canPostProcess: probe.canPostProcess,
      },
      degraded: false,
      lastDegradedAt: null,
    };
  }

  // ─── Lifecycle ─────────────────────────────────────────────────

  /** Begin monitoring FPS for degradation detection */
  start(): void {
    if (this.disposed) return;
    if (this.config.monitorIntervalMs > 0) {
      this.monitorTimerId = setInterval(() => {
        this.checkDegradation();
      }, this.config.monitorIntervalMs);
    }
  }

  /** Stop monitoring — call when the ride ends or component unmounts */
  stop(): void {
    this.clearMonitor();
  }

  dispose(): void {
    this.disposed = true;
    this.clearMonitor();
    this.frameTimestamps.length = 0;
    this.fpsHistory.length = 0;
  }

  // ─── FPS Sampling ─────────────────────────────────────────────

  /**
   * Call this from the render loop's requestAnimationFrame to feed
   * frame timestamps for FPS computation.
   */
  onFrame(): void {
    if (this.disposed) return;
    const now = performance.now();
    this.frameTimestamps.push(now);

    // Keep only the last ~2 seconds of frames
    const cutoff = now - 2000;
    while (this.frameTimestamps.length > 0 && this.frameTimestamps[0]! < cutoff) {
      this.frameTimestamps.shift();
    }
  }

  /** Compute current FPS from the rolling window */
  getFps(): number {
    const timestamps = this.frameTimestamps;
    if (timestamps.length < 2) return 60;
    const windowMs = timestamps[timestamps.length - 1]! - timestamps[0]!;
    if (windowMs <= 0) return 60;
    return Math.round((timestamps.length / windowMs) * 1000);
  }

  // ─── Mode Override ────────────────────────────────────────────

  /** Allow the user or UI to switch modes explicitly */
  setMode(mode: RenderMode): void {
    if (this.disposed) return;
    this.currentConfig = {
      ...this.currentConfig,
      mode,
      degraded: false,
      lastDegradedAt: null,
    };
    this.degradedEmitted = false;
    this.bus.emit("visualization:mode-changed", { mode });
  }

  // ─── Degradation ──────────────────────────────────────────────

  /**
   * Force degradation to 2D fallback.
   * Called when FPS stays below threshold for N consecutive samples.
   */
  private degrade(): void {
    this.currentConfig = {
      ...this.currentConfig,
      mode: "focus-2d",
      degraded: true,
      lastDegradedAt: Date.now(),
    };
    this.degradedEmitted = true;
    this.bus.emit("visualization:degraded", {
      fromMode: "tron-3d",
      toMode: "focus-2d",
      fps: this.getFps(),
    });
  }

  private checkDegradation(): void {
    if (this.currentConfig.mode !== "tron-3d") return;
    if (this.degradedEmitted) return;

    const fps = this.getFps();
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > this.config.lowFpsSampleCount) {
      this.fpsHistory.shift();
    }

    // Degrade only if ALL samples in the window are below threshold
    if (
      this.fpsHistory.length >= this.config.lowFpsSampleCount &&
      this.fpsHistory.every((f) => f < this.config.fpsThreshold)
    ) {
      this.degrade();
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private clearMonitor(): void {
    if (this.monitorTimerId) {
      clearInterval(this.monitorTimerId);
      this.monitorTimerId = null;
    }
  }
}
