import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus } from "../event-bus";
import { CoachingEngine } from "../coaching-engine";

function createPlan() {
  return {
    id: "test-plan",
    name: "Test",
    intervals: [
      { phase: "warmup" as const, durationSeconds: 60, targetRpm: [70, 80] as [number, number], coachCue: "Warm up" },
      { phase: "sprint" as const, durationSeconds: 30, targetRpm: [100, 120] as [number, number], coachCue: "ALL OUT!" },
      { phase: "recovery" as const, durationSeconds: 60, targetRpm: [65, 75] as [number, number], coachCue: "Recover" },
      { phase: "cooldown" as const, durationSeconds: 30, targetRpm: [60, 70] as [number, number], coachCue: "Cool down" },
    ],
    totalDuration: 180,
    difficulty: "moderate" as const,
    tags: ["test"],
    description: "Test workout",
  };
}

describe("CoachingEngine", () => {
  let bus: EventBus;
  let engine: CoachingEngine;

  beforeEach(() => {
    bus = new EventBus();
    engine = new CoachingEngine(bus);
  });

  describe("start / stop / dispose", () => {
    it("starts with default config", () => {
      expect(() => engine.start()).not.toThrow();
    });

    it("starts with custom config", () => {
      engine.start({ agentName: "Atlas", workoutPlan: createPlan() });
      expect(engine.coachingConfig.agentName).toBe("Atlas");
    });

    it("dispose cleans up without throwing", () => {
      engine.start();
      expect(() => engine.dispose()).not.toThrow();
    });
  });

  describe("interval transitions", () => {
    it("emits interval:changed when transitioning between intervals", () => {
      const handler = vi.fn();
      bus.on("interval:changed", handler);

      engine.start({ workoutPlan: createPlan() });

      // Tick at t=0 (warmup, index 0)
      engine.onTick(0, 0);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ index: 0, phase: "warmup" }),
      );

      // Tick at t=60 (sprint, index 1)
      engine.onTick(60, 0.33);
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ index: 1, phase: "sprint" }),
      );

      // Tick at t=90 (recovery, index 2)
      engine.onTick(90, 0.5);
      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ index: 2, phase: "recovery" }),
      );
    });

    it("emits coaching:sound on sprint interval start", () => {
      const handler = vi.fn();
      bus.on("coaching:sound", handler);

      engine.start({ workoutPlan: createPlan() });

      // Tick to sprint interval (index 1)
      engine.onTick(60, 0.33);

      expect(handler).toHaveBeenCalledWith({ type: "intervalStart" });
    });

    it("emits coaching:message with coach cue on interval transition", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      engine.start({ workoutPlan: createPlan() });

      // Tick to sprint interval (index 1)
      engine.onTick(60, 0.33);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ text: "ALL OUT!" }),
      );
    });

    it("does not emit duplicate events for the same interval", () => {
      const handler = vi.fn();
      bus.on("interval:changed", handler);

      engine.start({ workoutPlan: createPlan() });

      engine.onTick(0, 0);
      engine.onTick(1, 0.01); // Same interval

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("cadence drift detection", () => {
    it("emits coaching:message when cadence is below target for 8s", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      vi.useFakeTimers();
      engine.start({ workoutPlan: createPlan() });

      // Tick to sprint interval (index 1, target rpm 100-120)
      engine.onTick(60, 0.33);

      // Simulate low cadence over time (using fake timers).
      // Telemetry commits at 1s spacing — the engine clamps larger gaps.
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      engine.onTelemetry({ cadence: 85, power: 0, heartRate: 0, wBalPercentage: 0 }, 1, "sprint");

      // Advance 8 seconds
      for (let s = 1; s <= 8; s++) {
        vi.setSystemTime(startTime + s * 1000);
        engine.onTelemetry({ cadence: 85, power: 0, heartRate: 0, wBalPercentage: 0 }, 1, "sprint");
      }

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Cadence at 85 RPM — target is 100. Let's close that gap." }),
      );

      vi.useRealTimers();
    });

    it("resets drift counter when cadence returns to target", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      vi.useFakeTimers();
      engine.start({ workoutPlan: createPlan() });
      // Tick to sprint interval -- this emits the interval's coach cue.
      // Clear the handler so we only track cadence drift messages.
      engine.onTick(60, 0.33);
      handler.mockClear();

      // Low cadence for 5s (1s telemetry spacing — the engine clamps larger gaps)
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      engine.onTelemetry({ cadence: 85, power: 0, heartRate: 0, wBalPercentage: 0 }, 1, "sprint");

      for (let s = 1; s <= 5; s++) {
        vi.setSystemTime(startTime + s * 1000);
        engine.onTelemetry({ cadence: 85, power: 0, heartRate: 0, wBalPercentage: 0 }, 1, "sprint");
      }

      // Returns to target cadence — should reset drift counter
      vi.setSystemTime(startTime + 6000);
      engine.onTelemetry({ cadence: 110, power: 0, heartRate: 0, wBalPercentage: 0 }, 1, "sprint");
      expect(handler).not.toHaveBeenCalled();

      // Another 8s of low cadence should trigger the nudge
      for (let s = 7; s <= 14; s++) {
        vi.setSystemTime(startTime + s * 1000);
        engine.onTelemetry({ cadence: 85, power: 0, heartRate: 0, wBalPercentage: 0 }, 1, "sprint");
      }

      expect(handler).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("story beats", () => {
    it("emits coaching:message when progress matches a story beat", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      engine.start({
        storyBeats: [
          { progress: 0.1, label: "Climb ahead!", type: "climb" },
          { progress: 0.5, label: "Halfway there!", type: "rest" },
        ],
      });

      engine.onTick(18, 0.1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Climb ahead!" }),
      );
    });

    it("does not emit the same story beat twice", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      engine.start({
        storyBeats: [
          { progress: 0.1, label: "Climb ahead!", type: "climb" },
        ],
      });

      engine.onTick(18, 0.1);
      engine.onTick(19, 0.11); // Same beat

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("effort-reactive cues", () => {
    function createPowerPlan() {
      return {
        id: "power-plan",
        name: "Power Test",
        intervals: [
          { phase: "warmup" as const, durationSeconds: 60, targetRpm: [70, 80] as [number, number], coachCue: "Warm up" },
          { phase: "interval" as const, durationSeconds: 300, targetRpm: [90, 100] as [number, number], targetPower: [200, 250] as [number, number], coachCue: "Hold the number" },
          { phase: "recovery" as const, durationSeconds: 60, targetRpm: [65, 75] as [number, number], coachCue: "Recover" },
        ],
        totalDuration: 420,
        difficulty: "moderate" as const,
        tags: ["test"],
        description: "Power test workout",
      };
    }

    const at = (power: number, wBalPercentage = 100) =>
      ({ cadence: 95, power, heartRate: 150, wBalPercentage });

    it("emits a pacing cue after 15s sustained below the power band", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      vi.useFakeTimers();
      engine.start({ workoutPlan: createPowerPlan() });
      engine.onTick(60, 0.15); // interval index 1, emits coach cue
      handler.mockClear();

      const t0 = Date.now();
      engine.onTelemetry(at(100), 1, "interval");
      // Telemetry commits at 1s spacing — the engine clamps larger gaps
      for (let s = 1; s <= 15; s++) {
        vi.setSystemTime(t0 + s * 1000);
        engine.onTelemetry(at(100), 1, "interval");
      }

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ source: "pacing:focused" }),
      );
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Holding 100W against a 200–250W target — bring it up gradually." }),
      );
      vi.useRealTimers();
    });

    it("emits a pacing cue after 15s sustained above the power band", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      vi.useFakeTimers();
      engine.start({ workoutPlan: createPowerPlan() });
      engine.onTick(60, 0.15);
      handler.mockClear();

      const t0 = Date.now();
      engine.onTelemetry(at(300), 1, "interval");
      for (let s = 1; s <= 15; s++) {
        vi.setSystemTime(t0 + s * 1000);
        engine.onTelemetry(at(300), 1, "interval");
      }

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ source: "pacing:calm" }),
      );
      vi.useRealTimers();
    });

    it("does not repeat a pacing cue within the same interval", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      vi.useFakeTimers();
      engine.start({ workoutPlan: createPowerPlan() });
      engine.onTick(60, 0.15);
      handler.mockClear();

      const t0 = Date.now();
      engine.onTelemetry(at(100), 1, "interval");
      // 55s below target at 1s spacing — the cue fires at 15s and, even
      // past the 20s cue gap, must not repeat within the same interval
      for (let s = 1; s <= 55; s++) {
        vi.setSystemTime(t0 + s * 1000);
        engine.onTelemetry(at(100), 1, "interval");
      }

      expect(handler).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("encourages after 45s holding the band during a work phase", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      vi.useFakeTimers();
      engine.start({ workoutPlan: createPowerPlan() });
      engine.onTick(60, 0.15);
      handler.mockClear();

      const t0 = Date.now();
      engine.onTelemetry(at(225), 1, "interval");
      for (let s = 1; s <= 45; s++) {
        vi.setSystemTime(t0 + s * 1000);
        engine.onTelemetry(at(225), 1, "interval");
      }

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ source: "encourage:celebratory" }),
      );
      vi.useRealTimers();
    });

    it("suggests easing off when anaerobic reserve runs low in a work phase", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      vi.useFakeTimers();
      engine.start({ workoutPlan: createPowerPlan() });
      engine.onTick(60, 0.15);
      handler.mockClear();

      const t0 = Date.now();
      engine.onTelemetry(at(225), 1, "interval");
      vi.setSystemTime(t0 + 1_000);
      engine.onTelemetry(at(225, 10), 1, "interval");

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "difficulty:ease",
          text: "Anaerobic reserve under 20% — soften the effort now so you can finish strong.",
        }),
      );
      vi.useRealTimers();
    });

    it("stays quiet during recovery phases", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      vi.useFakeTimers();
      engine.start({ workoutPlan: createPowerPlan() });
      engine.onTick(360, 0.9); // recovery index 2, emits coach cue
      handler.mockClear();

      const t0 = Date.now();
      engine.onTelemetry(at(50, 10), 2, "recovery");
      vi.setSystemTime(t0 + 60_000);
      engine.onTelemetry(at(50, 10), 2, "recovery");

      expect(handler).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("does not dump a paused ride's wall-clock gap into the sustained counters", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      vi.useFakeTimers();
      engine.start({ workoutPlan: createPowerPlan() });
      engine.onTick(60, 0.15);
      handler.mockClear();

      const t0 = Date.now();
      engine.onTelemetry(at(100), 1, "interval");
      // A few below-floor commits at normal 1s telemetry spacing
      for (let s = 1; s <= 3; s++) {
        vi.setSystemTime(t0 + s * 1000);
        engine.onTelemetry(at(100), 1, "interval");
      }
      // Ride paused: no telemetry for 60s of wall clock. The clamp must
      // keep this gap from tripping the 15s pacing cue on resume.
      vi.setSystemTime(t0 + 63_000);
      engine.onTelemetry(at(100), 1, "interval");

      expect(handler).not.toHaveBeenCalledWith(
        expect.objectContaining({ source: "pacing:focused" }),
      );
      vi.useRealTimers();
    });

    it("resets sustained off-target counters on interval transition", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      const twoBandPlan = {
        ...createPowerPlan(),
        intervals: [
          { phase: "interval" as const, durationSeconds: 60, targetRpm: [90, 100] as [number, number], targetPower: [200, 250] as [number, number], coachCue: "First" },
          { phase: "interval" as const, durationSeconds: 300, targetRpm: [90, 100] as [number, number], targetPower: [200, 250] as [number, number], coachCue: "Second" },
        ],
        totalDuration: 360,
      };

      vi.useFakeTimers();
      engine.start({ workoutPlan: twoBandPlan });
      engine.onTick(0, 0); // interval 0, emits coach cue
      handler.mockClear();

      const t0 = Date.now();
      // ~14s below the floor in interval 0 (1s telemetry spacing)
      engine.onTelemetry(at(100), 0, "interval");
      for (let s = 1; s <= 14; s++) {
        vi.setSystemTime(t0 + s * 1000);
        engine.onTelemetry(at(100), 0, "interval");
      }
      // Transition into interval 1 — the 14s must not carry over
      engine.onTick(60, 0.2);
      handler.mockClear();
      vi.setSystemTime(t0 + 15_000);
      engine.onTelemetry(at(100), 1, "interval");

      expect(handler).not.toHaveBeenCalledWith(
        expect.objectContaining({ source: "pacing:focused" }),
      );
      vi.useRealTimers();
    });

    it("cadence nudge opens the cue gap, suppressing an immediately-eligible effort cue", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      vi.useFakeTimers();
      engine.start({ workoutPlan: createPowerPlan() });
      engine.onTick(60, 0.15);
      handler.mockClear();

      const t0 = Date.now();
      // Cadence 70 is 20 RPM under the floor and power 100W is below the
      // band, so the drift nudge (8s) lands just before the pacing cue (15s).
      engine.onTelemetry({ ...at(100), cadence: 70 }, 1, "interval");
      for (let s = 1; s <= 15; s++) {
        vi.setSystemTime(t0 + s * 1000);
        engine.onTelemetry({ ...at(100), cadence: 70 }, 1, "interval");
      }

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ source: "cadence:intense" }),
      );
      // The pacing cue became eligible inside the nudge's 20s cue gap
      expect(handler).not.toHaveBeenCalledWith(
        expect.objectContaining({ source: "pacing:focused" }),
      );
      vi.useRealTimers();
    });
  });

  describe("memory greeting", () => {
    const memory = {
      version: 1 as const,
      riderId: "0xabc",
      coachId: "Coach:data",
      rides: 3,
      lastRideAt: Date.now() - 86_400_000,
      lastRide: { avgPower: 182, durationSec: 2700, completed: true },
      bestAvgPower: 182,
      notes: [],
    };

    it("greets from cross-session memory a few seconds into the ride", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      engine.start({ workoutPlan: createPlan(), memory });
      engine.onTick(0, 0); // too early — no greeting yet
      engine.onTick(9, 0.02);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "memory:calm",
          text: "Ride 4 on record — last ride you averaged 182 watts. Let's see what today holds.",
        }),
      );
    });

    it("greets only once per ride", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      engine.start({ workoutPlan: createPlan(), memory });
      engine.onTick(9, 0.02);
      engine.onTick(30, 0.1);
      engine.onTick(60, 0.2);

      const greetings = handler.mock.calls.filter(
        ([data]) => (data as { source: string }).source === "memory:calm",
      );
      expect(greetings).toHaveLength(1);
    });

    it("still greets when the ride clock carries over a previous ride's time", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      // Pause/resume persistence can rehydrate elapsedTime with the last
      // ride's final clock value; the greeting window is ride-relative.
      engine.start({ workoutPlan: createPlan(), memory });
      engine.onTick(1800, 1);
      engine.onTick(1840, 1);

      const greetings = handler.mock.calls.filter(
        ([data]) => (data as { source: string }).source === "memory:calm",
      );
      expect(greetings).toHaveLength(1);
    });

    it("never greets without memory (no faked familiarity)", () => {
      const handler = vi.fn();
      bus.on("coaching:message", handler);

      engine.start({ workoutPlan: createPlan() });
      engine.onTick(9, 0.02);

      const greetings = handler.mock.calls.filter(
        ([data]) => (data as { source: string }).source === "memory:calm",
      );
      expect(greetings).toHaveLength(0);
    });
  });

  describe("updateConfig", () => {
    it("updates config partially", () => {
      engine.start();
      engine.updateConfig({ agentName: "New Coach" });
      expect(engine.coachingConfig.agentName).toBe("New Coach");
    });

    it("preserves existing fields when not specified", () => {
      engine.start({ agentName: "Coach A", personality: "zen" });
      engine.updateConfig({ agentName: "Coach B" });
      expect(engine.coachingConfig.agentName).toBe("Coach B");
      expect(engine.coachingConfig.personality).toBe("zen");
    });
  });
});
