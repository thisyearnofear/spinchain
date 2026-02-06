/**
 * ElevenLabs Hooks - Public exports
 * 
 * Core Principles:
 * - ORGANIZED: Single entry point for audio/voice/video hooks
 * - CLEAN: Clear separation of concerns
 */

// Voice & Audio
export { useCoachVoice } from '../common/use-coach-voice';
export type { UseCoachVoiceOptions, UseCoachVoiceReturn } from '../common/use-coach-voice';

export { useWorkoutAudio } from './use-workout-audio';
export type { UseWorkoutAudioReturn } from './use-workout-audio';

// Video Avatar
export { useCoachAvatar } from '../common/use-coach-avatar';
export type { UseCoachAvatarReturn } from '../common/use-coach-avatar';

// Music
export { useWorkoutMusic } from './use-workout-music';
export type { UseWorkoutMusicReturn } from './use-workout-music';

// Voice Commands
export { useVoiceCommands } from './use-voice-commands';
export type { UseVoiceCommandsOptions, UseVoiceCommandsReturn } from './use-voice-commands';
