/**
 * WorkoutPlan - Structured workout interval data model
 * 
 * Core Principles:
 * - DRY: Single source of truth for workout structure types
 * - MODULAR: Independent from route data, composable with audio/visual systems
 * - CLEAN: Pure types + utility functions, no side effects
 */

// ─── Types ───────────────────────────────────────────────────────

export type IntervalPhase = 
  | 'warmup' 
  | 'endurance' 
  | 'interval' 
  | 'sprint' 
  | 'recovery' 
  | 'cooldown';

export interface WorkoutInterval {
  phase: IntervalPhase;
  durationSeconds: number;
  targetRpm?: [number, number];       // [min, max] cadence range
  targetHrZone?: 1 | 2 | 3 | 4 | 5;
  targetPower?: [number, number];     // [min, max] watts
  coachCue?: string;                  // Text for voice coach
  musicEnergy?: number;               // 0-1, drives music generation
  visualIntensity?: number;           // 0-1, drives theme/particles
}

export type WorkoutDifficulty = 'easy' | 'moderate' | 'hard';

export interface WorkoutPlan {
  id: string;
  name: string;
  description?: string;
  intervals: WorkoutInterval[];
  totalDuration: number;              // Computed seconds
  difficulty: WorkoutDifficulty;
  tags: string[];
}

// ─── Phase Config ────────────────────────────────────────────────

/** Default visual/audio intensity per phase */
export const PHASE_DEFAULTS: Record<IntervalPhase, {
  musicEnergy: number;
  visualIntensity: number;
  hrZone: 1 | 2 | 3 | 4 | 5;
  coachEmotion: 'calm' | 'focused' | 'intense' | 'celebratory';
}> = {
  warmup:    { musicEnergy: 0.3, visualIntensity: 0.2, hrZone: 1, coachEmotion: 'calm' },
  endurance: { musicEnergy: 0.5, visualIntensity: 0.4, hrZone: 2, coachEmotion: 'focused' },
  interval:  { musicEnergy: 0.7, visualIntensity: 0.6, hrZone: 3, coachEmotion: 'focused' },
  sprint:    { musicEnergy: 1.0, visualIntensity: 1.0, hrZone: 5, coachEmotion: 'intense' },
  recovery:  { musicEnergy: 0.2, visualIntensity: 0.1, hrZone: 1, coachEmotion: 'calm' },
  cooldown:  { musicEnergy: 0.15, visualIntensity: 0.1, hrZone: 1, coachEmotion: 'calm' },
};

/** Maps phase to story beat type for visual integration */
export const PHASE_TO_BEAT_TYPE: Record<IntervalPhase, 'climb' | 'sprint' | 'drop' | 'rest'> = {
  warmup: 'rest',
  endurance: 'climb',
  interval: 'climb',
  sprint: 'sprint',
  recovery: 'rest',
  cooldown: 'drop',
};

/** Maps phase to preferred visualizer theme for mood shifts */
export const PHASE_TO_THEME: Record<IntervalPhase, 'neon' | 'alpine' | 'mars'> = {
  warmup: 'alpine',
  endurance: 'neon',
  interval: 'neon',
  sprint: 'mars',
  recovery: 'alpine',
  cooldown: 'alpine',
};

// ─── Utilities ───────────────────────────────────────────────────

/** Compute total duration from intervals */
export function computeTotalDuration(intervals: WorkoutInterval[]): number {
  return intervals.reduce((sum, i) => sum + i.durationSeconds, 0);
}

/** Get current interval index based on elapsed seconds */
export function getCurrentInterval(intervals: WorkoutInterval[], elapsedSeconds: number): number {
  let accumulated = 0;
  for (let i = 0; i < intervals.length; i++) {
    accumulated += intervals[i].durationSeconds;
    if (elapsedSeconds < accumulated) return i;
  }
  return intervals.length - 1;
}

/** Get progress within the current interval (0-1) */
export function getIntervalProgress(intervals: WorkoutInterval[], elapsedSeconds: number): number {
  let accumulated = 0;
  for (const interval of intervals) {
    if (elapsedSeconds < accumulated + interval.durationSeconds) {
      return (elapsedSeconds - accumulated) / interval.durationSeconds;
    }
    accumulated += interval.durationSeconds;
  }
  return 1;
}

/** Get seconds remaining in current interval */
export function getIntervalRemaining(intervals: WorkoutInterval[], elapsedSeconds: number): number {
  let accumulated = 0;
  for (const interval of intervals) {
    if (elapsedSeconds < accumulated + interval.durationSeconds) {
      return accumulated + interval.durationSeconds - elapsedSeconds;
    }
    accumulated += interval.durationSeconds;
  }
  return 0;
}

/** Create a WorkoutPlan from intervals with computed fields */
export function createWorkoutPlan(
  id: string,
  name: string,
  intervals: WorkoutInterval[],
  difficulty: WorkoutDifficulty,
  tags: string[] = [],
  description?: string,
): WorkoutPlan {
  return {
    id,
    name,
    description,
    intervals: intervals.map(interval => ({
      ...interval,
      musicEnergy: interval.musicEnergy ?? PHASE_DEFAULTS[interval.phase].musicEnergy,
      visualIntensity: interval.visualIntensity ?? PHASE_DEFAULTS[interval.phase].visualIntensity,
      targetHrZone: interval.targetHrZone ?? PHASE_DEFAULTS[interval.phase].hrZone,
    })),
    totalDuration: computeTotalDuration(intervals),
    difficulty,
    tags,
  };
}

