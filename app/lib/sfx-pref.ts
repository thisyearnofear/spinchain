"use client";

/**
 * SFX preference — sound gets its OWN switch.
 *
 * The interval beeps and UI clicks used to be silenced by
 * prefers-reduced-motion, which is a VISUAL preference: reduced-motion users
 * lost the audio cues that actually help them follow the workout. Default on;
 * "spinchain:sfx:v1" = "off" mutes.
 */

export const SFX_PREF_KEY = "spinchain:sfx:v1";

export function sfxEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SFX_PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSfxEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(SFX_PREF_KEY, enabled ? "on" : "off");
  } catch {
    // private mode / Capacitor WebView storage hiccups: stay on silently
  }
}
