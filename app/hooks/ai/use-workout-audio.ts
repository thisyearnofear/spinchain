"use client";

/**
 * useWorkoutAudio Hook - Workout sound effects and audio environment
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Enhances workout experience with audio cues
 * - MODULAR: Separate from voice, can be used independently
 * - PERFORMANT: Preloading, caching
 * - CLEAN: Clear event-to-sound mapping
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  generateSoundEffect,
  WORKOUT_SOUNDS,
  SOUND_DURATIONS,
  isElevenLabsConfigured,
  getAudioMixer,
  WorkoutSoundType,
  AUDIO_PRIORITIES,
} from '@/app/lib/elevenlabs';

export interface UseWorkoutAudioReturn {
  playSound: (type: WorkoutSoundType) => Promise<void>;
  playCountdown: (seconds: number) => void;
  stopAll: () => void;
  isPlaying: boolean;
  isConfigured: boolean;
  preloadSounds: (types: WorkoutSoundType[]) => Promise<void>;
}

// Preloaded sounds cache
const preloadedSounds = new Map<WorkoutSoundType, ArrayBuffer>();

export function useWorkoutAudio(): UseWorkoutAudioReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isConfigured] = useState(() => isElevenLabsConfigured());
  
  const mixerRef = useRef(getAudioMixer());
  const activeLayers = useRef<Set<string>>(new Set());
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize mixer
  useEffect(() => {
    const init = async () => {
      try {
        await mixerRef.current.initialize();
      } catch (err) {
        console.warn('Audio mixer init failed:', err);
      }
    };
    init();
    
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  const playSound = useCallback(async (type: WorkoutSoundType) => {
    if (!isConfigured) return;

    try {
      await mixerRef.current.resume();

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
      activeLayers.current.add(layerId);
      setIsPlaying(true);

      const layer = await mixerRef.current.createLayer(
        layerId,
        audioBuffer,
        'sfx',
        AUDIO_PRIORITIES.sfx
      );

      // Cleanup on end
      if (layer.source instanceof AudioBufferSourceNode) {
        layer.source.onended = () => {
          activeLayers.current.delete(layerId);
          if (activeLayers.current.size === 0) {
            setIsPlaying(false);
          }
        };
      }

      mixerRef.current.playLayer(layerId);
      
    } catch (err) {
      console.error('Failed to play sound:', err);
    }
  }, [isConfigured]);

  const playCountdown = useCallback((seconds: number = 3) => {
    if (!isConfigured || seconds <= 0) return;

    let remaining = seconds;
    
    // Play first beep immediately
    playSound('countdown');
    remaining--;

    // Schedule remaining beeps
    countdownInterval.current = setInterval(() => {
      if (remaining > 0) {
        playSound('countdown');
        remaining--;
      } else {
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
          countdownInterval.current = null;
        }
      }
    }, 1000);
  }, [isConfigured, playSound]);

  const stopAll = useCallback(() => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    
    mixerRef.current.stopAll();
    activeLayers.current.clear();
    setIsPlaying(false);
  }, []);

  const preloadSounds = useCallback(async (types: WorkoutSoundType[]) => {
    if (!isConfigured) return;

    const promises = types.map(async (type) => {
      if (preloadedSounds.has(type)) return;
      
      try {
        const buffer = await generateSoundEffect({
          text: WORKOUT_SOUNDS[type],
          duration_seconds: SOUND_DURATIONS[type],
        });
        preloadedSounds.set(type, buffer);
      } catch (err) {
        console.warn(`Failed to preload sound: ${type}`, err);
      }
    });

    await Promise.all(promises);
  }, [isConfigured]);

  return {
    playSound,
    playCountdown,
    stopAll,
    isPlaying: isPlaying || activeLayers.current.size > 0,
    isConfigured,
    preloadSounds,
  };
}