// ─── Preset Workouts (Simpleton-inspired JSON DB) ────────────────

export const PRESET_WORKOUTS: WorkoutPlan[] = [
  createWorkoutPlan('beginner-30', '30-Min Easy Ride', [
    { phase: 'warmup', durationSeconds: 300, targetRpm: [70, 80], coachCue: 'Easy spin, find your rhythm' },
    { phase: 'endurance', durationSeconds: 600, targetRpm: [80, 90], coachCue: 'Steady pace, controlled breathing' },
    { phase: 'interval', durationSeconds: 120, targetRpm: [90, 100], coachCue: 'Pick it up!' },
    { phase: 'recovery', durationSeconds: 120, targetRpm: [65, 75], coachCue: 'Bring it down, recover' },
    { phase: 'interval', durationSeconds: 120, targetRpm: [90, 100], coachCue: 'Here we go again!' },
    { phase: 'recovery', durationSeconds: 120, targetRpm: [65, 75], coachCue: 'Good work, easy spin' },
    { phase: 'endurance', durationSeconds: 300, targetRpm: [80, 90], coachCue: 'Steady finish' },
    { phase: 'cooldown', durationSeconds: 120, targetRpm: [60, 70], coachCue: 'Cool it down, nice work' },
  ], 'easy', ['beginner', '30min']),

  createWorkoutPlan('hiit-45', '45-Min HIIT Blaster', [
    { phase: 'warmup', durationSeconds: 300, targetRpm: [75, 85], coachCue: 'Warm up those legs' },
    { phase: 'endurance', durationSeconds: 300, targetRpm: [85, 95], coachCue: 'Build your base' },
    // 6x sprint/recovery intervals
    { phase: 'sprint', durationSeconds: 30, targetRpm: [100, 120], coachCue: 'ALL OUT! Go go go!' },
    { phase: 'recovery', durationSeconds: 90, targetRpm: [65, 75], coachCue: 'Breathe. Recover.' },
    { phase: 'sprint', durationSeconds: 30, targetRpm: [100, 120], coachCue: 'EXPLODE!' },
    { phase: 'recovery', durationSeconds: 90, targetRpm: [65, 75], coachCue: 'Easy spin, reset' },
    { phase: 'sprint', durationSeconds: 30, targetRpm: [100, 120], coachCue: 'DIG DEEP!' },
    { phase: 'recovery', durationSeconds: 90, targetRpm: [65, 75], coachCue: 'Halfway there' },
    { phase: 'sprint', durationSeconds: 30, targetRpm: [100, 120], coachCue: 'PUSH THROUGH!' },
    { phase: 'recovery', durationSeconds: 90, targetRpm: [65, 75], coachCue: 'Almost there' },
    { phase: 'sprint', durationSeconds: 30, targetRpm: [100, 120], coachCue: 'LEAVE IT ALL!' },
    { phase: 'recovery', durationSeconds: 90, targetRpm: [65, 75], coachCue: 'One more left' },
    { phase: 'sprint', durationSeconds: 30, targetRpm: [100, 120], coachCue: 'LAST ONE! EVERYTHING!' },
    { phase: 'recovery', durationSeconds: 120, targetRpm: [60, 70], coachCue: 'Incredible effort' },
    { phase: 'endurance', durationSeconds: 420, targetRpm: [80, 90], coachCue: 'Steady finish, stay strong' },
    { phase: 'cooldown', durationSeconds: 300, targetRpm: [60, 70], coachCue: 'You crushed it. Cool down.' },
  ], 'hard', ['hiit', '45min', 'sprint']),

  createWorkoutPlan('climb-45', '45-Min Mountain Climb', [
    { phase: 'warmup', durationSeconds: 300, targetRpm: [75, 85], coachCue: 'Loosen up for the climb ahead' },
    { phase: 'endurance', durationSeconds: 300, targetRpm: [80, 90], coachCue: 'Flat road, build momentum' },
    { phase: 'interval', durationSeconds: 300, targetRpm: [70, 80], targetPower: [180, 220], coachCue: 'First incline, heavy resistance' },
    { phase: 'recovery', durationSeconds: 120, targetRpm: [65, 75], coachCue: 'Brief descent, recover' },
    { phase: 'interval', durationSeconds: 360, targetRpm: [65, 75], targetPower: [200, 250], coachCue: 'Steep climb! Grind it out' },
    { phase: 'recovery', durationSeconds: 120, targetRpm: [70, 80], coachCue: 'False flat, catch your breath' },
    { phase: 'sprint', durationSeconds: 60, targetRpm: [90, 110], coachCue: 'SUMMIT SPRINT! Everything you have!' },
    { phase: 'recovery', durationSeconds: 180, targetRpm: [60, 70], coachCue: 'You made it. Enjoy the descent.' },
    { phase: 'cooldown', durationSeconds: 360, targetRpm: [60, 70], coachCue: 'Coast home. Amazing climb.' },
  ], 'hard', ['climbing', '45min', 'endurance']),
];

/** Get a preset workout by ID */
export function getPresetWorkout(id: string): WorkoutPlan | undefined {
  return PRESET_WORKOUTS.find(w => w.id === id);
}
