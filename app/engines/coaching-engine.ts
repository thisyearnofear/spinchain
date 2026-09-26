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
  getIntervalRemaining,
  PHASE_DEFAULTS,
} from "@/app/lib/workout-plan";
import type { WorkoutPlan, WorkoutInterval } from "@/app/lib/workout-plan";
import type { CoachMemory } from "@/app/lib/walrus/coach-memory";

export interface CoachingConfig {
  agentName: string;
  personality: "zen" | "drill-sergeant" | "data";
  workoutPlan: WorkoutPlan | null;
  aiActive: boolean;
  storyBeats?: Array<{ progress: number; label: string; type: string }>;
  /** Cross-session memory (Walrus coach blob), loaded by the coordinator. */
  memory?: CoachMemory | null;
}

/** Live rider metrics handed to the engine on each telemetry commit. */
export interface CoachingMetrics {
  cadence: number;
  power: number;
  heartRate: number;
  /** Skiba W'bal as a percentage (0-100%) of remaining anaerobic capacity. */
  wBalPercentage: number;
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

  /** Power pacing tracking (sustained off-target detection) */
  private powerLowMs = 0;
  private powerHighMs = 0;
  private onTargetMs = 0;
  private lastMetricsCheckMs = 0;
  private lastPacingLowKey: string | null = null;
  private lastPacingHighKey: string | null = null;
  private lastEncourageKey: string | null = null;

  /** Adaptive difficulty suggestions (W'bal-guided) */
  private lastEaseOffKey: string | null = null;
  private pushMoreSuggested = false;

  /** Minimum gap between engine-generated cues so the coach never nag-stacks */
  private lastCueAtMs = 0;
  private static readonly CUE_GAP_MS = 20_000;

  /** Memory greeting (fires once per ride, a few seconds in) */
  private greetingEmitted = false;
  /**
   * Elapsed value at this engine's first tick. The shared ride clock can
   * hold a previous ride's final time (persisted for pause/resume), so the
   * greeting window is measured relative to this engine's first tick, not
   * the absolute class clock.
   */
  private tickBaseElapsed: number | null = null;

  /** Active style anchor (set via style override event) */
  private activeStyleAnchor: { anchorId: string; name: string; type: string } | null = null;

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
    this.powerLowMs = 0;
    this.powerHighMs = 0;
    this.onTargetMs = 0;
    this.lastMetricsCheckMs = 0;
    this.lastPacingLowKey = null;
    this.lastPacingHighKey = null;
    this.lastEncourageKey = null;
    this.lastEaseOffKey = null;
    this.pushMoreSuggested = false;
    this.lastCueAtMs = 0;
    this.greetingEmitted = false;
    this.tickBaseElapsed = null;

