/**
 * ElevenLabs Music Module - AI-generated workout soundtracks
 * 
 * Note: ElevenMusic API may require specific access.
 * Provides architecture for AI music generation with fallbacks.
 * 
 * Core Principles:
 * - MODULAR: Self-contained music generation
 * - GRACEFUL DEGRADATION: Falls back to pre-generated tracks
 * - PERFORMANT: Caching and preloading
 */

import { ELEVENLABS_CONFIG } from './constants';

export interface MusicGenerationRequest {
  prompt: string;
  duration?: number;      // Seconds (max 3 minutes typically)
  genre?: 'electronic' | 'rock' | 'ambient' | 'orchestral' | 'hip-hop';
  mood?: 'energetic' | 'calm' | 'intense' | 'motivational' | 'epic';
  tempo?: 'slow' | 'medium' | 'fast' | 'variable';
  instrumental?: boolean;
}

export interface WorkoutSoundtrack {
  id: string;
  url: string;
  duration: number;
  bpm: number;
  energy: number; // 0-1
  segments: MusicSegment[];
}

export interface MusicSegment {
  startTime: number;
  endTime: number;
  intensity: number; // 0-1, for syncing with workout
  type: 'intro' | 'build' | 'drop' | 'break' | 'outro';
}

// Check if Music API is available
function isMusicApiAvailable(): boolean {
  // Check for API key and assume availability
  // In production, could make a test request
  return !!ELEVENLABS_CONFIG.apiKey && ELEVENLABS_CONFIG.apiKey.length > 0;
}

// Pre-defined workout music prompts
export const WORKOUT_MUSIC_PROMPTS = {
  warmup: {
    prompt: 'Upbeat electronic music, building energy, 120 BPM, motivational, no vocals, 2 minutes',
    duration: 120,
    bpm: 120,
  },
  endurance: {
    prompt: 'Steady driving electronic beat, consistent energy, 130 BPM, focus, instrumental, 5 minutes',
    duration: 300,
    bpm: 130,
  },
  interval: {
    prompt: 'High energy electronic music with build-ups and drops, 140 BPM, intense, no vocals, 4 minutes',
    duration: 240,
    bpm: 140,
  },
  sprint: {
    prompt: 'Maximum intensity electronic music, fast tempo, 150 BPM, explosive energy, instrumental, 1 minute',
    duration: 60,
    bpm: 150,
  },
  cooldown: {
    prompt: 'Calm ambient electronic, decreasing energy, 100 BPM, peaceful, no vocals, 3 minutes',
    duration: 180,
    bpm: 100,
  },
} as const;

export type WorkoutPhase = keyof typeof WORKOUT_MUSIC_PROMPTS;

/**
 * Generate AI music for workout
 * Falls back to pre-generated tracks if API unavailable
 */
export async function generateWorkoutMusic(
  request: MusicGenerationRequest
): Promise<WorkoutSoundtrack | null> {
  if (!isMusicApiAvailable()) {
    console.warn('Music API not configured. Using fallback tracks.');
    return getFallbackMusic(request);
  }

  try {
    // Note: This endpoint may vary - adjust based on actual ElevenLabs API
    const response = await fetch(
      `${ELEVENLABS_CONFIG.baseUrl}/music-generation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_CONFIG.apiKey,
        },
        body: JSON.stringify({
          prompt: request.prompt,
          duration: request.duration || 120,
          genre: request.genre,
          mood: request.mood,
          tempo: request.tempo,
          instrumental: request.instrumental ?? true,
        }),
      }
    );

    if (!response.ok) {
      // API might not be available, use fallback
      console.warn('Music generation API unavailable, using fallback');
      return getFallbackMusic(request);
    }

    const data = await response.json();
    
    return {
      id: data.id || `generated-${Date.now()}`,
      url: data.audio_url,
      duration: request.duration || 120,
      bpm: estimateBPM(request.prompt),
      energy: estimateEnergy(request.mood, request.prompt),
      segments: generateSegments(request.duration || 120),
    };
  } catch (error) {
    console.error('Music generation failed:', error);
    return getFallbackMusic(request);
  }
}

/**
 * Generate music for specific workout phase
 */
export async function generatePhaseMusic(
  phase: WorkoutPhase
): Promise<WorkoutSoundtrack | null> {
  const config = WORKOUT_MUSIC_PROMPTS[phase];
  return generateWorkoutMusic({
    prompt: config.prompt,
    duration: config.duration,
  });
}

/**
 * Fallback: Return pre-generated music URLs
 * In production, these would be hosted CDN URLs
 */
function getFallbackMusic(request: MusicGenerationRequest): WorkoutSoundtrack {
  // Generate a deterministic ID based on prompt
  const id = `fallback-${hashString(request.prompt)}`;
  
  // Estimate BPM from prompt
  const bpm = estimateBPM(request.prompt);
  const energy = estimateEnergy(request.mood, request.prompt);
  
  return {
    id,
    url: `/audio/workout-fallback-${bpm}bpm.mp3`, // Placeholder path
    duration: request.duration || 120,
    bpm,
    energy,
    segments: generateSegments(request.duration || 120),
  };
}

/**
 * Estimate BPM from prompt text
 */
function estimateBPM(prompt: string): number {
  const bpmMatch = prompt.match(/(\d+)\s*BPM/i);
  if (bpmMatch) return parseInt(bpmMatch[1], 10);
  
  if (prompt.includes('150')) return 150;
  if (prompt.includes('140')) return 140;
  if (prompt.includes('130')) return 130;
  if (prompt.includes('120')) return 120;
  if (prompt.includes('100')) return 100;
  
  return 128; // Default EDM tempo
}

/**
 * Estimate energy level from mood/prompt
 */
function estimateEnergy(mood?: string, prompt?: string): number {
  const text = `${mood || ''} ${prompt || ''}`.toLowerCase();
  
  if (text.includes('intense') || text.includes('sprint') || text.includes('maximum')) return 1.0;
  if (text.includes('high') || text.includes('energetic') || text.includes('explosive')) return 0.9;
  if (text.includes('interval') || text.includes('driving')) return 0.8;
  if (text.includes('endurance') || text.includes('steady')) return 0.6;
  if (text.includes('warmup') || text.includes('upbeat')) return 0.5;
  if (text.includes('cooldown') || text.includes('calm') || text.includes('peaceful')) return 0.3;
  
  return 0.6; // Default
}

/**
 * Generate music segments for syncing
 */
function generateSegments(duration: number): MusicSegment[] {
  const segments: MusicSegment[] = [];
  const segmentLength = 30; // 30-second segments
  
  for (let i = 0; i < duration; i += segmentLength) {
    const startTime = i;
    const endTime = Math.min(i + segmentLength, duration);
    const progress = i / duration;
    
    let type: MusicSegment['type'] = 'build';
    if (progress < 0.1) type = 'intro';
    else if (progress > 0.8) type = 'outro';
    else if (progress > 0.4 && progress < 0.6) type = 'drop';
    else if (progress > 0.6 && progress < 0.7) type = 'break';
    
    segments.push({
      startTime,
      endTime,
      intensity: calculateSegmentIntensity(progress, type),
      type,
    });
  }
  
  return segments;
}

function calculateSegmentIntensity(progress: number, type: MusicSegment['type']): number {
  switch (type) {
    case 'intro': return 0.2 + progress * 2;
    case 'build': return 0.4 + progress * 0.4;
    case 'drop': return 0.9;
    case 'break': return 0.5;
    case 'outro': return 0.8 - (progress - 0.8) * 2;
    default: return 0.5;
  }
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}
