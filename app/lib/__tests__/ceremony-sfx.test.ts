import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("ceremony-sfx", () => {
  const start = vi.fn();
  const stop = vi.fn();
  const connect = vi.fn();
  const setValueAtTime = vi.fn();
  const linearRampToValueAtTime = vi.fn();
  const exponentialRampToValueAtTime = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    start.mockClear();
    stop.mockClear();
    connect.mockClear();

    class FakeOsc {
      type = "sine";
      frequency = { setValueAtTime };
      connect = connect;
      start = start;
      stop = stop;
    }
    class FakeGain {
      gain = {
        setValueAtTime,
        linearRampToValueAtTime,
        exponentialRampToValueAtTime,
      };
      connect = connect;
    }
    class FakeCtx {
      state = "running";
      currentTime = 0;
      destination = {};
      createOscillator = () => new FakeOsc();
      createGain = () => new FakeGain();
      resume = vi.fn(async () => {});
    }

    // @ts-expect-error test stub
    globalThis.window = globalThis;
    // @ts-expect-error test stub
    globalThis.AudioContext = FakeCtx;
    // @ts-expect-error test stub
    window.AudioContext = FakeCtx;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("plays a tick tone for countdown numbers", async () => {
    const { playCountdownTickSfx } = await import("@/app/lib/ceremony-sfx");
    playCountdownTickSfx(3);
    playCountdownTickSfx(1);
    expect(start).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });

  it("plays a multi-tone GO stinger", async () => {
    const { playGoStingerSfx } = await import("@/app/lib/ceremony-sfx");
    playGoStingerSfx();
    // three tones in the stinger
    expect(start.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
