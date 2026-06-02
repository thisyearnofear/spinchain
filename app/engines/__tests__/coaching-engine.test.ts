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

      // Simulate low cadence over time (using fake timers)
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      engine.onTelemetry(85, 1, "sprint");

      // Advance 8 seconds
      vi.advanceTimersByTime(8000);
      vi.setSystemTime(startTime + 8000);
      engine.onTelemetry(85, 1, "sprint");

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Pick up the pace!" }),
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

      // Low cadence for 5s
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      engine.onTelemetry(85, 1, "sprint");

      vi.advanceTimersByTime(5000);
      vi.setSystemTime(startTime + 5000);
      // Returns to target cadence — should reset drift counter
      engine.onTelemetry(110, 1, "sprint");
      expect(handler).not.toHaveBeenCalled();

      // Another 8s of low cadence should trigger the nudge
      vi.advanceTimersByTime(5000);
      vi.setSystemTime(startTime + 10000);
      engine.onTelemetry(85, 1, "sprint");

      vi.advanceTimersByTime(3000);
      vi.setSystemTime(startTime + 13000);
      engine.onTelemetry(85, 1, "sprint");

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
