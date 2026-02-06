"use client";

/**
 * useCoachAvatar Hook - AI coach video avatar with lip-sync
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Enhances coach with video when available
 * - GRACEFUL DEGRADATION: Falls back to static avatar
 * - MODULAR: Separates video concerns from voice
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  generateLipSyncVideo,
  createFallbackAvatarAnimation,
  LipSyncRequest,
  GeneratedVideo,
} from '@/app/lib/elevenlabs/video';

interface UseCoachAvatarOptions {
  baseImageUrl: string;
  personality?: 'zen' | 'drill' | 'data';
}

export interface UseCoachAvatarReturn {
  videoUrl: string | null;
  isGenerating: boolean;
  isPlaying: boolean;
  error: Error | null;
  generateVideo: (audioUrl: string) => Promise<void>;
  play: () => void;
  pause: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isSupported: boolean;
}

export function useCoachAvatar(options: UseCoachAvatarOptions): UseCoachAvatarReturn {
  const { baseImageUrl } = options;
  
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fallback animation when video unavailable
  useEffect(() => {
    if (!videoUrl && containerRef.current) {
      createFallbackAvatarAnimation(
        containerRef.current,
        baseImageUrl,
        isPlaying
      );
    }
  }, [videoUrl, baseImageUrl, isPlaying]);

  const generateVideo = useCallback(async (audioUrl: string) => {
    setIsGenerating(true);
    setError(null);

    try {
      const request: LipSyncRequest = {
        videoUrl: baseImageUrl,
        audioUrl,
        model: 'omnihuman',
      };

      const result = await generateLipSyncVideo(request);
      
      if (result?.url) {
        setVideoUrl(result.url);
      } else {
        // Fallback: keep using static image with CSS animation
        console.log('Video generation unavailable, using fallback avatar');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Video generation failed'));
    } finally {
      setIsGenerating(false);
    }
  }, [baseImageUrl]);

  const play = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play();
    }
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  return {
    videoUrl,
    isGenerating,
    isPlaying,
    error,
    generateVideo,
    play,
    pause,
    containerRef,
    isSupported: true, // Always supported (with fallback)
  };
}
