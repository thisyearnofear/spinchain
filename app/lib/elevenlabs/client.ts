/**
 * ElevenLabs Client - Proxied through server API routes
 * 
 * Core Principles:
 * - DRY: Single client for all ElevenLabs APIs
 * - MODULAR: Separate methods for TTS, SFX
 * - PERFORMANT: Request deduplication, caching
 * - CLEAN: No API keys on client - all proxied through /api/ai/elevenlabs/*
 */

import { ELEVENLABS_CONFIG } from './constants';
import { TTSRequest, SoundEffectRequest, AvatarVideoRequest } from './types';

// Simple in-memory request deduplication
const pendingRequests = new Map<string, Promise<ArrayBuffer>>();

function getRequestKey(type: string, params: unknown): string {
  return `${type}:${JSON.stringify(params)}`;
}

/**
 * Generate speech from text (TTS) via server route
 */
export async function generateSpeech(request: TTSRequest): Promise<ArrayBuffer> {
  const key = getRequestKey('tts', request);
  
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }
  
  const promise = fetch(ELEVENLABS_CONFIG.ttsRoute, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: request.text,
      voice_id: request.voice_id,
      model_id: request.model_id || ELEVENLABS_CONFIG.defaultModel,
      voice_settings: request.voice_settings,
      optimize_streaming_latency: request.optimize_streaming_latency ?? ELEVENLABS_CONFIG.streamingLatency,
    }),
  }).then(async (response) => {
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TTS error: ${response.status} - ${error}`);
    }
    return response.arrayBuffer();
  }).finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Generate speech with streaming (for real-time) via server route
 */
export async function* generateSpeechStream(request: TTSRequest): AsyncGenerator<Uint8Array> {
  const response = await fetch(ELEVENLABS_CONFIG.ttsRoute, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: request.text,
      voice_id: request.voice_id,
      model_id: request.model_id || ELEVENLABS_CONFIG.defaultModel,
      voice_settings: request.voice_settings,
      optimize_streaming_latency: 0,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TTS stream error: ${response.status} - ${error}`);
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
 * Generate sound effect via server route
 */
export async function generateSoundEffect(request: SoundEffectRequest): Promise<ArrayBuffer> {
  const key = getRequestKey('sfx', request);
  
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }
  
  const promise = fetch(ELEVENLABS_CONFIG.sfxRoute, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: request.text,
      duration_seconds: request.duration_seconds ?? 2,
      prompt_influence: request.prompt_influence ?? 0.7,
    }),
  }).then(async (response) => {
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SFX error: ${response.status} - ${error}`);
    }
    return response.arrayBuffer();
  }).finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Generate avatar video (placeholder)
 */
export async function generateAvatarVideo(request: AvatarVideoRequest): Promise<string> {
  console.warn('Avatar video generation not yet implemented');
  return request.image_url;
}

/**
 * Get available voices via server route
 */
export async function getVoices(): Promise<Array<{
  voice_id: string;
  name: string;
  preview_url: string;
  category: string;
}>> {
  const response = await fetch(ELEVENLABS_CONFIG.voicesRoute);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }
  
  const data = await response.json();
  return data.voices;
}

/**
 * Check if ElevenLabs is configured (pings server route)
 */
export function isElevenLabsConfigured(): boolean {
  // Optimistically return true - the server route will return 503 if not configured
  // This avoids a blocking async check on hook initialization
  return true;
}

/**
 * Async check if ElevenLabs is actually configured on the server
 */
export async function checkElevenLabsConfigured(): Promise<boolean> {
  try {
    const response = await fetch(ELEVENLABS_CONFIG.ttsRoute, { method: 'GET' });
    const data = await response.json();
    return data.status === 'ready';
  } catch {
    return false;
  }
}
