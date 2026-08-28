/**
 * Music Engine — BPM-synced background music with adaptive intensity and TTS ducking.
 *
 * Core features:
 * 1. BPM-synced music that adjusts intensity based on flow state
 * 2. TTS ducking — music lowers when coach speaks
 * 3. Beat detection for visual sync (particles, camera shake, etc.)
 * 4. Music categories per interval phase (high-energy sprints vs ambient recovery)
 * 5. Volume automation with smooth transitions
 *
 * Architecture:
 * - Music tracks loaded per interval phase
 * - BPM drives visual effects (not actual audio — we use a conceptual beat)
 * - Ducking engine handles TTS overlap
 * - Flow state scales music intensity
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface MusicTrack {
  id: string;
  name: string;
  bpm: number;
  duration: number; // seconds
  category: 'high-energy' | 'focus' | 'ambient' | 'celebration';
  intensity: number; // 0-1 base intensity
  color: string; // visual color for synced effects
  url?: string; // optional audio URL
}

export interface MusicState {
  isPlaying: boolean;
  currentTrack: MusicTrack | null;
  volume: number; // 0-1
  duckingVolume: number; // 0-1 (lower when TTS playing)
  bpm: number;
  beatProgress: number; // 0-1 current beat position
  phase: string; // current interval phase
  flowTier: number;
}

export interface BeatEvent {
  time: number;
  intensity: number; // 0-1 beat strength
  category: 'downbeat' | 'accent' | 'soft';
}

export interface MusicConfig {
  baseVolume: number;
  duckAmount: number; // how much to lower during TTS (0-1)
  duckRecovery: number; // how fast to return after TTS
  beatAccuracy: number; // ms tolerance for beat sync
}

// ─── Music Track Library ─────────────────────────────────────────────

export const MUSIC_LIBRARY: Record<string, MusicTrack[]> = {
  'sprint': [
    { id: 'sprint-1', name: 'Maximum Effort', bpm: 140, duration: 180, category: 'high-energy', intensity: 0.9, color: '#ef4444' },
    { id: 'sprint-2', name: 'Red Zone', bpm: 145, duration: 180, category: 'high-energy', intensity: 1.0, color: '#dc2626' },
    { id: 'sprint-3', name: 'Push Hard', bpm: 138, duration: 180, category: 'high-energy', intensity: 0.85, color: '#f97316' },
  ],
  'interval': [
    { id: 'interval-1', name: 'Steady State', bpm: 120, duration: 300, category: 'focus', intensity: 0.6, color: '#f59e0b' },
    { id: 'interval-2', name: 'Work Zone', bpm: 125, duration: 300, category: 'focus', intensity: 0.7, color: '#d97706' },
  ],
  'warmup': [
    { id: 'warmup-1', name: 'Getting Ready', bpm: 100, duration: 300, category: 'ambient', intensity: 0.4, color: '#34d399' },
    { id: 'warmup-2', name: 'Warm Up', bpm: 105, duration: 300, category: 'ambient', intensity: 0.5, color: '#10b981' },
  ],
  'recovery': [
    { id: 'recovery-1', name: 'Breathe', bpm: 80, duration: 300, category: 'ambient', intensity: 0.3, color: '#38bdf8' },
    { id: 'recovery-2', name: 'Cool Down', bpm: 75, duration: 300, category: 'ambient', intensity: 0.25, color: '#818cf8' },
  ],
  'cooldown': [
    { id: 'cooldown-1', name: 'Recovery', bpm: 70, duration: 600, category: 'ambient', intensity: 0.2, color: '#a78bfa' },
  ],
  'celebration': [
    { id: 'celebration-1', name: 'Victory', bpm: 130, duration: 180, category: 'celebration', intensity: 1.0, color: '#fbbf24' },
    { id: 'milestone-1', name: 'Achievement', bpm: 125, duration: 120, category: 'celebration', intensity: 0.9, color: '#f59e0b' },
  ],
};

// ─── Beat Engine ─────────────────────────────────────────────────────

/**
 * Generate beat events from BPM.
 */
