/**
 * SuiEngine Unit Tests
 *
 * Covers:
 * - Constructor and initial state
 * - Session lifecycle (startSession, joinSession, closeSession)
 * - Telemetry submission (single, queue, flush, buffer limits)
 * - Reward minting (single, batch)
 * - EventBus integration (auto-submit on telemetry:committed)
 * - Lifecycle (start, stop, dispose)
 * - Config updates
 * - Edge cases (disposed, no executeTransaction, failure re-queue)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventBus } from "../event-bus";
import { SuiEngine } from "../sui-engine";
import type { SuiEngineConfig, SuiSessionState } from "../sui-engine";

// ─── Mock Transaction (vi.hoisted for proper mock factory hoisting) ─

const { mockMoveCall, mockPure, mockObject, mockTransaction } = vi.hoisted(
  () => {
    const mockMoveCall = vi.fn();
    const mockPure = {
      u64: vi.fn((v: number) => ({ value: v, type: "u64" })),
      u32: vi.fn((v: number) => ({ value: v, type: "u32" })),
      u8: vi.fn((v: number) => ({ value: v, type: "u8" })),
      id: vi.fn((v: string) => ({ value: v, type: "id" })),
      string: vi.fn((v: string) => ({ value: v, type: "string" })),
      address: vi.fn((v: string) => ({ value: v, type: "address" })),
      vector: vi.fn((type: string, items: unknown[]) => ({ type, items })),
    };
    const mockObject = vi.fn((id: string) => ({ id, type: "object" }));
    const mockTransaction = vi.fn(function () {
      return {
        moveCall: mockMoveCall,
        pure: mockPure,
        object: mockObject,
        mergeCoins: vi.fn(),
        splitCoins: vi.fn(),
      };
    });
    return { mockMoveCall, mockPure, mockObject, mockTransaction };
  },
);

vi.mock("@mysten/sui/transactions", () => ({
  Transaction: mockTransaction,
}));

// ─── Mock SUI_CONFIG ────────────────────────────────────────────

vi.mock("@/app/config", () => ({
  SUI_CONFIG: {
    packageId: "0xpackageid",
    network: "testnet",
  },
}));

// ─── Helpers ────────────────────────────────────────────────────

const mockExecuteTransaction = vi.fn().mockResolvedValue({ digest: "0xdigest" });

function createEngine(
  overrides: Partial<SuiEngineConfig> = {},
): { bus: EventBus; engine: SuiEngine } {
  const bus = new EventBus();
  const engine = new SuiEngine(bus, {
    executeTransaction: mockExecuteTransaction,
    suiClient: {
      getCoins: vi.fn().mockResolvedValue({ data: [] }),
      getObject: vi.fn().mockResolvedValue({ data: undefined }),
    },
    ...overrides,
  });
  return { bus, engine };
}

function setActiveSession(
  engine: SuiEngine,
  overrides: Partial<SuiSessionState> = {},
): void {
  // Use type assertion to set private session for testing
  const engineAny = engine as unknown as { session: SuiSessionState };
  engineAny.session = {
    sessionId: "0xsession",
    statsObjectId: "0xstats",
    classId: "class-1",
    isActive: true,
    startedAt: Date.now(),
    ...overrides,
  };
}

describe("SuiEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMoveCall.mockClear();
    mockPure.u64.mockClear();
    mockPure.u32.mockClear();
    mockPure.id.mockClear();
    mockPure.string.mockClear();
    mockPure.address.mockClear();
    mockPure.vector.mockClear();
    mockObject.mockClear();
    mockExecuteTransaction.mockClear();
    mockExecuteTransaction.mockResolvedValue({ digest: "0xdigest" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Constructor & Initial State ──────────────────────────────

  describe("constructor & initial state", () => {
    it("should start with no active session", () => {
      const { engine } = createEngine();
      expect(engine.sessionState.sessionId).toBeNull();
      expect(engine.sessionState.statsObjectId).toBeNull();
      expect(engine.sessionState.isActive).toBe(false);
      expect(engine.pendingTelemetryCount).toBe(0);
      expect(engine.submittedTelemetryCount).toBe(0);
    });

    it("should report isConnected when executeTransaction is provided", () => {
      const { engine } = createEngine();
      expect(engine.isConnected).toBe(true);
    });

    it("should report isConnected = false without executeTransaction", () => {
      const bus = new EventBus();
      const engine = new SuiEngine(bus, {});
      expect(engine.isConnected).toBe(false);
    });
  });

  // ─── Session Lifecycle ────────────────────────────────────────

  describe("session lifecycle", () => {
    it("should create a session with startSession", async () => {
      const { engine } = createEngine();
      const sessionId = await engine.startSession("class-1", 3600);

      expect(sessionId).toBeTruthy();
      expect(engine.sessionState.classId).toBe("class-1");
      expect(engine.sessionState.isActive).toBe(true);

      // Verify Move call was constructed correctly
      expect(mockMoveCall).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.stringContaining("create_session"),
        }),
      );
      expect(mockPure.id).toHaveBeenCalledWith("class-1");
      expect(mockPure.u64).toHaveBeenCalledWith(3600);
    });

    it("should join an existing session with joinSession", async () => {
      const { engine } = createEngine();
      const statsId = await engine.joinSession("0xsession");

      expect(statsId).toBeTruthy();
      expect(engine.sessionState.sessionId).toBe("0xsession");
      expect(engine.sessionState.isActive).toBe(true);

      expect(mockMoveCall).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.stringContaining("join_session"),
        }),
      );
      expect(mockObject).toHaveBeenCalledWith("0xsession");
    });

    it("should close a session with closeSession", async () => {
      const { engine } = createEngine();
      await engine.startSession("class-1", 3600);
      expect(engine.sessionState.isActive).toBe(true);

      const result = await engine.closeSession();
      expect(result).toBe(true);
      expect(engine.sessionState.isActive).toBe(false);

      expect(mockMoveCall).toHaveBeenLastCalledWith(
        expect.objectContaining({
          target: expect.stringContaining("close_session"),
        }),
      );
    });

    it("should emit sui:session-started on create", async () => {
      const { bus, engine } = createEngine();
      const handler = vi.fn();
      bus.on("sui:session-started", handler);

      await engine.startSession("class-1", 3600);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: expect.any(String) }),
      );
    });

    it("should emit sui:session-ended on close", async () => {
      const { bus, engine } = createEngine();
      const handler = vi.fn();
      bus.on("sui:session-ended", handler);

      await engine.startSession("class-1", 3600);
      await engine.closeSession();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: expect.any(String) }),
      );
    });

    it("should return null for startSession without executeTransaction", async () => {
      const bus = new EventBus();
      const engine = new SuiEngine(bus, {});
      const result = await engine.startSession("class-1", 3600);
      expect(result).toBeNull();
    });

    it("should return false for closeSession on inactive session", async () => {
      const { engine } = createEngine();
      const result = await engine.closeSession();
      expect(result).toBe(false);
    });
  });

  // ─── Telemetry ────────────────────────────────────────────────

  describe("telemetry", () => {
    it("should submit single telemetry update", async () => {
      const { engine } = createEngine();
      setActiveSession(engine);

      const result = await engine.submitTelemetry(150, 200, 85);
      expect(result).toBe(true);

      expect(mockMoveCall).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.stringContaining("update_telemetry"),
        }),
      );
      expect(mockPure.u32).toHaveBeenCalledWith(150); // hr
      expect(mockPure.u32).toHaveBeenCalledWith(200); // power
      expect(mockPure.u32).toHaveBeenCalledWith(85); // cadence
    });

    it("should queue telemetry points in buffer", () => {
      const { engine } = createEngine();
      setActiveSession(engine);

      engine.queueTelemetry(150, 200, 85);
      engine.queueTelemetry(155, 220, 88);

      expect(engine.pendingTelemetryCount).toBe(2);
    });

    it("should flush buffered telemetry", async () => {
      const { engine } = createEngine();
      setActiveSession(engine);

      engine.queueTelemetry(150, 200, 85);
      engine.queueTelemetry(155, 220, 88);

      const result = await engine.flushTelemetry();
      expect(result).toBe(true);
      expect(engine.pendingTelemetryCount).toBe(0);
      expect(engine.submittedTelemetryCount).toBe(2);

      // Should have called moveCall twice (once per point)
      expect(mockMoveCall).toHaveBeenCalledTimes(2);
    });

    it("should auto-flush when buffer reaches 50 points", () => {
      const { engine } = createEngine();
      setActiveSession(engine);

      // Queue 49 points (no flush)
      for (let i = 0; i < 49; i++) {
        engine.queueTelemetry(150, 200, 85);
      }
      expect(engine.pendingTelemetryCount).toBe(49);

      // 50th should trigger auto-flush
      engine.queueTelemetry(150, 200, 85);
      expect(engine.pendingTelemetryCount).toBe(0);
    });

    it("should submit telemetry via EventBus when started", () => {
      const { bus, engine } = createEngine();
      setActiveSession(engine);

      const spy = vi.spyOn(engine, "queueTelemetry");

      // Start engine (subscribes to telemetry:committed)
      engine.start();

      // Emit a telemetry event with heartRate field
      bus.emit("telemetry:committed", {
        heartRate: 150,
        power: 200,
        cadence: 85,
        timestamp: Date.now(),
      });

      expect(spy).toHaveBeenCalledWith(150, 200, 85);
    });

    it("should not submit telemetry when disposed", async () => {
      const { engine } = createEngine();
      engine.dispose();

      const result = await engine.submitTelemetry(150, 200, 85);
      expect(result).toBe(false);
    });

    it("should not submit telemetry without active session", async () => {
      const { engine } = createEngine();
      const result = await engine.submitTelemetry(150, 200, 85);
      expect(result).toBe(false);
    });

    it("should re-queue telemetry on flush failure", async () => {
      const executeTransaction = vi.fn().mockResolvedValue(null);
      const { engine } = createEngine({ executeTransaction });
      setActiveSession(engine);

      engine.queueTelemetry(150, 200, 85);
      const result = await engine.flushTelemetry();

      expect(result).toBe(false);
      expect(engine.pendingTelemetryCount).toBe(1);
    });
  });

  // ─── Walrus Anchoring ─────────────────────────────────────────

  describe("anchorTelemetryBlob", () => {
    it("should build an anchor_telemetry_blob moveCall with the blob args", async () => {
      const { engine } = createEngine();

      const result = await engine.anchorTelemetryBlob({
        classId: "class-1",
        blobId: "walrus-blob-abc",
        epoch: 90,
        pointCount: 1200,
      });

      expect(result).toEqual({ digest: "0xdigest" });
      expect(mockMoveCall).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.stringContaining("anchor_telemetry_blob"),
        }),
      );
      expect(mockPure.string).toHaveBeenCalledWith("class-1");
      expect(mockPure.string).toHaveBeenCalledWith("walrus-blob-abc");
      expect(mockPure.u64).toHaveBeenCalledWith(90);
      expect(mockPure.u64).toHaveBeenCalledWith(1200);
      expect(mockExecuteTransaction).toHaveBeenCalledTimes(1);
    });

    it("should not require an active session", async () => {
      const { engine } = createEngine();
      expect(engine.sessionState.isActive).toBe(false);

      const result = await engine.anchorTelemetryBlob({
        classId: "class-1",
        blobId: "blob",
        epoch: 90,
        pointCount: 0,
      });

      expect(result).toEqual({ digest: "0xdigest" });
    });

    it("should return null without executeTransaction", async () => {
      const bus = new EventBus();
      const engine = new SuiEngine(bus, {});

      const result = await engine.anchorTelemetryBlob({
        classId: "class-1",
        blobId: "blob",
        epoch: 90,
        pointCount: 0,
      });

      expect(result).toBeNull();
    });

    it("should return null when disposed", async () => {
      const { engine } = createEngine();
      engine.dispose();

      const result = await engine.anchorTelemetryBlob({
        classId: "class-1",
        blobId: "blob",
        epoch: 90,
        pointCount: 0,
      });

      expect(result).toBeNull();
    });
  });

  // ─── Lifecycle ────────────────────────────────────────────────

  describe("lifecycle", () => {
    it("should start and subscribe to EventBus", () => {
      const { bus, engine } = createEngine();
      const spy = vi.spyOn(bus, "on");

      engine.start();

      expect(spy).toHaveBeenCalledWith(
        "telemetry:committed",
        expect.any(Function),
      );
    });

    it("should stop and flush pending telemetry", async () => {
      const { engine } = createEngine();
      setActiveSession(engine);

      engine.queueTelemetry(150, 200, 85);
      expect(engine.pendingTelemetryCount).toBe(1);

      await engine.stop();
      expect(engine.pendingTelemetryCount).toBe(0);
    });

    it("should dispose and clear all state", () => {
      const { engine } = createEngine();
      setActiveSession(engine);
      engine.queueTelemetry(150, 200, 85);

      engine.dispose();

      expect(engine.sessionState.isActive).toBe(false);
      expect(engine.sessionState.sessionId).toBeNull();
      expect(engine.pendingTelemetryCount).toBe(0);
      expect(engine.submittedTelemetryCount).toBe(0);
    });

    it("should be safe to call dispose multiple times", () => {
      const { engine } = createEngine();
      engine.dispose();
      expect(() => engine.dispose()).not.toThrow();
    });

    it("should update config dynamically", () => {
      const { engine } = createEngine();
      const newExecute = vi.fn();

      engine.updateConfig({ executeTransaction: newExecute });

      const engineAny = engine as unknown as { config: SuiEngineConfig };
      expect(engineAny.config.executeTransaction).toBe(newExecute);
    });
  });

  // ─── Flush Timer ──────────────────────────────────────────────

  describe("flush timer", () => {
    it("should auto-flush buffered telemetry every 5 seconds", async () => {
      const { engine } = createEngine();

      // Use startSession to initialize the flush timer, then set statsObjectId
      // so flushTelemetry's precondition passes
      await engine.startSession("class-1", 3600);
      const engineAny = engine as unknown as { session: SuiSessionState };
      engineAny.session.statsObjectId = "0xstats";

      engine.queueTelemetry(150, 200, 85);
      expect(engine.pendingTelemetryCount).toBe(1);
      expect(engine.submittedTelemetryCount).toBe(0);

      // Advance time by 5 seconds — timer should fire and flush
      await vi.advanceTimersByTimeAsync(5000);

      // After flush, buffer should be empty and count updated
      // Note: flushTelemetry's mockExecuteTransaction resolves, so it succeeds
      expect(engine.submittedTelemetryCount).toBe(1);
      expect(engine.pendingTelemetryCount).toBe(0);

      await engine.stop();
    });

    it("should not flush if buffer is empty", async () => {
      const { engine } = createEngine();

      // Use startSession to initialize the flush timer, then set statsObjectId
      await engine.startSession("class-1", 3600);
      const engineAny = engine as unknown as { session: SuiSessionState };
      engineAny.session.statsObjectId = "0xstats";

      const spy = vi.spyOn(engine, "flushTelemetry");

      await vi.advanceTimersByTimeAsync(5000);
      expect(spy).not.toHaveBeenCalled();

      await engine.stop();
    });
  });
});
