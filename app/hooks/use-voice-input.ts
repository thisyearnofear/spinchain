/**
 * Voice Input Hook
 * Provides hands-free route description using Web Speech API
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type VoiceInputState = {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
};

type UseVoiceInputOptions = {
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
  onResult?: (transcript: string) => void;
  onEnd?: () => void;
};

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const {
    continuous = false,
    interimResults = true,
    language = "en-US",
    onResult,
    onEnd,
  } = options;

  const [state, setState] = useState<VoiceInputState>({
    isListening: false,
    isSupported: false,
    transcript: "",
    interimTranscript: "",
    error: null,
  });

  const recognitionRef = useRef<any>(null);

  // Check for browser support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        setState((prev) => ({ ...prev, isSupported: true }));
      }
    }
  }, []);

  // Initialize recognition
  useEffect(() => {
    if (!state.isSupported || typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      setState((prev) => ({
        ...prev,
        transcript: prev.transcript + finalTranscript,
        interimTranscript,
      }));

      if (finalTranscript && onResult) {
        onResult(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      
      let errorMessage = "Voice input error";
      switch (event.error) {
        case "no-speech":
          errorMessage = "No speech detected. Please try again.";
          break;
        case "audio-capture":
          errorMessage = "Microphone not found or not accessible.";
          break;
        case "not-allowed":
          errorMessage = "Microphone permission denied.";
          break;
        case "network":
          errorMessage = "Network error. Check your connection.";
          break;
        default:
          errorMessage = `Voice input error: ${event.error}`;
      }

      setState((prev) => ({
        ...prev,
        isListening: false,
        error: errorMessage,
      }));
    };

    recognition.onend = () => {
      setState((prev) => ({ ...prev, isListening: false }));
      if (onEnd) onEnd();
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [state.isSupported, continuous, interimResults, language, onResult, onEnd]);

  /**
   * Start listening
   */
  const startListening = useCallback(() => {
    if (!recognitionRef.current || state.isListening) return;

    setState((prev) => ({
      ...prev,
      isListening: true,
      error: null,
      transcript: "",
      interimTranscript: "",
    }));

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error("Failed to start recognition:", error);
      setState((prev) => ({
        ...prev,
        isListening: false,
        error: "Failed to start voice input",
      }));
    }
  }, [state.isListening]);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !state.isListening) return;

    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error("Failed to stop recognition:", error);
    }
  }, [state.isListening]);

  /**
   * Toggle listening state
   */
  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  /**
   * Clear transcript
   */
  const clearTranscript = useCallback(() => {
    setState((prev) => ({
      ...prev,
      transcript: "",
      interimTranscript: "",
    }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
  };
}

// Type augmentation for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
