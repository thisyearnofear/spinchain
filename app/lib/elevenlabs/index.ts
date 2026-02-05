/**
 * ElevenLabs Module - Public exports
 * 
 * Core Principles:
 * - CLEAN: Single entry point for all ElevenLabs functionality
 * - ORGANIZED: Domain-driven exports
 */

// Types
export type {
  ElevenLabsConfig,
  VoiceSettings,
  TTSRequest,
  SoundEffectRequest,
  AvatarVideoRequest,
  CoachVoice,
  AudioLayer,
  WorkoutAudioState,
  CoachEmotionalState,
} from './types';

// Constants
export {
  ELEVENLABS_CONFIG,
  COACH_VOICES,
  INTENSITY_VOICE_SETTINGS,
  WORKOUT_SOUNDS,
  SOUND_DURATIONS,
  AUDIO_PRIORITIES,
  DEFAULT_GAINS,
  EMOTION_CONFIG,
} from './constants';
export type { WorkoutSoundType } from './constants';

// Client
export {
  generateSpeech,
  generateSpeechStream,
  generateSoundEffect,
  generateAvatarVideo,
  getVoices,
  isElevenLabsConfigured,
} from './client';

// Mixer
export { getAudioMixer, resetAudioMixer, AudioMixer } from './mixer';
