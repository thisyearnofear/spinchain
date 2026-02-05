/**
 * ElevenLabs Types - Shared type definitions
 * 
 * Core Principles:
 * - DRY: Single source of truth for all ElevenLabs types
 * - MODULAR: Types used across TTS, SFX, Avatar modules
 */

// Base API configuration
export interface ElevenLabsConfig {
  apiKey: string;
  baseUrl: string;
}

// Voice settings for TTS
export interface VoiceSettings {
  stability: number;        // 0-1, default 0.5
  similarity_boost: number; // 0-1, default 0.75
  style?: number;           // 0-1, voice style exaggeration
  use_speaker_boost?: boolean;
}

// TTS Request
export interface TTSRequest {
  text: string;
  voice_id: string;
  model_id?: 'eleven_monolingual_v1' | 'eleven_multilingual_v2' | 'eleven_turbo_v2';
  voice_settings?: VoiceSettings;
  optimize_streaming_latency?: number; // 0-4, lower = faster
}

// Sound Effect Request
export interface SoundEffectRequest {
  text: string;
  duration_seconds?: number; // 0.5-22
  prompt_influence?: number; // 0-1, how closely to follow text
}

// Avatar/Video generation (if available)
export interface AvatarVideoRequest {
  image_url: string;
  audio_url?: string;
  text?: string;           // Alternative to audio_url
  voice_id?: string;       // If using text
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised';
}

// Pre-configured coach voices
export interface CoachVoice {
  id: string;
  name: string;
  personality: 'zen' | 'drill' | 'data';
  description: string;
  defaultSettings: Partial<VoiceSettings>;
}

// Audio layer for mixing
export interface AudioLayer {
  id: string;
  source: AudioBufferSourceNode | HTMLAudioElement;
  gainNode: GainNode;
  type: 'voice' | 'sfx' | 'music' | 'ambient';
  priority: number; // Higher = won't be ducked
}

// Workout audio state
export interface WorkoutAudioState {
  isPlaying: boolean;
  currentIntensity: number; // 0-1
  layers: Map<string, AudioLayer>;
  masterGain: GainNode | null;
}

// Coach emotional state (for avatar + voice)
export interface CoachEmotionalState {
  emotion: 'calm' | 'focused' | 'intense' | 'celebratory';
  intensity: number; // 0-1
  reason: string;    // Why this emotion (for debugging)
}
