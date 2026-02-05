"use client";

/**
 * useCoachVoice Hook - AI coach voice synthesis
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Enhances existing coach with voice
 * - MODULAR: Self-contained voice functionality
 * - PERFORMANT: Caching, request deduplication
 * - CLEAN: Clear separation from UI
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  generateSpeech,
  COACH_VOICES,
  INTENSITY_VOICE_SETTINGS,
  isElevenLabsConfigured,
  getAudioMixer,
  VoiceSettings,
} from '../lib/elevenlabs';

export interface UseCoachVoiceOptions {
  personality?: 'zen' | 'drill' | 'data';
  intensity?: number; // 0-1, affects voice settings
}

export interface UseCoachVoiceReturn {
  speak: (text: string, emotion?: 'calm' | 'focused' | 'intense' | 'celebratory') => Promise<void>;
  isSpeaking: boolean;
  isLoading: boolean;
  error: Error | null;
  stop: () => void;
  isConfigured: boolean;
}

// Cache for generated audio (memory-efficient LRU could be added)
const audioCache = new Map<string, ArrayBuffer>();
const CACHE_SIZE_LIMIT = 50;

export function useCoachVoice(options: UseCoachVoiceOptions = {}): UseCoachVoiceReturn {
  const { personality = 'drill', intensity = 0.5 } = options;
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isConfigured] = useState(() => isElevenLabsConfigured());
  
  const currentLayerId = useRef<string | null>(null);
  const mixerRef = useRef(getAudioMixer());

  // Initialize mixer on mount
  useEffect(() => {
    const init = async () => {
      try {
        await mixerRef.current.initialize();
      } catch (err) {
        console.warn('Audio mixer init failed (needs user interaction first):', err);
      }
    };
    init();
  }, []);

  const getVoiceSettings = useCallback((emotion?: string): VoiceSettings => {
    const baseVoice = COACH_VOICES[personality];
    const intensitySettings = INTENSITY_VOICE_SETTINGS[Math.round(intensity * 10) / 10] || {};
    
    // Emotion overrides
    const emotionSettings: Partial<VoiceSettings> = {
      calm: { stability: 0.7, style: 0.1 },
      focused: { stability: 0.5, style: 0.4 },
      intense: { stability: 0.3, style: 0.8 },
      celebratory: { stability: 0.4, style: 0.9 },
    }[emotion || 'focused'] || {};
    
    return {
      ...baseVoice.defaultSettings,
      ...intensitySettings,
      ...emotionSettings,
    } as VoiceSettings;
  }, [personality, intensity]);

  const speak = useCallback(async (
    text: string,
    emotion?: 'calm' | 'focused' | 'intense' | 'celebratory'
  ) => {
    if (!isConfigured) {
      console.warn('ElevenLabs not configured');
      return;
    }

    // Stop any current speech
    stop();
    
    setIsLoading(true);
    setError(null);

    try {
      // Ensure mixer is initialized
      await mixerRef.current.resume();

      // Check cache
      const cacheKey = `${personality}:${intensity}:${emotion}:${text}`;
      let audioBuffer = audioCache.get(cacheKey);

      // Generate if not cached
      if (!audioBuffer) {
        const voice = COACH_VOICES[personality];
        audioBuffer = await generateSpeech({
          text,
          voice_id: voice.id,
          voice_settings: getVoiceSettings(emotion),
        });

        // Cache with LRU eviction
        if (audioCache.size >= CACHE_SIZE_LIMIT) {
          const firstKey = audioCache.keys().next().value;
          if (firstKey) audioCache.delete(firstKey);
        }
        audioCache.set(cacheKey, audioBuffer);
      }

      // Create and play layer
      const layerId = `voice-${Date.now()}`;
      currentLayerId.current = layerId;
      
      const layer = await mixerRef.current.createLayer(
        layerId,
        audioBuffer,
        'voice',
        10 // Highest priority
      );

      setIsSpeaking(true);
      
      // Handle completion
      if (layer.source instanceof AudioBufferSourceNode) {
        layer.source.onended = () => {
          setIsSpeaking(false);
          currentLayerId.current = null;
        };
      }

      mixerRef.current.playLayer(layerId);
      
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Speech generation failed'));
      setIsSpeaking(false);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, personality, intensity, getVoiceSettings]);

  const stop = useCallback(() => {
    if (currentLayerId.current) {
      mixerRef.current.stopLayer(currentLayerId.current);
      currentLayerId.current = null;
    }
    setIsSpeaking(false);
  }, []);

  return {
    speak,
    isSpeaking,
    isLoading,
    error,
    stop,
    isConfigured,
  };
}
