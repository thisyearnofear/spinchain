/**
 * AudioEngine — Manages TTS (coach voice), sound effects, music, and
 * AudioMixer lifecycle for the ride experience.
 *
 * Design rules:
 * - Plain TS class — no React imports.
 * - Wraps existing ElevenLabs client functions and AudioMixer singleton.
 * - Listens for EventBus events to auto-speak coach messages and play
 *   interval sounds.
 * - Audio state (speaking, playing) is emitted via EventBus for the UI layer.
 * - Callers outside the engine layer (the coordinator hook) can still call
 *   speak/playSound directly for imperative audio (e.g. countdown, gear shift).
 */

import { EventBus } from "./event-bus";
import {
  generateSpeech,
  generateSoundEffect,
  getAudioMixer,
  COACH_VOICES,
  INTENSITY_VOICE_SETTINGS,
  WORKOUT_SOUNDS,
  SOUND_DURATIONS,
  AUDIO_PRIORITIES,
  type VoiceSettings,
  type WorkoutSoundType,
} from "@/app/lib/elevenlabs";
import { checkElevenLabsConfigured } from "@/app/lib/elevenlabs/client";

export interface AudioEngineConfig {
  personality?: "zen" | "drill" | "data";
  /** Coach voice intensity 0-1 (affects TTS settings) */
  intensity?: number;
  /** Whether to auto-speak coaching:message events */
  autoSpeakCoach?: boolean;
  /** Whether to auto-play interval:changed sounds */
  autoPlayIntervalSounds?: boolean;
  /** Fall back to the browser's built-in speechSynthesis when ElevenLabs is unavailable */
  systemFallback?: boolean;
}

const DEFAULTS: Required<AudioEngineConfig> = {
  personality: "data",
  intensity: 0.5,
  autoSpeakCoach: true,
  autoPlayIntervalSounds: true,
  systemFallback: true,
};

const AUDIO_CACHE_NAME = "elevenlabs-audio-v1";

/** Preloaded sound effects cache (shared across instances for reuse) */
const preloadedSounds = new Map<WorkoutSoundType, ArrayBuffer>();

export class AudioEngine {
  private readonly bus: EventBus;
  private config: Required<AudioEngineConfig>;
  private mixer = getAudioMixer();
  private disposed = false;
  private initialized = false;
  private isConfigured = false;

  /** Tracks whether audio is currently playing (SFX or music) */
  isPlaying = false;
  /** Tracks whether TTS voice is currently speaking */
  isSpeaking = false;

  /** Current voice layer ID for stop() */
  private currentVoiceLayerId: string | null = null;
  /** Current music layer ID for setMusicSpeed() */
  private currentMusicLayerId: string | null = null;
  /** Tracks active SFX/music layer IDs so we don't reach into the mixer's internals */
  private readonly activeLayers = new Set<string>();

  /** Interval-based countdown timer */
  private countdownTimerId: ReturnType<typeof setInterval> | null = null;

  /** Unsubscribe functions for EventBus listeners */
  private unsubCoachMessage: (() => void) | null = null;
  private unsubIntervalChanged: (() => void) | null = null;
  /** Last failed isConfigured re-check (ms epoch) — throttles retry attempts */
  private lastConfigRetry = 0;

  constructor(
    bus: EventBus,
    config?: AudioEngineConfig,
  ) {
    this.bus = bus;
    this.config = { ...DEFAULTS, ...config };
  }

  // ─── Lifecycle ─────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.disposed) return;

    // Initialize audio mixer (must be after user gesture)
    try {
      await this.mixer.initialize();
      this.initialized = true;
    } catch (err) {
      console.warn("[AudioEngine] Mixer init failed:", err);
      return;
    }

    // Check if ElevenLabs is configured
    try {
      this.isConfigured = await checkElevenLabsConfigured();
    } catch {
      this.isConfigured = false;
    }