    // Subscribe to style override events
    this.unsubs.push(
      this.bus.on("coaching:style-override", (data) => {
        this.activeStyleAnchor = { anchorId: data.anchorId, name: data.name, type: data.type };
        console.log(`[CoachingEngine] Style override applied:`, data.name);

        // Emit a coaching message about the style change
        this.bus.emit("coaching:message", {
          text: `Style shift: ${data.name}`,
          source: "style-override",
        });
      }),
    );
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
    if (this.tickBaseElapsed === null) this.tickBaseElapsed = elapsed;
    this.checkIntervals(progress);
    this.checkStoryBeats(progress);
    this.checkMemoryGreeting();
  }

  /** Called when telemetry commits with new rider metrics */
  onTelemetry(metrics: CoachingMetrics, intervalIndex: number, intervalPhase: string): void {
    if (this.disposed) return;
    this.currentCadence = metrics.cadence;
    this.checkCadenceDrift(metrics.cadence, intervalIndex, intervalPhase);
    this.checkEffortCues(metrics, intervalIndex, intervalPhase);
  }

  // ─── Interval Tracking ────────────────────────────────────────

  private checkIntervals(_progress: number): void {
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
    // Fresh interval, fresh slate: off-target time under the previous
    // band must not carry into this one
    this.powerLowMs = 0;
    this.powerHighMs = 0;
    this.onTargetMs = 0;
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
      warmup: "start",
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

    // Clamp so a paused ride can't dump its wall-clock gap into the drift counter
    const delta = Math.min(now - this.lastCadenceCheckMs, 2_000);
    this.lastCadenceCheckMs = now;

    if (cadence < minRpm - 10) {
      this.cadenceDriftMs += delta;
    } else {
      this.cadenceDriftMs = 0;
    }

    const driftKey = `${intervalIndex}-${intervalPhase}`;
    if (this.cadenceDriftMs >= 8000 && this.lastDriftNudgeKey !== driftKey && !this.cueThrottled(now)) {
      this.lastDriftNudgeKey = driftKey;
      this.cadenceDriftMs = 0;

      const nudge = this.config.personality === "drill-sergeant"
        ? "Pick up the pace! No excuses!"
        : this.config.personality === "zen"
          ? "Gently bring your cadence up — find your rhythm"
          : this.config.personality === "data"
            ? `Cadence at ${cadence} RPM — target is ${minRpm}. Let's close that gap.`
            : "Pick up the pace!";

      this.emitCue(nudge, "cadence:intense", now);
    }
  }

  // ─── Effort-Reactive Cues ─────────────────────────────────────
  //
  // v1 presence scope (IMPLEMENTATION-PLAN Phase 2): pacing cues,
  // encouragement, adaptive difficulty suggestions. All output goes
  // through coaching:message; suggestions are rider-language only and
  // never change resistance automatically.

  /** Personality-flavored line picker. */
  private say(lines: { zen: string; "drill-sergeant": string; data: string }): string {
    return lines[this.config.personality] ?? lines.data;
  }

  /** True when another engine cue fired too recently (nag-stacking guard). */
  private cueThrottled(now: number): boolean {
    return now - this.lastCueAtMs < CoachingEngine.CUE_GAP_MS;
  }

  private emitCue(text: string, source: string, now: number): void {
    this.lastCueAtMs = now;
    this.bus.emit("coaching:message", { text, source });
  }

  private checkEffortCues(
    metrics: CoachingMetrics,
    intervalIndex: number,
    intervalPhase: string,
  ): void {
    const plan = this.config.workoutPlan;
    if (!plan) return;
    const interval = plan.intervals[intervalIndex];

    const now = Date.now();
    if (this.lastMetricsCheckMs === 0) {
      this.lastMetricsCheckMs = now;
      return;
    }
    // Clamp so a paused ride can't dump its wall-clock gap into the sustained counters
    const delta = Math.min(now - this.lastMetricsCheckMs, 2_000);
    this.lastMetricsCheckMs = now;

    const isWorkPhase = intervalPhase === "interval" || intervalPhase === "sprint";
    const band = interval?.targetPower;

    // ── Pacing + encouragement: needs a target power band ──
    if (band && metrics.power > 0) {
      const [min, max] = band;
      const lowFloor = min * 0.85;
      const highCeil = max * 1.15;

      if (metrics.power < lowFloor) {
        this.powerLowMs += delta;
      } else {
        this.powerLowMs = 0;
      }
      if (metrics.power > highCeil) {
        this.powerHighMs += delta;
      } else {
        this.powerHighMs = 0;
      }
      if (metrics.power >= min * 0.95 && metrics.power <= max * 1.05) {
        this.onTargetMs += delta;
      } else {
        this.onTargetMs = 0;
      }

      const key = `${intervalIndex}-${intervalPhase}`;

      // Sustained below target → pacing cue (once per interval)
      if (this.powerLowMs >= 15_000 && this.lastPacingLowKey !== key && !this.cueThrottled(now)) {
        this.lastPacingLowKey = key;
        this.powerLowMs = 0;
        this.emitCue(
          this.say({
            zen: "Ease back into the effort — find the rhythm you can hold",
            "drill-sergeant": "Power's dropping! Get back on your number!",
            data: `Holding ${Math.round(metrics.power)}W against a ${min}–${max}W target — bring it up gradually.`,
          }),
          "pacing:focused",
          now,
        );
        return;
      }

      // Sustained above target → pacing cue (once per interval)
      if (this.powerHighMs >= 15_000 && this.lastPacingHighKey !== key && !this.cueThrottled(now)) {
        this.lastPacingHighKey = key;
        this.powerHighMs = 0;
        this.emitCue(
          this.say({
            zen: "You're ahead of the effort — soften slightly and stay smooth",
            "drill-sergeant": "Too hot! Hold the number, don't burn your matches!",
            data: `${Math.round(metrics.power)}W is above the ${min}–${max}W band — ease off a touch to last the interval.`,
          }),
          "pacing:calm",
          now,
        );
        return;
      }

      // Holding the band during a work phase → encouragement (once per interval)
      if (isWorkPhase && this.onTargetMs >= 45_000 && this.lastEncourageKey !== key && !this.cueThrottled(now)) {
        this.lastEncourageKey = key;
        this.emitCue(
          this.say({
            zen: "Beautiful — right in the flow of the effort",
            "drill-sergeant": "THAT's the number! Hold it right there!",
            data: `Locked in: ${Math.round(metrics.power)}W inside the target band. Keep this.`,
          }),
          "encourage:celebratory",
          now,
        );
        return;
      }

      // Consistently overpowering with plenty of W' left → push-more suggestion (once per ride)
      if (
        isWorkPhase &&
        !this.pushMoreSuggested &&
        metrics.power > max * 1.2 &&
        metrics.wBalPercentage > 60 &&
        this.powerHighMs >= 15_000 &&
        !this.cueThrottled(now)
      ) {
        this.pushMoreSuggested = true;
        this.emitCue(
          this.say({
            zen: "Your body has more today — if it feels right, let the effort rise",
            "drill-sergeant": "You've got a full tank — next interval, I want MORE!",
            data: "You're clearing the target with plenty in reserve — consider riding the next one harder.",
          }),
          "difficulty:push",
          now,
        );
        return;
      }
    }

    // ── Adaptive difficulty: protect the anaerobic tank ──
    if (isWorkPhase && metrics.wBalPercentage > 0 && metrics.wBalPercentage < 20) {
      const key = `${intervalIndex}-${intervalPhase}`;
      if (this.lastEaseOffKey !== key && !this.cueThrottled(now)) {
        this.lastEaseOffKey = key;
        this.emitCue(
          this.say({
            zen: "Your reserves are low — back off gently and breathe",
            "drill-sergeant": "Tank's almost empty! Ease up — live to fight the next one!",
            data: "Anaerobic reserve under 20% — soften the effort now so you can finish strong.",
          }),
          "difficulty:ease",
          now,
        );
      }
    }
  }

  // ─── Memory Greeting ──────────────────────────────────────────

  /**
   * One factual welcome-back line a few seconds into the ride, only when
   * cross-session memory exists. Never faked: no memory, no greeting.
   */
  private checkMemoryGreeting(): void {
    if (this.greetingEmitted) return;
    const memory = this.config.memory;
    if (!memory || memory.rides === 0) return;
    // The shared ride clock can hold a previous ride's final time (persisted
    // for pause/resume), so the greeting window is measured relative to this
    // engine's first tick, not the absolute class clock.
    const rideElapsed = this.elapsedSeconds - (this.tickBaseElapsed ?? 0);
    // Greet early, but not over the spoken start greeting; skip if the
    // memory arrived late (past 5 class-minutes in, a greeting reads oddly).
    // The window is class-time, so compressed practice rides get ~7s wall.
    if (rideElapsed < 8 || rideElapsed > 300) return;

    this.greetingEmitted = true;
    console.log(`[CoachingEngine] Memory greeting emitted (ride #${memory.rides + 1})`);
    const rideNo = memory.rides + 1;
    const last = memory.lastRide;
    const lastBit = last && last.avgPower > 0
      ? `last ride you averaged ${Math.round(last.avgPower)} watts`
      : null;

    const text = this.say({
      zen: lastBit
        ? `Welcome back — ride ${rideNo}. ${lastBit}. Today, just ride with attention.`
        : `Welcome back — ride ${rideNo}. Settle in and breathe.`,
      "drill-sergeant": lastBit
        ? `Ride ${rideNo}! Last time: ${Math.round(last?.avgPower ?? 0)} watts average. Beat it!`
        : `Ride ${rideNo}! You know the drill — let's work!`,
      data: lastBit
        ? `Ride ${rideNo} on record — ${lastBit}. Let's see what today holds.`
        : `Ride ${rideNo} on record. Let's build from here.`,
    });

    this.bus.emit("coaching:message", { text, source: "memory:calm" });
  }

  // ─── Public Accessors ─────────────────────────────────────────

  get currentIntervalIndex(): number {
    return this.lastIntervalIndex;
  }

  get coachingConfig(): Readonly<CoachingConfig> {
    return this.config;
  }

  get styleAnchor(): { anchorId: string; name: string; type: string } | null {
    return this.activeStyleAnchor;
  }
}
