"use client";

import { useEffect, useRef } from "react";
import type { IntervalPhase } from "@/app/lib/workout-plan";

/**
 * useIntervalAudioCues — Plays distinct beeps on interval phase changes.
 *
 * Tones:
 * - sprint: high double-beep (exciting)
 * - interval: mid single beep (attention)
 * - recovery/cooldown: low soft beep (relief)
 * - warmup: gentle rising tone (start)
 *
 * Uses shared AudioContext from use-ui-click-sound pattern.
 * Respects prefers-reduced-motion (silenced for accessibility).
 */

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    try {
      sharedCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return sharedCtx;
}

function playTone(freq: number, duration: number, delay: number = 0, type: OscillatorType = "sine") {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  const peakGain = 0.12;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peakGain, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

export function useIntervalAudioCues(phase: IntervalPhase | null, isActive: boolean) {
  const lastPhaseRef = useRef<IntervalPhase | null>(null);
  const enabledRef = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    enabledRef.current = !mq.matches;
    const handler = (e: MediaQueryListEvent) => { enabledRef.current = !e.matches; };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!isActive || !enabledRef.current) return;
    if (!phase || phase === lastPhaseRef.current) return;

    // Skip the very first phase (ride start) — let the countdown handle it
    if (lastPhaseRef.current === null) {
      lastPhaseRef.current = phase;
      return;
    }

    switch (phase) {
      case "sprint":
        // High double-beep
        playTone(880, 0.12, 0, "square");
        playTone(1100, 0.12, 0.14, "square");
        break;
      case "interval":
        // Mid single beep
        playTone(660, 0.15, 0, "sine");
        break;
      case "recovery":
      case "cooldown":
        // Low soft beep
        playTone(330, 0.2, 0, "sine");
        break;
      case "warmup":
        // Gentle rising tone
        playTone(440, 0.1, 0, "sine");
        playTone(550, 0.1, 0.1, "sine");
        break;
    }

    lastPhaseRef.current = phase;
  }, [phase, isActive]);

  // Reset when ride ends
  useEffect(() => {
    if (!isActive) {
      lastPhaseRef.current = null;
    }
  }, [isActive]);
}
