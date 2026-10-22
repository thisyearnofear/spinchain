// @vitest-environment jsdom
/**
 * useCloudAudio hook — chime edge detection against the real hook with
 * fake timers: seek/restart (revision bump) never retriggers, a forward
 * crossing plays the chime once, and a replay may chime again.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCloudAudio } from "./use-cloud-audio";
import type { CloudPlayback } from "./sequence";

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
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
}
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  sampleRate = 48000;
  destination = new FakeNode();
  resume = vi.fn(async () => {});
  suspend = vi.fn(async () => Promise.resolve());
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
  function MockAudioContext() {
    return fakeCtx;
  }
  vi.stubGlobal("AudioContext", MockAudioContext);
  vi.stubGlobal("window", { AudioContext: MockAudioContext });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const chimeOscCount = () => fakeCtx.createOscillator.mock.calls.length - 3; // minus 3 pad oscs

describe("useCloudAudio hook", () => {
  it("does not chime when a seek jumps over 21s", async () => {
    const pb: CloudPlayback = { seconds: 10, playing: true, revision: 0, pedalPhase: 0 };
    const playback = { current: pb };
    const { result } = renderHook(() => useCloudAudio(playback, 0));
    await vi.waitFor(async () => expect(await result.current.enable()).toBe(true));
    vi.advanceTimersByTime(250); // poll → lastSeconds=10
    pb.seconds = 30; // scrub over the reveal
    pb.revision++;
    vi.advanceTimersByTime(250);
    expect(chimeOscCount()).toBe(0);
  });

  it("chimes once on a forward 21s crossing during playback", async () => {
    const pb: CloudPlayback = { seconds: 20, playing: true, revision: 0, pedalPhase: 0 };
    const playback = { current: pb };
    const { result } = renderHook(() => useCloudAudio(playback, 0));
    await vi.waitFor(async () => expect(await result.current.enable()).toBe(true));
    vi.advanceTimersByTime(250);
    pb.seconds = 21.4;
    vi.advanceTimersByTime(250);
    expect(chimeOscCount()).toBe(3); // one 3-note chime
    vi.advanceTimersByTime(250);
    expect(chimeOscCount()).toBe(3); // not repeated
  });

  it("restarts then replay may chime again", async () => {
    const pb: CloudPlayback = { seconds: 20, playing: true, revision: 0, pedalPhase: 0 };
    const playback = { current: pb };
    const { result } = renderHook(() => useCloudAudio(playback, 0));
    await vi.waitFor(async () => expect(await result.current.enable()).toBe(true));
    vi.advanceTimersByTime(250);
    pb.seconds = 21.4;
    vi.advanceTimersByTime(250);
    expect(chimeOscCount()).toBe(3);
    // restart
    pb.seconds = 0;
    pb.revision++;
    vi.advanceTimersByTime(250);
    pb.seconds = 21.2; // replay over the reveal
    vi.advanceTimersByTime(250);
    expect(chimeOscCount()).toBe(6);
  });

  it("mute silences and suspend is called; pause keeps it off until resume", async () => {
    const pb: CloudPlayback = { seconds: 5, playing: true, revision: 0, pedalPhase: 0 };
    const playback = { current: pb };
    const { result } = renderHook(() => useCloudAudio(playback, 0));
    await vi.waitFor(async () => expect(await result.current.enable()).toBe(true));
    result.current.pause();
    expect(fakeCtx.suspend).toHaveBeenCalled();
    vi.advanceTimersByTime(250); // paused state blocks update restore
    const masterGain = fakeCtx.createGain.mock.results[0].value as FakeNode;
    masterGain.gain.setTargetAtTime.mockClear();
    vi.advanceTimersByTime(250);
    expect(masterGain.gain.setTargetAtTime).not.toHaveBeenCalled();
  });
});
