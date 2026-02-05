/**
 * ElevenLabs Video/Avatar Module
 * 
 * Note: Advanced video features (LipSync, OmniHuman) require Studio API access.
 * This module provides the architecture and fallbacks for when API is available.
 * 
 * Core Principles:
 * - MODULAR: Swappable implementations
 * - GRACEFUL DEGRADATION: Falls back to static avatar if video unavailable
 * - FUTURE-PROOF: Architecture ready for when API access is granted
 */

import { ELEVENLABS_CONFIG } from './constants';

export interface LipSyncRequest {
  videoUrl: string;      // Input video or image
  audioUrl: string;      // Audio to lip-sync
  model?: 'omnihuman' | 'veed';
}

export interface VideoGenerationRequest {
  prompt: string;
  imageUrl?: string;     // Starting frame
  duration?: 4 | 6 | 8 | 10 | 12;
  resolution?: '720p' | '1080p';
  aspectRatio?: '16:9' | '9:16' | '1:1';
  model?: 'sora-2' | 'veo-3' | 'kling-2.5' | 'wan-2.5';
}

export interface GeneratedVideo {
  url: string;
  thumbnailUrl: string;
  duration: number;
  status: 'pending' | 'completed' | 'failed';
}

// Check if Studio API is available (requires contacting sales)
function isStudioApiAvailable(): boolean {
  // Studio API requires special access
  // For now, return false - implement when access granted
  return false;
}

/**
 * Generate lip-synced video from image/audio
 * Requires Studio API access
 */
export async function generateLipSyncVideo(
  request: LipSyncRequest
): Promise<GeneratedVideo | null> {
  if (!isStudioApiAvailable()) {
    console.warn('Studio API not available. Contact ElevenLabs sales for access.');
    return null;
  }

  try {
    const response = await fetch(
      `${ELEVENLABS_CONFIG.baseUrl}/studio/lipsync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_CONFIG.apiKey,
        },
        body: JSON.stringify({
          video_url: request.videoUrl,
          audio_url: request.audioUrl,
          model: request.model || 'omnihuman',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`LipSync API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      url: data.video_url,
      thumbnailUrl: data.thumbnail_url,
      duration: data.duration,
      status: data.status,
    };
  } catch (error) {
    console.error('LipSync generation failed:', error);
    return null;
  }
}

/**
 * Generate video from text/image
 * Requires Studio API access
 */
export async function generateVideo(
  request: VideoGenerationRequest
): Promise<GeneratedVideo | null> {
  if (!isStudioApiAvailable()) {
    console.warn('Studio API not available. Contact ElevenLabs sales for access.');
    return null;
  }

  try {
    const response = await fetch(
      `${ELEVENLABS_CONFIG.baseUrl}/studio/video`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_CONFIG.apiKey,
        },
        body: JSON.stringify({
          prompt: request.prompt,
          image_url: request.imageUrl,
          duration: request.duration || 4,
          resolution: request.resolution || '720p',
          aspect_ratio: request.aspectRatio || '16:9',
          model: request.model || 'veo-3',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Video generation API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      url: data.video_url,
      thumbnailUrl: data.thumbnail_url,
      duration: data.duration,
      status: data.status,
    };
  } catch (error) {
    console.error('Video generation failed:', error);
    return null;
  }
}

/**
 * Fallback: Create animated avatar using CSS/WebGL
 * Works without Studio API
 */
export function createFallbackAvatarAnimation(
  containerElement: HTMLElement,
  imageUrl: string,
  isSpeaking: boolean
): void {
  // Apply CSS animations for speaking effect
  containerElement.style.backgroundImage = `url(${imageUrl})`;
  containerElement.style.backgroundSize = 'cover';
  containerElement.style.backgroundPosition = 'center';
  
  if (isSpeaking) {
    containerElement.classList.add('coach-avatar-speaking');
    // Add pulsing border effect
    containerElement.style.boxShadow = `0 0 20px rgba(99, 102, 241, 0.5)`;
    containerElement.style.animation = 'pulse 1s ease-in-out infinite';
  } else {
    containerElement.classList.remove('coach-avatar-speaking');
    containerElement.style.boxShadow = 'none';
    containerElement.style.animation = 'none';
  }
}

// CSS keyframes for fallback animation
export const FALLBACK_AVATAR_CSS = `
@keyframes coach-avatar-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

@keyframes coach-avatar-glow {
  0%, 100% { box-shadow: 0 0 10px rgba(99, 102, 241, 0.3); }
  50% { box-shadow: 0 0 30px rgba(99, 102, 241, 0.6); }
}

.coach-avatar-speaking {
  animation: coach-avatar-pulse 1s ease-in-out infinite,
             coach-avatar-glow 1.5s ease-in-out infinite;
}
`;
