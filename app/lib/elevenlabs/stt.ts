/**
 * ElevenLabs Speech-to-Text Module - Voice commands for riders
 * 
 * Uses ElevenLabs Scribe API for high-quality transcription.
 * Enables hands-free control during workouts.
 * 
 * Core Principles:
 * - MODULAR: Self-contained speech recognition
 * - PERFORMANT: Real-time streaming
 * - ACCESSIBLE: Hands-free control for safety
 */

import { ELEVENLABS_CONFIG } from './constants';

export interface STTRequest {
  audioData: Blob | ArrayBuffer;
  language?: string;      // ISO 639-1 code (e.g., 'en', 'es')
  model?: 'scribe-v1' | 'scribe-v2';
  tagAudioEvents?: boolean; // Tag [music], [noise], etc.
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  words: TranscribedWord[];
  audioEvents?: string[];
}

export interface TranscribedWord {
  word: string;
  startTime: number;  // Seconds
  endTime: number;
  confidence: number;
}

// Voice commands for workout control
export const VOICE_COMMANDS = {
  // Pace control
  'slow down': 'decrease_pace',
  'speed up': 'increase_pace',
  'hold this pace': 'hold_pace',
  
  // Resistance
  'more resistance': 'increase_resistance',
  'less resistance': 'decrease_resistance',
  'resistance up': 'increase_resistance',
  'resistance down': 'decrease_resistance',
  
  // Emergency
  'stop': 'emergency_stop',
  'pause': 'pause_workout',
  'resume': 'resume_workout',
  
  // Information
  'what\'s my heart rate': 'show_heart_rate',
  'what\'s my power': 'show_power',
  'how much time': 'show_time',
  'how far': 'show_distance',
  
  // Motivation
  'give me motivation': 'play_motivation',
  'cheer me on': 'play_cheer',
  
  // Music
  'next song': 'next_track',
  'previous song': 'prev_track',
  'volume up': 'volume_up',
  'volume down': 'volume_down',
  'mute': 'mute',
} as const;

export type VoiceCommand = keyof typeof VOICE_COMMANDS;
export type CommandAction = typeof VOICE_COMMANDS[VoiceCommand];

export interface ParsedCommand {
  rawText: string;
  command: VoiceCommand | null;
  action: CommandAction | null;
  confidence: number;
  parameters: Record<string, string | number>;
}

/**
 * Transcribe audio using ElevenLabs Scribe
 */
export async function transcribeAudio(
  request: STTRequest
): Promise<TranscriptionResult | null> {
  if (!ELEVENLABS_CONFIG.apiKey) {
    console.warn('ElevenLabs API key not configured');
    return null;
  }

  try {
    const formData = new FormData();
    
    // Convert audio data to file
    const audioFile = request.audioData instanceof Blob 
      ? request.audioData 
      : new Blob([request.audioData], { type: 'audio/webm' });
    
    formData.append('file', audioFile, 'audio.webm');
    formData.append('model_id', request.model || 'scribe-v2');
    
    if (request.language) {
      formData.append('language_code', request.language);
    }
    
    if (request.tagAudioEvents) {
      formData.append('tag_audio_events', 'true');
    }

    const response = await fetch(
      `${ELEVENLABS_CONFIG.baseUrl}/speech-to-text`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_CONFIG.apiKey,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`STT API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    return {
      text: data.text,
      confidence: data.confidence || 0.9,
      language: data.language_code || 'en',
      words: data.words?.map((w: unknown) => ({
        word: (w as { text: string }).text,
        startTime: (w as { start: number }).start,
        endTime: (w as { end: number }).end,
        confidence: (w as { confidence: number }).confidence,
      })) || [],
      audioEvents: data.audio_events,
    };
  } catch (error) {
    console.error('Transcription failed:', error);
    return null;
  }
}

/**
 * Parse transcribed text into workout command
 */
export function parseCommand(transcription: TranscriptionResult): ParsedCommand {
  const text = transcription.text.toLowerCase().trim();
  
  // Find matching command
  let matchedCommand: VoiceCommand | null = null;
  let matchedAction: CommandAction | null = null;
  let highestConfidence = 0;
  
  for (const [command, action] of Object.entries(VOICE_COMMANDS)) {
    if (text.includes(command)) {
      // Calculate confidence based on exact match vs partial
      const confidence = text === command ? 1.0 : 0.8;
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        matchedCommand = command as VoiceCommand;
        matchedAction = action as CommandAction;
      }
    }
  }
  
  // Extract parameters (e.g., "increase resistance by 10")
  const parameters: Record<string, string | number> = {};
  
  const numberMatch = text.match(/(\d+)/);
  if (numberMatch) {
    parameters.value = parseInt(numberMatch[1], 10);
  }
  
  const percentMatch = text.match(/(\d+)%/);
  if (percentMatch) {
    parameters.percentage = parseInt(percentMatch[1], 10);
  }
  
  return {
    rawText: transcription.text,
    command: matchedCommand,
    action: matchedAction,
    confidence: highestConfidence * transcription.confidence,
    parameters,
  };
}

/**
 * Real-time transcription via WebSocket
 * For continuous voice commands during workout
 */
export class RealtimeTranscriber {
  private ws: WebSocket | null = null;
  private onTranscript: (result: TranscriptionResult) => void;
  private onError: (error: Error) => void;

  constructor(
    onTranscript: (result: TranscriptionResult) => void,
    onError: (error: Error) => void
  ) {
    this.onTranscript = onTranscript;
    this.onError = onError;
  }

  async connect(language: string = 'en'): Promise<void> {
    // Note: WebSocket endpoint may differ - check ElevenLabs docs
    const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/stream?language_code=${language}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('STT WebSocket connected');
      // Send API key for authentication
      this.ws?.send(JSON.stringify({
        api_key: ELEVENLABS_CONFIG.apiKey,
      }));
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.text) {
        this.onTranscript({
          text: data.text,
          confidence: data.confidence || 0.9,
          language: data.language_code || language,
          words: data.words || [],
        });
      }
    };
    
    this.ws.onerror = (error) => {
      this.onError(new Error('WebSocket error'));
    };
    
    this.ws.onclose = () => {
      console.log('STT WebSocket closed');
    };
  }

  sendAudio(audioChunk: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioChunk);
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}

/**
 * Check if browser supports required APIs
 */
export function isSpeechRecognitionSupported(): boolean {
  return typeof navigator !== 'undefined' && 
    !!navigator.mediaDevices?.getUserMedia && 
    typeof window !== 'undefined' && 
    !!window.WebSocket;
}

/**
 * Request microphone permission
 */
export async function requestMicrophoneAccess(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch {
    return false;
  }
}
