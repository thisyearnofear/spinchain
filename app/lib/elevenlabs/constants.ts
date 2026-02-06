/**
 * ElevenLabs Constants - Configuration and presets
 * 
 * Core Principles:
 * - DRY: Single source of truth for constants
 * - ORGANIZED: Domain-driven configuration
 */

import { CoachVoice, VoiceSettings } from './types';

// API Configuration
// NOTE: API key is loaded server-side only via ELEVENLABS_API_KEY (not NEXT_PUBLIC)
// Client-side code should call API routes, not use this config directly
export const ELEVENLABS_CONFIG = {
  baseUrl: 'https://api.elevenlabs.io/v1',
  defaultModel: 'eleven_turbo_v2' as const,
  streamingLatency: 3, // 0-4, balance quality vs speed
};

// Server-side only - do not export to client
export const getElevenLabsApiKey = () => {
  if (typeof window !== 'undefined') {
    throw new Error('ElevenLabs API key is server-side only');
  }
  return process.env.ELEVENLABS_API_KEY || '';
};

// Pre-configured coach voices
// These are community/featured voices from ElevenLabs
export const COACH_VOICES: Record<string, CoachVoice> = {
  zen: {
    id: '21m00Tcm4TlvDq8ikWAM', // Rachel - calm, soothing
    name: 'Rachel',
    personality: 'zen',
    description: 'Calm and soothing, perfect for recovery and cool-down',
    defaultSettings: {
      stability: 0.6,
      similarity_boost: 0.7,
      style: 0.2,
    },
  },
  drill: {
    id: 'AZnzlk1XvdvUeBnXmlld', // Dom - energetic, commanding
    name: 'Dom',
    personality: 'drill',
    description: 'Energetic and commanding, ideal for high-intensity intervals',
    defaultSettings: {
      stability: 0.4,
      similarity_boost: 0.8,
      style: 0.7,
    },
  },
  data: {
    id: 'EXAVITQu4vr4xnSDxMaL', // Bella - professional, clear
    name: 'Bella',
    personality: 'data',
    description: 'Professional and clear, great for technical instruction',
    defaultSettings: {
      stability: 0.7,
      similarity_boost: 0.6,
      style: 0.3,
    },
  },
};

// Default voice settings by workout intensity
export const INTENSITY_VOICE_SETTINGS: Record<number, Partial<VoiceSettings>> = {
  0: { stability: 0.7, similarity_boost: 0.6, style: 0.1 }, // Recovery - calm
  0.3: { stability: 0.6, similarity_boost: 0.65, style: 0.2 }, // Warmup
  0.5: { stability: 0.5, similarity_boost: 0.7, style: 0.4 }, // Endurance
  0.7: { stability: 0.4, similarity_boost: 0.75, style: 0.6 }, // Tempo
  0.9: { stability: 0.3, similarity_boost: 0.8, style: 0.8 }, // Threshold
  1: { stability: 0.2, similarity_boost: 0.85, style: 1.0 }, // Sprint - intense
};

// Workout sound effects
export const WORKOUT_SOUNDS = {
  // System sounds
  start: 'gentle chime, workout beginning, motivational',
  finish: 'triumphant bell, achievement unlocked, celebratory',
  
  // Interval sounds
  countdown: 'electronic beep sequence, futuristic, urgent, 3-2-1',
  intervalStart: 'air horn, stadium, energetic, go signal',
  intervalEnd: 'buzzer, completion, satisfying',
  
  // Resistance sounds
  resistanceUp: 'mechanical click, industrial, satisfying, gear shift',
  resistanceDown: 'mechanical release, smooth, hydraulic',
  
  // Achievement sounds
  personalBest: 'fanfare, orchestral, golden, achievement',
  milestone: 'chime, progress, level up, video game',
  
  // Environment sounds
  crowdCheer: 'stadium crowd, cheering, distant, energetic',
  heartbeat: 'heartbeat, thumping, rhythmic, medical',
  
  // Coaching cues
  sprint: 'whistle, sharp, urgent, sports',
  recover: 'wind chimes, peaceful, gentle breeze',
  climb: 'mountain wind, elevation, atmospheric',
} as const;

export type WorkoutSoundType = keyof typeof WORKOUT_SOUNDS;

// Sound effect durations (seconds)
export const SOUND_DURATIONS: Record<WorkoutSoundType, number> = {
  start: 2,
  finish: 3,
  countdown: 3,
  intervalStart: 2,
  intervalEnd: 1,
  resistanceUp: 0.5,
  resistanceDown: 0.5,
  personalBest: 3,
  milestone: 2,
  crowdCheer: 4,
  heartbeat: 2,
  sprint: 1,
  recover: 3,
  climb: 4,
};

// Audio mixing priorities (higher = less ducking)
export const AUDIO_PRIORITIES = {
  voice: 10,      // Coach voice always clear
  countdown: 9,   // Critical timing
  system: 8,      // Start/finish
  sfx: 5,         // Workout sounds
  ambient: 2,     // Background
  music: 1,       // Most duckable
};

// Gain levels (0-1)
export const DEFAULT_GAINS = {
  voice: 1.0,
  sfx: 0.7,
  ambient: 0.3,
  music: 0.4,
};

// Emotion to avatar mapping
export const EMOTION_CONFIG = {
  calm: {
    animation: 'breathing',
    intensity: 0.2,
    colorTint: '#4ade80', // green
  },
  focused: {
    animation: 'steady',
    intensity: 0.5,
    colorTint: '#60a5fa', // blue
  },
  intense: {
    animation: 'pulsing',
    intensity: 0.8,
    colorTint: '#f97316', // orange
  },
  celebratory: {
    animation: 'energetic',
    intensity: 1.0,
    colorTint: '#eab308', // yellow
  },
};
