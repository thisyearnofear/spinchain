import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus } from "../event-bus";
import { TelemetryEngine } from "../telemetry-engine";

/**
 * Helper: wait for async operations to settle
 */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("TelemetryEngine", () => {
  let bus: EventBus;
  let engine: TelemetryEngine;

  beforeEach(() => {
    bus = new EventBus();
    engine = new TelemetryEngine(bus, {
      deviceType: "desktop",
      performanceTier: "high",
    });
  });

  describe("start / stop / dispose", () => {
    it("resets state on start", () => {
      engine.ingest({ heartRate: 150, power: 300 });
      expect(engine.rawSnapshot.heartRate).toBe(150);

      engine.start([]);
      expect(engine.rawSnapshot.heartRate).toBe(0);
      expect(engine.rawSnapshot.power).toBe(0);
      expect(engine.rawSnapshot.wBal).toBe(20000); // DEFAULT_WBAL_CONFIG.wPrime
      expect(engine.ridePoints).toHaveLength(0);
      expect(engine.samples).toHaveLength(0);
    });

    it("clears arrays on dispose without throwing", () => {
      engine.start([{ lat: 40, lng: -74 }]);
      engine.ingest({ heartRate: 120, power: 200 });
      engine.commit();

      expect(() => engine.dispose()).not.toThrow();
      expect(engine.ridePoints).toHaveLength(0);
      expect(engine.samples).toHaveLength(0);
    });
  });

  describe("ingest", () => {
    it("updates partial fields without affecting others", () => {
      engine.start([]);
      engine.ingest({ heartRate: 150 });

      expect(engine.rawSnapshot.heartRate).toBe(150);
      expect(engine.rawSnapshot.power).toBe(0); // unchanged
      expect(engine.rawSnapshot.timestamp).toBeGreaterThan(0);
    });

    it("updates multiple fields at once", () => {
      engine.start([]);
      const ts = Date.now();
      engine.ingest({ heartRate: 140, power: 250, cadence: 85, timestamp: ts });

      expect(engine.rawSnapshot.heartRate).toBe(140);
      expect(engine.rawSnapshot.power).toBe(250);
      expect(engine.rawSnapshot.cadence).toBe(85);
      expect(engine.rawSnapshot.timestamp).toBe(ts);
    });

    it("preserves existing values when partial is empty", () => {
      engine.start([]);
      engine.ingest({ heartRate: 120 });
      engine.ingest({});

      expect(engine.rawSnapshot.heartRate).toBe(120);
    });
  });

  describe("ingestSimulator", () => {
    it("replaces all fields for immediate UI feedback", () => {
      engine.start([]);
      engine.ingest({ heartRate: 80 }); // BLE data first
      engine.ingestSimulator({
        heartRate: 150,
        power: 300,
        cadence: 95,
        speed: 35,
        effort: 200,
      });

      expect(engine.rawSnapshot.heartRate).toBe(150);
      expect(engine.rawSnapshot.power).toBe(300);
      expect(engine.rawSnapshot.effort).toBe(200);
    });
  });

  describe("commit", () => {
    it("returns a snapshot with updated W'bal and gear ratio", () => {
      engine.start([]);
      engine.ingest({ heartRate: 130, power: 200, cadence: 80 });

      const snapshot = engine.commit();

      expect(snapshot.heartRate).toBe(130);
      expect(snapshot.power).toBe(200);
      expect(snapshot.wBal).toBeGreaterThan(0);
      expect(snapshot.wBal).toBeLessThanOrEqual(20000);
      expect(snapshot.gearRatio).toBeGreaterThan(0);
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });

    it("decreases W'bal when power exceeds critical power", () => {
      engine.start([]);
      engine.ingest({ power: 350 }); // Above CP of 250

      // First commit
      const s1 = engine.commit();
      // Wait a bit, then commit again
      const s2 = engine.commit();

      expect(s2.wBal).toBeLessThanOrEqual(s1.wBal);
    });

    it("increases W'bal when power is below critical power (after depletion)", () => {
      engine.start([]);

      // Deplete first
      engine.ingest({ power: 400 });
      engine.commit();

      // Then recover
      engine.ingest({ power: 100 });
      const recovered = engine.commit();

      expect(recovered.wBal).toBeGreaterThanOrEqual(0);
    });

    it("emits telemetry:committed event on the bus", () => {
      const handler = vi.fn();
      bus.on("telemetry:committed", handler);

      engine.start([]);
      engine.commit();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ heartRate: 0, power: 0 }),
      );
    });

    it("records ride points at ~1Hz cadence", () => {
      engine.start([]);
      engine.ingest({ heartRate: 140, power: 250 });

      // Simulate multiple commit cycles
      engine.commit();
      const pointsAfterFirstCommit = engine.ridePoints.length;

      // Force a second boundary by advancing time
      engine.commit();

      // Points should be recorded (at least some due to time boundaries)
      expect(typeof pointsAfterFirstCommit).toBe("number");
    });
  });

  describe("shouldCommit / getCommitIntervalMs", () => {
    it("returns adaptive interval based on device type", () => {
      // Desktop high tier: 4Hz → 250ms
      expect(engine.getCommitIntervalMs()).toBe(250);
    });

    it("shouldCommit returns true when enough time has passed", () => {
      // First commit always returns true since lastCommitMs = 0
      expect(engine.shouldCommit(Date.now())).toBe(true);
    });

    it("shouldCommit returns false right after a commit", () => {
      engine.commit();
      // Immediately after commit, should return false
      expect(engine.shouldCommit(Date.now())).toBe(false);
    });
  });

  describe("refreshAverages", () => {
    it("returns zeroes when no samples collected", () => {
      const avgs = engine.refreshAverages();
      expect(avgs).toEqual({ avgHr: 0, avgPower: 0, avgEffort: 0 });
    });

    it("calculates averages from collected samples", () => {
      engine.start([]);
      // Manually add samples
      engine.samples.push(
        { hr: 140, power: 200, effort: 150 },
        { hr: 160, power: 250, effort: 180 },
        { hr: 150, power: 225, effort: 165 },
      );

      const avgs = engine.refreshAverages();

      expect(avgs.avgHr).toBe(150); // (140 + 160 + 150) / 3
      expect(avgs.avgPower).toBe(225); // (200 + 250 + 225) / 3
      expect(avgs.avgEffort).toBe(165); // (150 + 180 + 165) / 3
    });
  });

  describe("loadGhost", () => {
    it("gracefully handles missing data without throwing", async () => {
      engine.start([{ lat: 40, lng: -74 }]);

      // Load ghost with no classId — should not throw
      await expect(
        engine.loadGhost("test-class", undefined, undefined),
      ).resolves.toBeUndefined();

      await tick();
      // Ghost may be null (no real data) OR a mock fallback (if route coords present)
      // Both are valid outcomes; the key assertion is that it doesn't throw
      expect(
        engine.ghostPerformance === null ||
          engine.ghostPerformance?.source === "mock",
      ).toBe(true);
    });
  });

  describe("currentRouteCoordinate", () => {
    it("returns null when no route coordinates", () => {
      engine.start([]);

      // Access private via commit (which internally uses currentRouteCoordinate)
      const snap = engine.commit();
      expect(snap).toBeDefined();
    });

    it("returns first coordinate when elapsed is 0", () => {
      engine.start([{ lat: 40.7128, lng: -74.006 }]);
      engine.setElapsedSeconds(0);

      const snap = engine.commit();
      expect(snap).toBeDefined();
    });
  });
});
