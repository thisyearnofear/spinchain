/**
 * ElevenLabs Module - Public exports
 * 
 * Core Principles:
 * - CLEAN: Single entry point for all ElevenLabs functionality
 * - ORGANIZED: Domain-driven exports
 * - DRY: All client functions consolidated in client.ts
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

// Client (all ElevenLabs API calls proxied through server routes)
export {
  // TTS & SFX
  generateSpeech,
  generateSpeechStream,
  generateSoundEffect,
  // Aliases for convenience
  generateSpeech as generateTTS,
  generateSoundEffect as generateSFX,
  // Voice management
  getVoices,
  // Configuration
  isElevenLabsConfigured,
  checkElevenLabsConfigured,
} from './client';

// Video/Avatar
export {
  generateLipSyncVideo,
  generateVideo,
  createFallbackAvatarAnimation,
  FALLBACK_AVATAR_CSS,
} from './video';

// Music
export {
  generateWorkoutMusic,
  generatePhaseMusic,
  WORKOUT_MUSIC_PROMPTS,
} from './music';

// Speech-to-Text
export {
  parseCommand,
  RealtimeTranscriber,
  VOICE_COMMANDS,
  isSpeechRecognitionSupported,
  requestMicrophoneAccess,
} from './stt';

// Mixer
export { getAudioMixer, resetAudioMixer, AudioMixer } from './mixer';
