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
}

const DEFAULTS: Required<AudioEngineConfig> = {
  personality: "data",
  intensity: 0.5,
  autoSpeakCoach: true,
  autoPlayIntervalSounds: true,
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
    if (!this.isConfigured || this.disposed) return;

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
    }
  }

  /** Stop current voice playback */
  stopVoice(): void {
    if (this.currentVoiceLayerId) {
      this.mixer.stopLayer(this.currentVoiceLayerId);
      this.currentVoiceLayerId = null;
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
