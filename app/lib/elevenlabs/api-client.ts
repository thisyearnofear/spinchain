/**
 * ElevenLabs Client-Side API Client
 * 
 * Calls server-side API routes to keep API keys secure.
 * Replaces direct ElevenLabs API calls in browser.
 */

import { VoiceSettings } from './types';

const API_BASE = '/api/ai/elevenlabs';

/**
 * Generate text-to-speech audio
 */
export async function generateTTS(
  text: string,
  voiceId: string,
  voiceSettings?: VoiceSettings,
  modelId?: string
): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        voice_settings: voiceSettings,
        model_id: modelId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('TTS generation failed:', error);
      return null;
    }

    return response.arrayBuffer();
  } catch (error) {
    console.error('TTS generation error:', error);
    return null;
  }
}

/**
 * Generate sound effect
 */
export async function generateSFX(
  text: string,
  durationSeconds?: number,
  promptInfluence?: number
): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(`${API_BASE}/sfx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        duration_seconds: durationSeconds,
        prompt_influence: promptInfluence,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('SFX generation failed:', error);
      return null;
    }

    return response.arrayBuffer();
  } catch (error) {
    console.error('SFX generation error:', error);
    return null;
  }
}

/**
 * Transcribe audio to text
 */
export async function transcribeAudio(
  audioBlob: Blob,
  modelId: string = 'scribe_v1'
): Promise<{ text: string; language?: string } | null> {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('model_id', modelId);

    const response = await fetch(`${API_BASE}/stt`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Transcription failed:', error);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Transcription error:', error);
    return null;
  }
}

/**
 * Get available voices
 */
export async function getVoices(): Promise<{ voices: Array<{ voice_id: string; name: string }> } | null> {
  try {
    const response = await fetch(`${API_BASE}/voices`);
    
    if (!response.ok) {
      console.error('Failed to fetch voices');
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Fetch voices error:', error);
    return null;
  }
}

/**
 * Check if ElevenLabs is configured
 */
export async function isElevenLabsConfigured(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/tts`);
    const data = await response.json();
    return data.status === 'ready';
  } catch {
    return false;
  }
}

// Re-export types
export type { VoiceSettings };
