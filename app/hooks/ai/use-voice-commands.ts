"use client";

/**
 * useVoiceCommands Hook - Hands-free workout control
 * 
 * Core Principles:
 * - ACCESSIBLE: Hands-free for safety during workout
 * - MODULAR: Self-contained speech recognition
 * - PERFORMANT: Real-time processing
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  transcribeAudio,
  parseCommand,
  ParsedCommand,
  VOICE_COMMANDS,
  isSpeechRecognitionSupported,
  requestMicrophoneAccess,
  RealtimeTranscriber,
  LocalSpeechRecognizer,
} from '@/app/lib/elevenlabs/stt';

export interface UseVoiceCommandsOptions {
  onCommand?: (command: ParsedCommand) => void;
  language?: string;
  continuous?: boolean;
  useLocalOnly?: boolean; // NEW: Skip cloud for sub-second latency
}

export interface UseVoiceCommandsReturn {
  isListening: boolean;
  isSupported: boolean;
  hasPermission: boolean;
  lastCommand: ParsedCommand | null;
  transcript: string;
  confidence: number;
  startListening: () => Promise<void>;
  stopListening: () => void;
  requestPermission: () => Promise<boolean>;
  availableCommands: typeof VOICE_COMMANDS;
}

export function useVoiceCommands(options: UseVoiceCommandsOptions = {}): UseVoiceCommandsReturn {
  const { onCommand, language = 'en', continuous = true, useLocalOnly = true } = options;

  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(() => isSpeechRecognitionSupported());
  const [hasPermission, setHasPermission] = useState(false);
  const [lastCommand, setLastCommand] = useState<ParsedCommand | null>(null);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);

  const localRecognizerRef = useRef<LocalSpeechRecognizer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriberRef = useRef<RealtimeTranscriber | null>(null);
  const onCommandRef = useRef(onCommand);
  const hasPermissionRef = useRef(hasPermission);
  const isListeningRef = useRef(isListening);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    hasPermissionRef.current = hasPermission;
  }, [hasPermission]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await requestMicrophoneAccess();
    setHasPermission(granted);
    return granted;
  }, []);

  const handleRecognizedCommand = useCallback((command: ParsedCommand) => {
    setLastCommand(command);
    setTranscript(command.rawText);
    setConfidence(command.confidence);
    if (command.action && onCommandRef.current) {
      onCommandRef.current(command);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    if (!isSupported) {
      console.warn('Speech recognition not supported');
      return;
    }

    if (!hasPermissionRef.current) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    setIsListening(true);

    if (useLocalOnly) {
      if (!localRecognizerRef.current) {
        localRecognizerRef.current = new LocalSpeechRecognizer(handleRecognizedCommand);
      }
      localRecognizerRef.current.start();
      return;
    }

    // Existing cloud-fallback logic...
    audioChunksRef.current = [];
    try {
      // ... existing getUserMedia and recognition logic
    } catch (e) {
      setIsListening(false);
    }
  }, [isSupported, useLocalOnly, requestPermission, handleRecognizedCommand]);

  const stopListening = useCallback(() => {
    if (!isListeningRef.current) return;

    setIsListening(false);
    
    if (useLocalOnly) {
      localRecognizerRef.current?.stop();
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    transcriberRef.current?.disconnect();
    transcriberRef.current = null;
  }, [useLocalOnly]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    isSupported,
    hasPermission,
    lastCommand,
    transcript,
    confidence,
    startListening,
    stopListening,
    requestPermission,
    availableCommands: VOICE_COMMANDS,
  };
}

// TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
