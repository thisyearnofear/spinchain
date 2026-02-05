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
} from '../lib/elevenlabs/stt';

export interface UseVoiceCommandsOptions {
  onCommand?: (command: ParsedCommand) => void;
  language?: string;
  continuous?: boolean;
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
  const { onCommand, language = 'en', continuous = true } = options;
  
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [lastCommand, setLastCommand] = useState<ParsedCommand | null>(null);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriberRef = useRef<RealtimeTranscriber | null>(null);

  // Check support on mount
  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await requestMicrophoneAccess();
    setHasPermission(granted);
    return granted;
  }, []);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const result = await transcribeAudio({
        audioData: arrayBuffer,
        language,
      });
      
      if (result) {
        setTranscript(result.text);
        setConfidence(result.confidence);
        
        const command = parseCommand(result);
        setLastCommand(command);
        
        if (command.action && onCommand) {
          onCommand(command);
        }
      }
    } catch (error) {
      console.error('Voice processing failed:', error);
    }
  }, [language, onCommand]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      console.warn('Speech recognition not supported');
      return;
    }

    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    setIsListening(true);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use Web Speech API as fallback if ElevenLabs fails
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = continuous;
        recognition.interimResults = true;
        recognition.lang = language;
        
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const results = event.results;
          if (results.length > 0) {
            const lastResult = results[results.length - 1];
            const text = lastResult[0].transcript;
            setTranscript(text);
            
            if (lastResult.isFinal) {
              const command = parseCommand({
                text,
                confidence: lastResult[0].confidence,
                language,
                words: [],
              });
              setLastCommand(command);
              
              if (command.action && onCommand) {
                onCommand(command);
              }
            }
          }
        };
        
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };
        
        recognition.onend = () => {
          if (continuous && isListening) {
            recognition.start();
          } else {
            setIsListening(false);
          }
        };
        
        recognition.start();
        
        // Store stop function
        mediaRecorderRef.current = {
          stop: () => recognition.stop(),
        } as MediaRecorder;
        
      } else {
        // Fallback to MediaRecorder + ElevenLabs
        const mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await processAudio(audioBlob);
          
          if (continuous && isListening) {
            // Restart recording
            audioChunksRef.current = [];
            mediaRecorder.start();
            setTimeout(() => mediaRecorder.stop(), 5000); // 5-second chunks
          }
        };
        
        mediaRecorder.start();
        setTimeout(() => mediaRecorder.stop(), 5000);
        
        mediaRecorderRef.current = mediaRecorder;
      }
    } catch (error) {
      console.error('Failed to start listening:', error);
      setIsListening(false);
    }
  }, [isSupported, hasPermission, continuous, language, onCommand, processAudio, requestPermission]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    transcriberRef.current?.disconnect();
    transcriberRef.current = null;
  }, []);

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
