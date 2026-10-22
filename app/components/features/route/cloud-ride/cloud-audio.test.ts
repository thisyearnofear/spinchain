/**
 * Cloud audio engine — lifecycle tests with a minimal AudioContext mock.
 * Covers the gesture contract: enable awaits resume() and reports failure;
 * pause/mute silence + suspend; dispose stops everything and closes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCloudAudioEngine } from "./use-cloud-audio";

class FakeParam {
  value = 0;
  setTargetAtTime = vi.fn();
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}
class FakeNode {
  connect = vi.fn((n: unknown) => n);
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  gain = new FakeParam();
  frequency = new FakeParam();
  type = "";
  buffer: unknown = null;
  loop = false;
}
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  sampleRate = 48000;
  destination = new FakeNode();
  resume = vi.fn(async () => {});
  suspend = vi.fn(async () => {});
  close = vi.fn(async () => {
    this.state = "closed";
  });
  createGain = vi.fn(() => new FakeNode());
  createBiquadFilter = vi.fn(() => new FakeNode());
  createOscillator = vi.fn(() => new FakeNode());
  createBufferSource = vi.fn(() => new FakeNode());
  createBuffer = vi.fn(() => ({ getChannelData: () => new Float32Array(96000) }));
}

let fakeCtx: FakeAudioContext;

beforeEach(() => {
  fakeCtx = new FakeAudioContext();
  // A constructor that RETURNS the shared fake — `eng.ctx` is fakeCtx.
  function MockAudioContext() {
    return fakeCtx;
  }
  vi.stubGlobal("AudioContext", MockAudioContext);
  vi.stubGlobal("window", { AudioContext: MockAudioContext });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cloud audio engine", () => {
  it("enables via user gesture — builds and resumes", async () => {
    const eng = createCloudAudioEngine();
    expect(await eng.enable()).toBe(true);
    expect(fakeCtx.resume).toHaveBeenCalled();
    expect(eng.ctx).toBe(fakeCtx);
  });

  it("returns false and reports nothing playable when resume rejects", async () => {
    fakeCtx.resume = vi.fn(async () => {
      throw new Error("denied");
    });
    const eng = createCloudAudioEngine();
    expect(await eng.enable()).toBe(false);
  });

  it("pause zeroes master and suspends", async () => {
    const eng = createCloudAudioEngine();
    await eng.enable();
    eng.update(true, 0.5);
    eng.pause();
    // silenceNow must have written master gain to 0 immediately.
    const masterGain = fakeCtx.createGain.mock.results[0].value as FakeNode;
    expect(masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0, fakeCtx.currentTime);
    expect(fakeCtx.suspend).toHaveBeenCalled();
  });

  it("mute disables the engine — update adds no gain scheduling", async () => {
    const eng = createCloudAudioEngine();
    await eng.enable();
    const masterGain = fakeCtx.createGain.mock.results[0].value as FakeNode;
    eng.mute();
    expect(fakeCtx.suspend).toHaveBeenCalled();
    masterGain.gain.setTargetAtTime.mockClear();
    eng.update(true, 1); // disabled → no gain scheduling at all
    expect(masterGain.gain.setTargetAtTime).not.toHaveBeenCalled();
  });

  it("chime creates three oscillators only when enabled", async () => {
    const eng = createCloudAudioEngine();
    eng.chime(); // not enabled yet — no-op
    expect(fakeCtx.createOscillator.mock.calls.length).toBe(0);
    await eng.enable();
    eng.chime();
    expect(fakeCtx.createOscillator.mock.calls.length).toBe(3 + 3); // 3 pads + 3 chime
  });

  it("dispose stops sources and closes the context", async () => {
    const eng = createCloudAudioEngine();
    await eng.enable();
    eng.chime();
    const noise = fakeCtx.createBufferSource.mock.results[0].value as FakeNode;
    eng.dispose();
    expect(noise.stop).toHaveBeenCalled();
    expect(noise.disconnect).toHaveBeenCalled();
    expect(fakeCtx.close).toHaveBeenCalled();
    expect(eng.ctx).toBeNull();
  });
});