export function generateBeatEvents(
  bpm: number,
  duration: number,
): BeatEvent[] {
  const beatInterval = 60000 / bpm; // ms per beat
  const events: BeatEvent[] = [];
  const totalBeats = Math.floor(duration * 1000 / beatInterval);

  for (let i = 0; i < totalBeats; i++) {
    const isDownbeat = i % 4 === 0;
    const isAccent = i % 2 === 0;
    
    events.push({
      time: i * beatInterval,
      intensity: isDownbeat ? 1.0 : isAccent ? 0.7 : 0.4,
      category: isDownbeat ? 'downbeat' : isAccent ? 'accent' : 'soft',
    });
  }

  return events;
}

/**
 * Get current beat state from time and BPM.
 */
export function getBeatProgress(
  bpm: number,
  elapsedMs: number,
): { progress: number; beatIndex: number; intensity: number } {
  const beatInterval = 60000 / bpm;
  const beatIndex = Math.floor(elapsedMs / beatInterval);
  const progress = (elapsedMs % beatInterval) / beatInterval;
  
  // Downbeats every 4 beats
  const isDownbeat = beatIndex % 4 === 0;
  const isAccent = beatIndex % 2 === 0;
  const intensity = isDownbeat ? 1.0 : isAccent ? 0.7 : 0.4;

  return { progress, beatIndex, intensity };
}

// ─── Ducking Engine ──────────────────────────────────────────────────

/**
 * Manage music volume ducking during TTS.
 */
export class DuckingEngine {
  private targetVolume: number;
  private currentVolume: number;
  private _isDucked: boolean;
  private duckAmount: number;
  private duckRecovery: number;

  constructor(config: { duckAmount: number; duckRecovery: number; baseVolume: number }) {
    this.duckAmount = config.duckAmount;
    this.duckRecovery = config.duckRecovery;
    this.targetVolume = config.baseVolume;
    this.currentVolume = config.baseVolume;
    this._isDucked = false;
  }

  /**
   * Start ducking (TTS speaking).
   */
  startDucking(): void {
    this._isDucked = true;
    this.targetVolume = this.targetVolume * (1 - this.duckAmount);
  }

  /**
   * Stop ducking (TTS finished).
   */
  stopDucking(): void {
    this._isDucked = false;
    this.targetVolume = this.targetVolume / (1 - this.duckAmount);
    // Clamp to max
    this.targetVolume = Math.min(1, this.targetVolume);
  }

  /**
   * Update current volume with smooth transition.
   */
  update(deltaMs: number): number {
    const speed = this._isDucked ? this.duckAmount : this.duckRecovery;
    const diff = this.targetVolume - this.currentVolume;
    this.currentVolume += diff * (speed * deltaMs / 1000);
    return Math.max(0, Math.min(1, this.currentVolume));
  }

  /**
   * Set base volume (user volume control).
   */
  setBaseVolume(volume: number): void {
    this.targetVolume = volume;
    this.currentVolume = volume;
  }

  getCurrentVolume(): number {
    return this.currentVolume;
  }

  isDucked(): boolean {
    return this._isDucked;
  }
}

// ─── Beat Event Callback System ─────────────────────────────────────

export interface BeatCallback {
  (beat: { progress: number; intensity: number; isDownbeat: boolean; beatIndex: number }): void;
}

export function onBeat(cb: BeatCallback): () => void {
  // Store callback on musicEngine for beat sync
  if (!(musicEngine as any).beatCallbacks) {
    (musicEngine as any).beatCallbacks = [];
  }
  (musicEngine as any).beatCallbacks.push(cb);
  
  // Return cleanup function
  return () => {
    const callbacks = (musicEngine as any).beatCallbacks || [];
    const index = callbacks.indexOf(cb);
    if (index > -1) callbacks.splice(index, 1);
  };
}

// ─── Music Engine ─────────────────────────────────────────────────────

