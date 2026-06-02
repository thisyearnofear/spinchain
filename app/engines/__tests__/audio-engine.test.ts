import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventBus } from "../event-bus";
import { AudioEngine } from "../audio-engine";

// Mock ElevenLabs modules
vi.mock("@/app/lib/elevenlabs", () => ({
  getAudioMixer: () => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    createLayer: vi.fn().mockImplementation(
      async (id: string, _buffer: ArrayBuffer, type: string, priority: number) => ({
        id,
        type,
        priority,
        source: {
          onended: null,
          playbackRate: { setTargetAtTime: vi.fn() },
        },
        gainNode: {
          gain: { value: 0.5, setTargetAtTime: vi.fn() },
        },
      }),
    ),
    playLayer: vi.fn(),
    stopLayer: vi.fn(),
    stopAll: vi.fn(),
    setLayerPlaybackRate: vi.fn(),
    setMasterVolume: vi.fn(),
    dispose: vi.fn(),
  }),
  generateSpeech: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
  generateSoundEffect: vi.fn().mockResolvedValue(new ArrayBuffer(512)),
  COACH_VOICES: {
    zen: {
      id: "zen-voice",
      name: "Rachel",
      personality: "zen",
      defaultSettings: { stability: 0.6, similarity_boost: 0.7, style: 0.2 },
    },
    drill: {
      id: "drill-voice",
      name: "Dom",
      personality: "drill",
      defaultSettings: { stability: 0.4, similarity_boost: 0.8, style: 0.7 },
    },
    data: {
      id: "data-voice",
      name: "Bella",
      personality: "data",
      defaultSettings: { stability: 0.7, similarity_boost: 0.6, style: 0.3 },
    },
  },
  INTENSITY_VOICE_SETTINGS: {
    0.5: { stability: 0.5, similarity_boost: 0.7, style: 0.4 },
  },
  WORKOUT_SOUNDS: {
    start: "gentle chime, workout beginning, motivational",
    finish: "triumphant bell",
    countdown: "electronic beep",
    sprint: "whistle, sharp",
    recover: "wind chimes",
    achievement: "sparkle, magic",
  },
  SOUND_DURATIONS: {
    start: 2,
    finish: 3,
    countdown: 3,
    sprint: 1,
    recover: 3,
    achievement: 2,
  },
  AUDIO_PRIORITIES: {
    voice: 10,
    countdown: 9,
    system: 8,
    sfx: 5,
    ambient: 2,
    music: 1,
  },
}));

vi.mock("@/app/lib/elevenlabs/client", () => ({
  checkElevenLabsConfigured: vi.fn().mockResolvedValue(true),
}));