    // Subscribe to EventBus events for auto-audio
    if (this.config.autoSpeakCoach) {
      this.unsubCoachMessage = this.bus.on(
        "coaching:message",
        ({ text }) => {
          if (text && !this.disposed) {
            // Fire-and-forget TTS for coach messages
            this.speak(text, "focused").catch(() => {});
          }
        },
      );
    }

    if (this.config.autoPlayIntervalSounds) {
      this.unsubIntervalChanged = this.bus.on(
        "interval:changed",
        ({ phase }) => {
          if (this.disposed) return;
          if (phase === "sprint") {
            this.playSound("sprint");
          } else if (phase === "recovery" || phase === "cooldown") {
            this.playSound("recover");
          } else if (phase === "warmup") {
            this.playSound("start");
          }
        },
      );
    }
  }

  stop(): void {
    this.stopAll();
  }

  dispose(): void {
    this.disposed = true;
    this.stopAll();
    this.clearCountdown();
    this.unsubCoachMessage?.();
    this.unsubCoachMessage = null;
    this.unsubIntervalChanged?.();
    this.unsubIntervalChanged = null;
  }

  // ─── TTS (Coach Voice) ───────────────────────────────────────

  /** Speak text with optional emotion */
  async speak(
    text: string,
    emotion?: "calm" | "focused" | "intense" | "celebratory",
  ): Promise<void> {
    if (this.disposed) return;

    // If a previous config check failed (e.g. server briefly unavailable),
    // lazily re-check (throttled to once per 15s) so audio self-heals
    // mid-ride without needing a page reload.
    if (!this.isConfigured) {
      const now = Date.now();
      if (now - this.lastConfigRetry < 15_000) return;
      this.lastConfigRetry = now;
      try {
        this.isConfigured = await checkElevenLabsConfigured();
      } catch {
        return;
      }
      if (!this.isConfigured) {
        if (this.config.systemFallback) this.speakWithSystemVoice(text, emotion);
        return;
      }
    }

    // Stop any current speech
    this.stopVoice();

    try {
      await this.mixer.resume();

      const voice = COACH_VOICES[this.config.personality];
      const roundedIntensity = Math.round(this.config.intensity * 10) / 10;
      const cacheKey = `audio:tts:${this.config.personality}:${roundedIntensity}:${emotion}:${text}`;

      // Try Cache API first
      let audioBuffer: ArrayBuffer | undefined;
      try {
        const cache = await caches.open(AUDIO_CACHE_NAME);
        const cached = await cache.match(cacheKey);
        if (cached) audioBuffer = await cached.arrayBuffer();
      } catch {
        // Cache unavailable — skip
      }

      if (!audioBuffer) {
        audioBuffer = await generateSpeech({
          text,
          voice_id: voice.id,
          voice_settings: this.getVoiceSettings(emotion),
        });

        // Cache the result
        try {
          const cache = await caches.open(AUDIO_CACHE_NAME);
          await cache.put(
            cacheKey,
            new Response(audioBuffer.slice(0), {
              headers: { "Content-Type": "audio/mpeg" },
            }),
          );
        } catch {
          // Cache unavailable — skip
        }
      }

      // Create mixer layer and play
      const layerId = `voice-${Date.now()}`;
      this.currentVoiceLayerId = layerId;

      const layer = await this.mixer.createLayer(
        layerId,
        audioBuffer,
        "voice",
        AUDIO_PRIORITIES.voice,
      );

      this.isSpeaking = true;
      this.emitSpeakingState();

      if (typeof AudioBufferSourceNode !== "undefined" && layer.source instanceof AudioBufferSourceNode) {
        layer.source.onended = () => {
          this.isSpeaking = false;
          this.currentVoiceLayerId = null;
          this.emitSpeakingState();
        };
      }

      this.mixer.playLayer(layerId);
    } catch (err) {
      console.warn("[AudioEngine] TTS failed:", err);
      this.isSpeaking = false;
      this.emitSpeakingState();
      // Degraded tier: never leave the coach silent if synthesis failed
      if (this.config.systemFallback) this.speakWithSystemVoice(text, emotion);
    }
  }

  /**
   * System-voice fallback using the browser's built-in speechSynthesis.
   * Free, instant, zero network — used when ElevenLabs is unconfigured or
   * synthesis fails, so the coach is never silent. Lower fidelity by design.
   */
  private speakWithSystemVoice(
    text: string,
    emotion?: "calm" | "focused" | "intense" | "celebratory",
  ): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const profiles = {
        calm: { rate: 0.9, pitch: 0.9 },
        focused: { rate: 1.0, pitch: 1.0 },
        intense: { rate: 1.15, pitch: 1.1 },
        celebratory: { rate: 1.1, pitch: 1.2 },
      } as const;
      const profile = profiles[emotion ?? "focused"] ?? profiles.focused;
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      utterance.volume = 0.9;
      utterance.onstart = () => {
        this.isSpeaking = true;
        this.emitSpeakingState();
      };
      utterance.onend = () => {
        this.isSpeaking = false;
        this.emitSpeakingState();
      };
      utterance.onerror = () => {
        this.isSpeaking = false;
        this.emitSpeakingState();
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      // System TTS unavailable — stay silent
    }
  }

  /**
   * Prewarm the TTS caches for the ride's scripted cues (interval coachCues,
   * story beat labels) before they're needed. Synthesizes each unique phrase
   * once (populating the server LRU) and persists the audio into the client
   * Cache API, so interval transitions speak with zero perceived latency.
   * Fire-and-forget; failures are silently skipped.
   */
  async prewarm(texts: string[]): Promise<void> {
    if (this.disposed || !this.isConfigured) return;
    const unique = [...new Set(texts.filter((t) => t && t.trim().length > 0))].slice(0, 12);
    const voice = COACH_VOICES[this.config.personality];
    const voiceSettings = this.getVoiceSettings("focused");
    const cachePrefix = `audio:tts:${this.config.personality}:${Math.round(this.config.intensity * 10) / 10}:focused:`;
    const cache = await caches.open(AUDIO_CACHE_NAME).catch(() => null);

    const queue = [...unique];
    const worker = async (): Promise<void> => {
      while (queue.length > 0 && !this.disposed) {
        const text = queue.shift();
        if (!text) return;
        try {
          const cacheKey = `${cachePrefix}${text}`;
          if (cache && (await cache.match(cacheKey))) continue;
          const buffer = await generateSpeech({
            text,
            voice_id: voice.id,
            voice_settings: voiceSettings,
          });
          if (cache) {
            await cache
              .put(cacheKey, new Response(buffer.slice(0), { headers: { "Content-Type": "audio/mpeg" } }))
              .catch(() => {});
          }
        } catch {
          // Skip failed cues — they'll synthesize on demand instead
        }
      }
    };
    await Promise.all(Array.from({ length: 2 }, worker));
  }

  /** Stop current voice playback */
  stopVoice(): void {
    if (this.currentVoiceLayerId) {
      this.mixer.stopLayer(this.currentVoiceLayerId);
      this.currentVoiceLayerId = null;
    }
    // Also cancel any system-voice fallback playback
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.emitSpeakingState();
  }

  // ─── Sound Effects ────────────────────────────────────────────

  /** Play a workout sound effect */
  async playSound(type: WorkoutSoundType): Promise<void> {
    if (!this.isConfigured || this.disposed) return;

    try {
      await this.mixer.resume();

      // Use preloaded sound or generate new
      let audioBuffer = preloadedSounds.get(type);

      if (!audioBuffer) {
        audioBuffer = await generateSoundEffect({
          text: WORKOUT_SOUNDS[type],
          duration_seconds: SOUND_DURATIONS[type],
        });
        preloadedSounds.set(type, audioBuffer);
      }

      const layerId = `sfx-${type}-${Date.now()}`;

      // Track if this is a music/beat layer for biometric sync
      if (
        type.toString().includes("music") ||
        type.toString().includes("beat")
      ) {
        this.currentMusicLayerId = layerId;
      }

      this.isPlaying = true;
      this.activeLayers.add(layerId);
      this.emitPlayingState();

      const layer = await this.mixer.createLayer(
        layerId,
        audioBuffer,
        "sfx",
        AUDIO_PRIORITIES.sfx,
      );

      if (typeof AudioBufferSourceNode !== "undefined" && layer.source instanceof AudioBufferSourceNode) {
        layer.source.onended = () => {
          this.activeLayers.delete(layerId);
          if (this.currentMusicLayerId === layerId) {
            this.currentMusicLayerId = null;
          }
          if (this.activeLayers.size === 0) {
            this.isPlaying = false;
            this.emitPlayingState();
          }
        };
      }

      this.mixer.playLayer(layerId);
    } catch (err) {
      console.warn("[AudioEngine] playSound failed:", err);
    }
  }

  /** Preload sound effects for low-latency playback */
  async preloadSounds(types: WorkoutSoundType[]): Promise<void> {
    if (!this.isConfigured || this.disposed) return;

    const promises = types.map(async (type) => {
      if (preloadedSounds.has(type)) return;
      try {
        const buffer = await generateSoundEffect({
          text: WORKOUT_SOUNDS[type],
          duration_seconds: SOUND_DURATIONS[type],
        });
        preloadedSounds.set(type, buffer);
      } catch {
        // Best-effort
      }
    });

    await Promise.all(promises);
  }

  /** Play a countdown sequence (beeps every second) */
  playCountdown(seconds: number): void {
    if (!this.isConfigured || this.disposed || seconds <= 0) return;

    let remaining = seconds;

    // Play first beep immediately
    this.playSound("countdown");
    remaining--;

    this.clearCountdown();

    this.countdownTimerId = setInterval(() => {
      if (remaining > 0) {
        this.playSound("countdown");
        remaining--;
      } else {
        this.clearCountdown();
      }
    }, 1000);
  }

  /** Stop all audio (voice + SFX + music) */
  stopAll(): void {
    this.clearCountdown();
    this.stopVoice();
    this.mixer.stopAll();

    this.isPlaying = false;
    this.isSpeaking = false;
    this.currentMusicLayerId = null;
    this.activeLayers.clear();
    this.emitSpeakingState();
    this.emitPlayingState();
  }

  // ─── Music BPM Sync ──────────────────────────────────────────

  /** Set playback rate for the current music layer (for biometric sync) */
  setMusicSpeed(rate: number): void {
    if (this.currentMusicLayerId) {
      this.mixer.setLayerPlaybackRate(this.currentMusicLayerId, rate);
    }
  }

  // ─── Config ──────────────────────────────────────────────────

  /** Update coach personality or intensity mid-ride */
  updateConfig(partial: Partial<AudioEngineConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private getVoiceSettings(
    emotion?: string,
  ): VoiceSettings {
    const baseVoice = COACH_VOICES[this.config.personality];
    const intensitySettings =
      INTENSITY_VOICE_SETTINGS[
        Math.round(this.config.intensity * 10) / 10
      ] || {};

    const emotionSettings: Record<string, Partial<VoiceSettings>> = {
      calm: { stability: 0.7, style: 0.1 },
      focused: { stability: 0.5, style: 0.4 },
      intense: { stability: 0.3, style: 0.8 },
      celebratory: { stability: 0.4, style: 0.9 },
    };

    return {
      ...baseVoice.defaultSettings,
      ...intensitySettings,
      ...(emotion ? emotionSettings[emotion] : {}),
    } as VoiceSettings;
  }

  private clearCountdown(): void {
    if (this.countdownTimerId) {
      clearInterval(this.countdownTimerId);
      this.countdownTimerId = null;
    }
  }

  private emitSpeakingState(): void {
    this.bus.emit("audio:speaking", {
      isSpeaking: this.isSpeaking,
    });
  }

  private emitPlayingState(): void {
    this.bus.emit("audio:playing", {
      isPlaying: this.isPlaying,
    });
  }
}