export class MusicEngine {
  private state: MusicState;
  private ducking: DuckingEngine;
  private beatEvents: BeatEvent[];
  private beatIndex: number;
  private listeners: Set<(state: MusicState) => void> = new Set();
  private config: MusicConfig;
  private startTime: number = 0;

  constructor(config: Partial<MusicConfig> = {}) {
    this.config = {
      baseVolume: 0.6,
      duckAmount: 0.7,
      duckRecovery: 0.5,
      beatAccuracy: 50,
      ...config,
    };

    this.state = {
      isPlaying: false,
      currentTrack: null,
      volume: this.config.baseVolume,
      duckingVolume: this.config.baseVolume,
      bpm: 120,
      beatProgress: 0,
      phase: 'interval',
      flowTier: 0,
    };

    this.ducking = new DuckingEngine({
      duckAmount: this.config.duckAmount,
      duckRecovery: this.config.duckRecovery,
      baseVolume: this.config.baseVolume,
    });

    this.beatEvents = [];
    this.beatIndex = 0;
  }

  // ─── Subscribe/Notify ────────────────────────────────────────
  subscribe(fn: (state: MusicState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    this.listeners.forEach(fn => fn({ ...this.state }));
  }

  // ─── Track Selection ─────────────────────────────────────────
  /**
   * Select track based on interval phase and flow state.
   */
  selectTrackForPhase(phase: string, flowTier: number): void {
    const tracks = MUSIC_LIBRARY[phase] || MUSIC_LIBRARY['interval'];
    
    // Prefer higher intensity tracks at higher flow tiers
    const sortedTracks = [...tracks].sort((a, b) => {
      const intensityDiff = Math.abs(a.intensity - flowTier * 0.3) - Math.abs(b.intensity - flowTier * 0.3);
      return intensityDiff;
    });

    const selected = sortedTracks[0] ?? tracks[0];
    this.playTrack(selected);
  }

  playTrack(track: MusicTrack): void {
    this.state.currentTrack = track;
    this.state.bpm = track.bpm;
    this.state.phase = track.category;
    this.beatEvents = generateBeatEvents(track.bpm, track.duration);
    this.beatIndex = 0;
    this.startTime = performance.now();
    this.state.isPlaying = true;
    this.state.flowTier = Math.floor(track.intensity * 4);
    this.notify();
  }

  /**
   * Transition to new phase's track with crossfade.
   */
  transitionToPhase(phase: string): void {
    if (!this.state.isPlaying) {
      this.selectTrackForPhase(phase, this.state.flowTier);
      return;
    }

    // Quick track switch (no crossfade for now)
    this.selectTrackForPhase(phase, this.state.flowTier);
  }

  // ─── Playback Control ────────────────────────────────────────
  pause(): void {
    this.state.isPlaying = false;
    this.notify();
  }

  resume(): void {
    this.state.isPlaying = true;
    this.startTime = performance.now() - (performance.now() - this.startTime);
    this.notify();
  }

  stop(): void {
    this.state.isPlaying = false;
    this.state.currentTrack = null;
    this.notify();
  }

  setVolume(volume: number): void {
    this.config.baseVolume = volume;
    this.ducking.setBaseVolume(volume);
    this.state.volume = volume;
    this.notify();
  }

  // ─── Beat Detection ──────────────────────────────────────────
  updateBeat(): void {
    if (!this.state.isPlaying || !this.state.currentTrack) return;

    const elapsed = performance.now() - this.startTime;
    const beat = getBeatProgress(
      this.state.bpm,
      elapsed,
    );

    this.state.beatProgress = beat.progress;
    this.state.duckingVolume = this.ducking.update(16); // ~60fps update

    // Fire beat event callbacks if needed
    this.notify();
  }

  getCurrentBeat(): { progress: number; intensity: number; isDownbeat: boolean } {
    const beat = getBeatProgress(
      this.state.bpm,
      performance.now() - this.startTime,
    );
    return {
      progress: beat.progress,
      intensity: beat.intensity,
      isDownbeat: beat.beatIndex % 4 === 0,
    };
  }

  // ─── Ducking Control ─────────────────────────────────────────
  startDucking(): void {
    this.ducking.startDucking();
    this.state.duckingVolume = this.ducking.getCurrentVolume();
    this.notify();
  }

  stopDucking(): void {
    this.ducking.stopDucking();
    this.state.duckingVolume = this.ducking.getCurrentVolume();
    this.notify();
  }

  // ─── Flow State Integration ──────────────────────────────────
  updateFlowState(flowTier: number): void {
    if (!this.state.currentTrack) return;

    // Scale music intensity with flow tier
    const intensityMultiplier = 1 + (flowTier * 0.2); // +20% per tier
    const newBpm = Math.min(160, Math.floor(this.state.bpm * (1 + flowTier * 0.02))); // +2% BPM per tier
    
    this.state.flowTier = flowTier;
    
    // Gradually increase BPM and intensity
    if (newBpm !== this.state.bpm) {
      this.state.bpm = newBpm;
      this.beatEvents = generateBeatEvents(newBpm, this.state.currentTrack.duration);
    }

    this.notify();
  }

  // ─── Get State ───────────────────────────────────────────────
  getState(): MusicState {
    return { ...this.state };
  }

  getVolume(): number {
    return this.ducking.getCurrentVolume();
  }

  // ─── Reset ───────────────────────────────────────────────────
  reset(): void {
    this.state = {
      isPlaying: false,
      currentTrack: null,
      volume: this.config.baseVolume,
      duckingVolume: this.config.baseVolume,
      bpm: 120,
      beatProgress: 0,
      phase: 'interval',
      flowTier: 0,
    };
    this.ducking = new DuckingEngine({
      duckAmount: this.config.duckAmount,
      duckRecovery: this.config.duckRecovery,
      baseVolume: this.config.baseVolume,
    });
    this.notify();
  }
}

// ─── React Hook ──────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';

export function useMusicEngine() {
  const [state, setState] = useState<MusicState>(() => {
    const engine = musicEngine;
    return engine.getState();
  });

  const musicEngineRef = useRef(musicEngine);

  useEffect(() => {
    return musicEngineRef.current.subscribe((newState) => {
      setState({ ...newState });
    });
  }, []);

  const playTrack = useCallback((track: MusicTrack) => {
    musicEngineRef.current.playTrack(track);
  }, []);

  const selectTrackForPhase = useCallback((phase: string, flowTier: number) => {
    musicEngineRef.current.selectTrackForPhase(phase, flowTier);
  }, []);

  const transitionToPhase = useCallback((phase: string) => {
    musicEngineRef.current.transitionToPhase(phase);
  }, []);

  const setVolume = useCallback((volume: number) => {
    musicEngineRef.current.setVolume(volume);
  }, []);

  const startDucking = useCallback(() => {
    musicEngineRef.current.startDucking();
  }, []);

  const stopDucking = useCallback(() => {
    musicEngineRef.current.stopDucking();
  }, []);

  const updateFlowState = useCallback((flowTier: number) => {
    musicEngineRef.current.updateFlowState(flowTier);
  }, []);

  const getCurrentBeat = useCallback(() => {
    return musicEngineRef.current.getCurrentBeat();
  }, []);

  return {
    state,
    isPlaying: state.isPlaying,
    currentTrack: state.currentTrack,
    // eslint-disable-next-line react-hooks/refs
    volume: musicEngineRef.current.getVolume(),
    // eslint-disable-next-line react-hooks/refs
    beat: getCurrentBeat(),
    playTrack,
    selectTrackForPhase,
    transitionToPhase,
    setVolume,
    startDucking,
    stopDucking,
    updateFlowState,
  };
}

// ─── Singleton Instance ──────────────────────────────────────────────

export const musicEngine = new MusicEngine({
  baseVolume: 0.5,
  duckAmount: 0.7,
  duckRecovery: 0.5,
  beatAccuracy: 50,
});