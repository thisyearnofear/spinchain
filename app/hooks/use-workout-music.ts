"use client";

/**
 * useWorkoutMusic Hook - AI-generated workout soundtracks
 * 
 * Core Principles:
 * - MODULAR: Self-contained music management
 * - PERFORMANT: Preloading, seamless transitions
 * - ADAPTIVE: Music adapts to workout intensity
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  generateWorkoutMusic,
  generatePhaseMusic,
  WorkoutSoundtrack,
  WorkoutPhase,
  MusicSegment,
} from '../lib/elevenlabs/music';
import { getAudioMixer } from '../lib/elevenlabs';

interface UseWorkoutMusicOptions {
  autoPlay?: boolean;
  volume?: number;
}

export interface UseWorkoutMusicReturn {
  currentTrack: WorkoutSoundtrack | null;
  isPlaying: boolean;
  isGenerating: boolean;
  currentSegment: MusicSegment | null;
  progress: number; // 0-1
  play: () => void;
  pause: () => void;
  stop: () => void;
  generateForPhase: (phase: WorkoutPhase) => Promise<void>;
  setVolume: (volume: number) => void;
  skipToSegment: (segmentIndex: number) => void;
}

export function useWorkoutMusic(options: UseWorkoutMusicOptions = {}): UseWorkoutMusicReturn {
  const { autoPlay = false, volume = 0.5 } = options;
  
  const [currentTrack, setCurrentTrack] = useState<WorkoutSoundtrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSegment, setCurrentSegment] = useState<MusicSegment | null>(null);
  const [progress, setProgress] = useState(0);
  
  const mixerRef = useRef(getAudioMixer());
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize mixer
  useEffect(() => {
    mixerRef.current.initialize();
  }, []);

  // Update progress
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const updateProgress = () => {
      if (audioElementRef.current && currentTrack) {
        const current = audioElementRef.current.currentTime;
        const duration = currentTrack.duration;
        const newProgress = current / duration;
        setProgress(newProgress);
        
        // Update current segment
        const segment = currentTrack.segments.find(
          s => current >= s.startTime && current < s.endTime
        );
        if (segment) {
          setCurrentSegment(segment);
        }
      }
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTrack]);

  const generateForPhase = useCallback(async (phase: WorkoutPhase) => {
    setIsGenerating(true);
    
    try {
      const track = await generatePhaseMusic(phase);
      if (track) {
        setCurrentTrack(track);
        setProgress(0);
        
        if (autoPlay) {
          play();
        }
      }
    } finally {
      setIsGenerating(false);
    }
  }, [autoPlay]);

  const play = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.play();
    }
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    if (audioElementRef.current) {
      audioElementRef.current.volume = Math.max(0, Math.min(1, newVolume));
    }
    mixerRef.current.setMasterVolume(newVolume);
  }, []);

  const skipToSegment = useCallback((segmentIndex: number) => {
    if (currentTrack?.segments[segmentIndex]) {
      const segment = currentTrack.segments[segmentIndex];
      if (audioElementRef.current) {
        audioElementRef.current.currentTime = segment.startTime;
      }
    }
  }, [currentTrack]);

  return {
    currentTrack,
    isPlaying,
    isGenerating,
    currentSegment,
    progress,
    play,
    pause,
    stop,
    generateForPhase,
    setVolume,
    skipToSegment,
  };
}
