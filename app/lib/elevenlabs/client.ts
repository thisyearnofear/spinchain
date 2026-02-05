/**
 * ElevenLabs Client - Unified API client
 * 
 * Core Principles:
 * - DRY: Single client for all ElevenLabs APIs
 * - MODULAR: Separate methods for TTS, SFX, Avatar
 * - PERFORMANT: Streaming support, request deduplication
 */

import { ELEVENLABS_CONFIG } from './constants';
import { TTSRequest, SoundEffectRequest, AvatarVideoRequest } from './types';

// Simple in-memory request deduplication
const pendingRequests = new Map<string, Promise<ArrayBuffer>>();

function getRequestKey(type: string, params: unknown): string {
  return `${type}:${JSON.stringify(params)}`;
}

/**
 * Generate speech from text (TTS)
 */
export async function generateSpeech(request: TTSRequest): Promise<ArrayBuffer> {
  const key = getRequestKey('tts', request);
  
  // Return pending request if exists (deduplication)
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }
  
  const promise = fetch(
    `${ELEVENLABS_CONFIG.baseUrl}/text-to-speech/${request.voice_id}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_CONFIG.apiKey,
      },
      body: JSON.stringify({
        text: request.text,
        model_id: request.model_id || ELEVENLABS_CONFIG.defaultModel,
        voice_settings: request.voice_settings,
        optimize_streaming_latency: request.optimize_streaming_latency ?? ELEVENLABS_CONFIG.streamingLatency,
      }),
    }
  ).then(async (response) => {
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs TTS error: ${response.status} - ${error}`);
    }
    return response.arrayBuffer();
  }).finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Generate speech with streaming (for real-time)
 */
export async function* generateSpeechStream(request: TTSRequest): AsyncGenerator<Uint8Array> {
  const response = await fetch(
    `${ELEVENLABS_CONFIG.baseUrl}/text-to-speech/${request.voice_id}/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_CONFIG.apiKey,
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: request.text,
        model_id: request.model_id || ELEVENLABS_CONFIG.defaultModel,
        voice_settings: request.voice_settings,
        optimize_streaming_latency: 0, // Max speed for streaming
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs TTS stream error: ${response.status} - ${error}`);
  }
  
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield value;
  }
}

/**
 * Generate sound effect
 */
export async function generateSoundEffect(request: SoundEffectRequest): Promise<ArrayBuffer> {
  const key = getRequestKey('sfx', request);
  
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }
  
  const promise = fetch(
    `${ELEVENLABS_CONFIG.baseUrl}/sound-generation`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_CONFIG.apiKey,
      },
      body: JSON.stringify({
        text: request.text,
        duration_seconds: request.duration_seconds ?? 2,
        prompt_influence: request.prompt_influence ?? 0.7,
      }),
    }
  ).then(async (response) => {
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs SFX error: ${response.status} - ${error}`);
    }
    return response.arrayBuffer();
  }).finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Generate avatar video (if API available)
 * Note: This is a placeholder - check ElevenLabs docs for actual endpoint
 */
export async function generateAvatarVideo(request: AvatarVideoRequest): Promise<string> {
  // Placeholder - implement based on actual ElevenLabs API
  // May need to use alternative service like D-ID, HeyGen, or Sync Labs
  console.warn('Avatar video generation not yet implemented');
  return request.image_url; // Fallback to static image
}

/**
 * Get available voices
 */
export async function getVoices(): Promise<Array<{
  voice_id: string;
  name: string;
  preview_url: string;
  category: string;
}>> {
  const response = await fetch(`${ELEVENLABS_CONFIG.baseUrl}/voices`, {
    headers: {
      'xi-api-key': ELEVENLABS_CONFIG.apiKey,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }
  
  const data = await response.json();
  return data.voices;
}

/**
 * Check if API key is configured
 */
export function isElevenLabsConfigured(): boolean {
  return !!ELEVENLABS_CONFIG.apiKey && ELEVENLABS_CONFIG.apiKey.length > 0;
}
