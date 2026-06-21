"use client";

import { useCallback, useRef, useEffect } from "react";

/**
 * useUIClickSound — Subtle synthesized UI click sounds via Web Audio API.
 *
 * No external assets or API calls. Generates a short percussive click
 * using an oscillator + gain envelope. Respects prefers-reduced-motion
 * (also silences sound for accessibility).
 *
 * Usage:
 *   const click = useUIClickSound();
 *   <button onClick={click}>...</button>
 */

type ClickVariant = "default" | "success" | "error";

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

export function useUIClickSound() {
  const enabledRef = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    enabledRef.current = !mq.matches;

    const handler = (e: MediaQueryListEvent) => {
      enabledRef.current = !e.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const play = useCallback((variant: ClickVariant = "default") => {
    if (!enabledRef.current) return;

    const ctx = getCtx();
    if (!ctx) return;

    // Resume if suspended (browsers require user gesture)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Frequency profile per variant
    const freq = variant === "success" ? 880 : variant === "error" ? 220 : 600;
    const duration = variant === "error" ? 0.08 : 0.04;

    osc.type = variant === "error" ? "sawtooth" : "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + duration);

    // Very subtle — barely perceptible
    const peakGain = 0.06;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }, []);

  return play;
}
