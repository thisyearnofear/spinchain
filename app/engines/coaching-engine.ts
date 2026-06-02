/**
 * CoachingEngine — Handles AI coaching logic for the ride experience.
 *
 * Responsibilities:
 * - Tracks interval transitions and emits phase change events
 * - Detects cadence drift and emits rider nudges
 * - Announces story beats based on route progress
 * - Emits countdown warnings before interval ends
 * - All output goes through the EventBus (coaching:message, coaching:sound,
 *   interval:changed). Audio/voice synthesis is handled by AudioEngine.
 *
 * Design rules:
 * - Pure TS class — no React imports.
 * - Does NOT handle audio directly; emits events for AudioEngine.
 * - Interval state is derived from elapsed time + workout plan.
 */

import { EventBus } from "./event-bus";
import {
  getCurrentInterval,
  getIntervalProgress,
  getIntervalRemaining,
  PHASE_DEFAULTS,
} from "@/app/lib/workout-plan";
import type { WorkoutPlan, WorkoutInterval, IntervalPhase } from "@/app/lib/workout-plan";

export interface CoachingConfig {
  agentName: string;
  personality: "zen" | "drill-sergeant" | "data";
  workoutPlan: WorkoutPlan | null;
  aiActive: boolean;
  storyBeats?: Array<{ progress: number; label: string; type: string }>;
}

export class CoachingEngine {
  private config: CoachingConfig = {
    agentName: "Coach",
    personality: "data",
    workoutPlan: null,
    aiActive: false,
    storyBeats: [],
  };

  /** Elapsed seconds (set externally by lifecycle tick) */
  private elapsedSeconds = 0;

  /** Last interval index to detect transitions */
  private lastIntervalIndex = -1;

  /** Last spoken story beat key to avoid repeats */
  private lastSpokenBeatKey: string | null = null;

  /** Cadence drift tracking */
  private cadenceDriftMs = 0;
  private lastCadenceCheckMs = 0;
  private lastDriftNudgeKey: string | null = null;

  /** Current cadence (set externally from telemetry) */
  private currentCadence = 0;

  /** Disposed flag */
  private disposed = false;

  /** Subscriptions */
  private unsubs: Array<() => void> = [];

  constructor(private readonly bus: EventBus) {}

  // ─── Configuration ────────────────────────────────────────────

