"use client";

/**
 * CoachAvatar Component - Visual representation of AI coach
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Enhances coach profile with visual
 * - MODULAR: Can be used standalone or in profile
 * - PERFORMANT: CSS animations, no heavy libraries
 * - CLEAN: Props-driven state
 */

import { useMemo } from 'react';
import { EMOTION_CONFIG } from '../../lib/elevenlabs';

export interface CoachAvatarProps {
  name: string;
  emotion?: 'calm' | 'focused' | 'intense' | 'celebratory';
  isSpeaking?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  avatarUrl?: string | null;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
};

const RING_SIZE = {
  sm: 'border-2',
  md: 'border-2',
  lg: 'border-3',
  xl: 'border-4',
};

export function CoachAvatar({
  name,
  emotion = 'focused',
  isSpeaking = false,
  size = 'md',
  avatarUrl,
  className = '',
}: CoachAvatarProps) {
  const config = EMOTION_CONFIG[emotion];
  
  const initials = useMemo(() => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [name]);

  const animationClass = useMemo(() => {
    if (!isSpeaking) return '';
    
    switch (config.animation) {
      case 'breathing':
        return 'animate-pulse';
      case 'pulsing':
        return 'animate-bounce';
      case 'energetic':
        return 'animate-ping';
      default:
        return '';
    }
  }, [isSpeaking, config.animation]);

  return (
    <div className={`relative ${className}`}>
      {/* Outer ring - intensity indicator */}
      <div
        className={`
          absolute inset-0 rounded-full ${RING_SIZE[size]}
          transition-all duration-500
          ${isSpeaking ? 'scale-110 opacity-100' : 'scale-100 opacity-50'}
        `}
        style={{
          borderColor: config.colorTint,
          boxShadow: isSpeaking ? `0 0 20px ${config.colorTint}40` : 'none',
        }}
      />
      
      {/* Speaking indicator ring */}
      {isSpeaking && (
        <div
          className={`
            absolute inset-0 rounded-full border-2
            ${animationClass}
          `}
          style={{
            borderColor: config.colorTint,
            animationDuration: '1.5s',
          }}
        />
      )}
      
      {/* Avatar image or initials */}
      <div
        className={`
          ${SIZE_CLASSES[size]}
          relative rounded-full overflow-hidden
          bg-gradient-to-br from-indigo-600 to-purple-600
          flex items-center justify-center
        `}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to initials on error
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span className="text-white font-bold text-lg">
            {initials}
          </span>
        )}
        
        {/* Speaking overlay */}
        {isSpeaking && (
          <div
            className="absolute inset-0 bg-white/20 animate-pulse"
            style={{ animationDuration: '0.5s' }}
          />
        )}
      </div>
      
      {/* Status dot */}
      <div
        className={`
          absolute bottom-0 right-0
          w-3 h-3 rounded-full
          border-2 border-black
          ${isSpeaking ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}
        `}
      />
      
      {/* Emotion label (optional, for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <span
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-wider text-white/40"
        >
          {emotion}
        </span>
      )}
    </div>
  );
}

export default CoachAvatar;