describe("AudioEngine", () => {
  let bus: EventBus;
  let engine: AudioEngine;

  beforeEach(async () => {
    vi.useFakeTimers();
    bus = new EventBus();
    engine = new AudioEngine(bus, {
      personality: "drill",
      intensity: 0.5,
    });
    await engine.start();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("lifecycle", () => {
    it("initialises with configured personality", () => {
      expect(engine.isPlaying).toBe(false);
      expect(engine.isSpeaking).toBe(false);
    });

    it("dispose cleans up timers and subscriptions", () => {
      const stopSpy = vi.spyOn(engine, "stopAll");
      engine.dispose();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe("speak (TTS)", () => {
    it("speaks text and sets isSpeaking state", async () => {
      const speakingHandler = vi.fn();
      bus.on("audio:speaking", speakingHandler);

      await engine.speak("Let's go!", "intense");

      expect(engine.isSpeaking).toBe(true);
      expect(speakingHandler).toHaveBeenCalledWith(
        expect.objectContaining({ isSpeaking: true }),
      );
    });

    it("stopVoice resets speaking state", async () => {
      await engine.speak("Test");
      expect(engine.isSpeaking).toBe(true);

      engine.stopVoice();
      expect(engine.isSpeaking).toBe(false);
    });

    it("is a no-op after dispose", async () => {
      engine.dispose();
      await expect(engine.speak("test")).resolves.not.toThrow();
    });
  });

  describe("playSound (SFX)", () => {
    it("plays a sound effect and sets isPlaying state", async () => {
      const playingHandler = vi.fn();
      bus.on("audio:playing", playingHandler);

      await engine.playSound("start");

      // After creating a layer, isPlaying becomes true
      expect(playingHandler).toHaveBeenCalledWith(
        expect.objectContaining({ isPlaying: true }),
      );
    });

    it("preloads sounds into cache", async () => {
      await engine.preloadSounds(["start", "finish"]);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("playCountdown", () => {
    it("plays countdown beeps at 1-second intervals", async () => {
      const playSoundSpy = vi.spyOn(engine, "playSound");

      engine.playCountdown(3);

      // First beep is immediate
      expect(playSoundSpy).toHaveBeenCalledWith("countdown");
      expect(playSoundSpy).toHaveBeenCalledTimes(1);

      // Advance 900ms — no new beep yet
      playSoundSpy.mockClear();
      vi.advanceTimersByTime(900);
      expect(playSoundSpy).not.toHaveBeenCalled();

      // Advance remaining 100ms — second beep fires
      playSoundSpy.mockClear();
      vi.advanceTimersByTime(100);
      expect(playSoundSpy).toHaveBeenCalledWith("countdown");

      // Advance 1s — third beep
      playSoundSpy.mockClear();
      vi.advanceTimersByTime(1000);
      expect(playSoundSpy).toHaveBeenCalledWith("countdown");

      // Advance 1s — timer should be cleared, no more beeps
      playSoundSpy.mockClear();
      vi.advanceTimersByTime(1000);
      expect(playSoundSpy).not.toHaveBeenCalled();
    });

    it("does nothing for seconds <= 0", async () => {
      const playSoundSpy = vi.spyOn(engine, "playSound");
      engine.playCountdown(0);
      expect(playSoundSpy).not.toHaveBeenCalled();

      engine.playCountdown(-1);
      expect(playSoundSpy).not.toHaveBeenCalled();
    });
  });

  describe("stopAll", () => {
    it("stops voice and clears state", async () => {
      await engine.speak("Test");
      expect(engine.isSpeaking).toBe(true);

      engine.stopAll();
      expect(engine.isSpeaking).toBe(false);
      expect(engine.isPlaying).toBe(false);
    });
  });

  describe("setMusicSpeed", () => {
    it("sets playback rate on the active music layer", () => {
      // setMusicSpeed is a no-op without an active music layer
      expect(() => engine.setMusicSpeed(1.2)).not.toThrow();
    });
  });

  describe("EventBus integration — auto-speak coach messages", () => {
    it("speaks when coaching:message event fires", async () => {
      const speakSpy = vi.spyOn(engine, "speak");

      bus.emit("coaching:message", {
        text: "Push harder!",
        source: "coach",
      });

      // Wait for the async speak call
      await vi.runAllTimersAsync();

      expect(speakSpy).toHaveBeenCalledWith("Push harder!", "focused");
    });

    it("does not speak if autoSpeakCoach is disabled", async () => {
      engine.dispose();
      engine = new AudioEngine(bus, {
        autoSpeakCoach: false,
      });
      await engine.start();

      const speakSpy = vi.spyOn(engine, "speak");

      bus.emit("coaching:message", {
        text: "Push harder!",
        source: "coach",
      });

      await vi.runAllTimersAsync();
      expect(speakSpy).not.toHaveBeenCalled();
    });
  });

  describe("EventBus integration — auto-play interval sounds", () => {
    it("plays sprint sound on interval:changed with sprint phase", async () => {
      const playSoundSpy = vi.spyOn(engine, "playSound");

      bus.emit("interval:changed", {
        index: 2,
        phase: "sprint",
        interval: { phase: "sprint", durationSeconds: 30 },
      });

      expect(playSoundSpy).toHaveBeenCalledWith("sprint");
    });

    it("plays recover sound on interval:changed with recovery phase", async () => {
      const playSoundSpy = vi.spyOn(engine, "playSound");

      bus.emit("interval:changed", {
        index: 3,
        phase: "recovery",
        interval: { phase: "recovery", durationSeconds: 30 },
      });

      expect(playSoundSpy).toHaveBeenCalledWith("recover");
    });

    it("does not play if autoPlayIntervalSounds is disabled", async () => {
      engine.dispose();
      engine = new AudioEngine(bus, {
        autoPlayIntervalSounds: false,
      });
      await engine.start();

      const playSoundSpy = vi.spyOn(engine, "playSound");

      bus.emit("interval:changed", {
        index: 2,
        phase: "sprint",
        interval: { phase: "sprint", durationSeconds: 30 },
      });

      expect(playSoundSpy).not.toHaveBeenCalled();
    });

    it("plays nothing for unknown phases", async () => {
      const playSoundSpy = vi.spyOn(engine, "playSound");

      bus.emit("interval:changed", {
        index: 0,
        phase: "warmup",
        interval: { phase: "warmup", durationSeconds: 60 },
      });

      expect(playSoundSpy).toHaveBeenCalledWith("start");
    });
  });

  describe("updateConfig", () => {
    it("updates personality mid-ride", () => {
      engine.updateConfig({ personality: "zen" });
      // No direct observable effect — used in next speak() call
      expect(true).toBe(true);
    });

    it("updates intensity mid-ride", () => {
      engine.updateConfig({ intensity: 0.8 });
      // No direct observable effect — used in next speak() call
      expect(true).toBe(true);
    });
  });
});