  updateConfig(config: Partial<CoachingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  start(config?: Partial<CoachingConfig>): void {
    if (config) this.updateConfig(config);
    this.elapsedSeconds = 0;
    this.lastIntervalIndex = -1;
    this.lastSpokenBeatKey = null;
    this.cadenceDriftMs = 0;
    this.lastCadenceCheckMs = 0;
    this.lastDriftNudgeKey = null;
  }

  stop(): void {
    this.disposed = false; // Keep for reuse
  }

  dispose(): void {
    this.disposed = true;
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
  }

  // ─── External Data Updates ────────────────────────────────────

  /** Called on every lifecycle tick with elapsed seconds */
  onTick(elapsed: number, progress: number): void {
    if (this.disposed) return;
    this.elapsedSeconds = elapsed;
    this.checkIntervals(progress);
    this.checkStoryBeats(progress);
  }

  /** Called when telemetry commits with new cadence */
  onTelemetry(cadence: number, intervalIndex: number, intervalPhase: string): void {
    if (this.disposed) return;
    this.currentCadence = cadence;
    this.checkCadenceDrift(cadence, intervalIndex, intervalPhase);
  }

  // ─── Interval Tracking ────────────────────────────────────────

  private checkIntervals(progress: number): void {
    const plan = this.config.workoutPlan;
    if (!plan || plan.intervals.length === 0) return;

    const currentIndex = getCurrentInterval(plan.intervals, this.elapsedSeconds);
    if (currentIndex === this.lastIntervalIndex) {
      // Same interval — check countdown
      this.checkCountdown(plan.intervals[currentIndex]);
      return;
    }

    // Interval transition
    this.lastIntervalIndex = currentIndex;
    const interval = plan.intervals[currentIndex];
    if (!interval) return;

    // Emit interval:changed event
    this.bus.emit("interval:changed", {
      index: currentIndex,
      phase: interval.phase,
      interval: { ...interval },
    });

    // Emit coaching sound
    const soundMap: Record<string, string> = {
      sprint: "intervalStart",
      recovery: "recover",
      cooldown: "recover",
      interval: "resistanceUp",
    };
    const sound = soundMap[interval.phase] || null;
    if (sound) {
      this.bus.emit("coaching:sound", { type: sound });
    }

    // Emit coaching message if interval has a coach cue
    if (interval.coachCue) {
      const emotion = PHASE_DEFAULTS[interval.phase]?.coachEmotion || "focused";
      this.bus.emit("coaching:message", {
        text: interval.coachCue,
        source: `interval:${emotion}`,
      });
    }
  }

  private checkCountdown(_interval: WorkoutInterval): void {
    if (!this.config.workoutPlan) return;
    const remaining = getIntervalRemaining(
      this.config.workoutPlan.intervals,
      this.elapsedSeconds,
    );
    // Emit countdown sound when 5s remains (gated on 5-6s boundary)
    if (remaining <= 5 && remaining > 4) {
      this.bus.emit("coaching:sound", { type: "countdown" });
    }
  }

  // ─── Story Beats ──────────────────────────────────────────────

  private checkStoryBeats(progress: number): void {
    const beats = this.config.storyBeats;
    if (!beats || beats.length === 0) return;

    // Find the first beat that matches current progress
    const currentBeat = beats.find(
      (beat) =>
        progress >= beat.progress && progress < beat.progress + 0.03,
    );

    if (!currentBeat) return;

    const beatKey = `${currentBeat.progress}-${currentBeat.label}`;
    if (this.lastSpokenBeatKey === beatKey) return;
    this.lastSpokenBeatKey = beatKey;

    // Emit sound for story beat type
    const soundMap: Record<string, string> = {
      sprint: "sprint",
      climb: "climb",
      rest: "recover",
    };
    const sound = soundMap[currentBeat.type] || null;
    if (sound) {
      this.bus.emit("coaching:sound", { type: sound });
    }

    // Emit coaching message
    const emotion =
      currentBeat.type === "sprint"
        ? "intense"
        : currentBeat.type === "climb"
          ? "focused"
          : "calm";
    this.bus.emit("coaching:message", {
      text: currentBeat.label,
      source: `story:${emotion}`,
    });
  }

  // ─── Cadence Drift Detection ──────────────────────────────────

  private checkCadenceDrift(
    cadence: number,
    intervalIndex: number,
    intervalPhase: string,
  ): void {
    const plan = this.config.workoutPlan;
    if (!plan) return;
    const interval = plan.intervals[intervalIndex];
    if (!interval?.targetRpm) return;

    const [minRpm] = interval.targetRpm;
    const now = Date.now();

    if (this.lastCadenceCheckMs === 0) {
      this.lastCadenceCheckMs = now;
      return;
    }

    const delta = now - this.lastCadenceCheckMs;
    this.lastCadenceCheckMs = now;

    if (cadence < minRpm - 10) {
      this.cadenceDriftMs += delta;
    } else {
      this.cadenceDriftMs = 0;
    }

    const driftKey = `${intervalIndex}-${intervalPhase}`;
    if (this.cadenceDriftMs >= 8000 && this.lastDriftNudgeKey !== driftKey) {
      this.lastDriftNudgeKey = driftKey;
      this.cadenceDriftMs = 0;

      this.bus.emit("coaching:message", {
        text: "Pick up the pace!",
        source: "cadence:intense",
      });
    }
  }

  // ─── Public Accessors ─────────────────────────────────────────

  get currentIntervalIndex(): number {
    return this.lastIntervalIndex;
  }

  get coachingConfig(): Readonly<CoachingConfig> {
    return this.config;
  }
}
