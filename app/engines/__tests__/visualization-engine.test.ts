import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventBus } from "../event-bus";
import { VisualizationEngine } from "../visualization-engine";

describe("VisualizationEngine", () => {
  let bus: EventBus;
  let engine: VisualizationEngine;

  beforeEach(() => {
    bus = new EventBus();
    // Mock the GPU probe to return a consistent high-end result
    vi.mock("@/app/lib/gpu-probe", () => ({
      probeGpu: () => ({
        webgl2: true,
        webgpu: false,
        renderer: "Apple GPU",
        vendor: "apple-gpu" as const,
        maxTextureSize: 16384,
        cores: 10,
        memoryGb: 16,
        recommendedMode: "tron-3d" as const,
        isLowEnd: false,
        canPostProcess: true,
      }),
      getQualitySettings: () => ({
        pixelRatio: 2,
        shadows: true,
        antialiasing: true,
        particleCount: 500,
        meshDetail: "high" as const,
        fps: 60,
        enableBloom: true,
        enableSSAO: true,
      }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor — GPU probe mode selection", () => {
    it("selects tron-3d for a high-end GPU", () => {
      engine = new VisualizationEngine(bus);
      expect(engine.currentConfig.mode).toBe("tron-3d");
      expect(engine.currentConfig.canRender3d).toBe(true);
    });

    it("selects focus-2d when preferredMode is overridden", () => {
      engine = new VisualizationEngine(bus, { preferredMode: "focus-2d" });
      expect(engine.currentConfig.mode).toBe("focus-2d");
    });

    it("sets quality settings from the probe result", () => {
      engine = new VisualizationEngine(bus);
      expect(engine.currentConfig.quality.particleCount).toBe(500);
      expect(engine.currentConfig.quality.shadows).toBe(true);
      expect(engine.currentConfig.quality.enableBloom).toBe(true);
    });

    it("initialises with degraded=false and lastDegradedAt=null", () => {
      engine = new VisualizationEngine(bus);
      expect(engine.currentConfig.degraded).toBe(false);
      expect(engine.currentConfig.lastDegradedAt).toBeNull();
    });

    it("populates gpu capability summary", () => {
      engine = new VisualizationEngine(bus);
      expect(engine.currentConfig.gpu.webgl2).toBe(true);
      expect(engine.currentConfig.gpu.vendor).toBe("apple-gpu");
      expect(engine.currentConfig.gpu.canPostProcess).toBe(true);
    });
  });

  describe("FPS monitoring and degradation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      engine = new VisualizationEngine(bus, {
        preferredMode: "tron-3d",
        monitorIntervalMs: 100,
        fpsThreshold: 25,
        lowFpsSampleCount: 3,
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("starts with tron-3d mode", () => {
      expect(engine.currentConfig.mode).toBe("tron-3d");
    });

    it("computes FPS from frame timestamps", () => {
      // Simulate 60 frames over 1 second
      const start = performance.now();
      for (let i = 0; i < 60; i++) {
        vi.advanceTimersByTime(16);
        engine.onFrame();
      }
      const fps = engine.getFps();
      expect(fps).toBeGreaterThanOrEqual(55);
      expect(fps).toBeLessThanOrEqual(65);
    });

    it("degrades to focus-2d when FPS stays below threshold", () => {
      // Feed frames at low FPS
      for (let i = 0; i < 30; i++) {
        engine.onFrame();
        vi.advanceTimersByTime(100); // ~10 fps
      }

      // Start monitoring
      engine.start();

      // Run the degradation check interval a few times
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(100);
      }

      // Should have degraded
      expect(engine.currentConfig.mode).toBe("focus-2d");
      expect(engine.currentConfig.degraded).toBe(true);
      expect(engine.currentConfig.lastDegradedAt).not.toBeNull();
    });

    it("does not degrade if FPS is above threshold", () => {
      // Feed frames at high FPS
      for (let i = 0; i < 120; i++) {
        engine.onFrame();
        vi.advanceTimersByTime(16);
      }

      engine.start();

      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(100);
      }

      expect(engine.currentConfig.mode).toBe("tron-3d");
      expect(engine.currentConfig.degraded).toBe(false);
    });

    it("does not degrade if already in focus-2d mode", () => {
      engine.setMode("focus-2d");
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(100);
        engine.onFrame();
      }

      engine.start();

      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(100);
      }

      expect(engine.currentConfig.mode).toBe("focus-2d");
      expect(engine.currentConfig.degraded).toBe(false);
    });
  });

  describe("setMode", () => {
    beforeEach(() => {
      engine = new VisualizationEngine(bus);
    });

    it("switches to a new render mode", () => {
      engine.setMode("focus-2d");
      expect(engine.currentConfig.mode).toBe("focus-2d");
    });

    it("resets degraded state when switching modes", () => {
      // Force a degrade
      engine.currentConfig = {
        ...engine.currentConfig,
        degraded: true,
        lastDegradedAt: 1000,
      };
      engine.setMode("tron-3d");
      expect(engine.currentConfig.degraded).toBe(false);
      expect(engine.currentConfig.lastDegradedAt).toBeNull();
    });

    it("emits visualization:mode-changed event", () => {
      const handler = vi.fn();
      bus.on("visualization:mode-changed", handler);
      engine.setMode("focus-2d");
      expect(handler).toHaveBeenCalledWith({ mode: "focus-2d" });
    });
  });

  describe("lifecycle", () => {
    beforeEach(() => {
      engine = new VisualizationEngine(bus);
    });

    it("start begins the monitoring interval", () => {
      const spy = vi.spyOn(global, "setInterval");
      engine.start();
      expect(spy).toHaveBeenCalled();
    });

    it("stop clears the monitoring interval", () => {
      engine.start();
      const spy = vi.spyOn(global, "clearInterval");
      engine.stop();
      expect(spy).toHaveBeenCalled();
    });

    it("dispose clears everything", () => {
      engine.start();
      const clearSpy = vi.spyOn(global, "clearInterval");
      const disposeSpy = vi.spyOn(bus, "dispose");
      engine.dispose();
      expect(clearSpy).toHaveBeenCalled();
    });

    it("is no-op after dispose", () => {
      engine.dispose();
      expect(() => {
        engine.start();
        engine.stop();
        engine.setMode("focus-2d");
        engine.onFrame();
      }).not.toThrow();
    });
  });

  describe("onFrame FPS computation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      engine = new VisualizationEngine(bus);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns 60 for a single timestamp", () => {
      engine.onFrame();
      expect(engine.getFps()).toBe(60);
    });

    it("returns higher FPS for more frames in the window", () => {
      // 120 frames over 1 second = 120 fps
      for (let i = 0; i < 120; i++) {
        engine.onFrame();
        vi.advanceTimersByTime(8);
      }
      expect(engine.getFps()).toBeGreaterThan(100);
    });

    it("discards frames older than 2 seconds", () => {
      for (let i = 0; i < 60; i++) {
        engine.onFrame();
        vi.advanceTimersByTime(16);
      }

      // Old frames should have been discarded
      vi.advanceTimersByTime(2500);
      engine.onFrame();

      // Only the last frame + current frame in the window
      expect(engine["frameTimestamps"].length).toBeLessThan(3);
    });
  });
});
