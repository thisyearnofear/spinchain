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

// Client (Secure - calls server-side API routes)
export {
  generateTTS,
  generateSFX,
  transcribeAudio,
  getVoices,
  isElevenLabsConfigured,
} from './api-client';

// Legacy exports (deprecated - will be removed)
// Use the new secure api-client functions instead
export {
  generateSpeech,
  generateSpeechStream,
  generateSoundEffect,
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

// Speech-to-Text (transcribeAudio is exported from api-client above)
export {
  parseCommand,
  RealtimeTranscriber,
  VOICE_COMMANDS,
  isSpeechRecognitionSupported,
  requestMicrophoneAccess,
} from './stt';

// Mixer
export { getAudioMixer, resetAudioMixer, AudioMixer } from './mixer';
