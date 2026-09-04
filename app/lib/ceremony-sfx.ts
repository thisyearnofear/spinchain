/**
 * Ceremony SFX — local Web Audio tones for the activation countdown.
 *
 * Plain TS (no React). Works without ElevenLabs so the eyes-closed demo
 * still feels the ceremony. Pattern matches use-interval-audio / UI click.
 *
 * Tick: rising short beeps (3 → 2 → 1).
 * GO: bright double stinger — one clear launch beat, not a second countdown.
 */

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    try {
      sharedCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return sharedCtx;
}

function playTone(
  freq: number,
  duration: number,
  delay = 0,
  type: OscillatorType = "sine",
  peakGain = 0.14,
) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peakGain, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** Countdown tick SFX for 3 / 2 / 1 (higher pitch as we approach GO). */
export function playCountdownTickSfx(n: 1 | 2 | 3): void {
  const freq = n === 3 ? 520 : n === 2 ? 620 : 740;
  playTone(freq, 0.11, 0, "square", 0.13);
}

/** Single GO stinger — bright ascending double hit. */
export function playGoStingerSfx(): void {
  playTone(660, 0.14, 0, "square", 0.16);
  playTone(880, 0.18, 0.12, "square", 0.18);
  playTone(1175, 0.22, 0.26, "sine", 0.12);
}

/** Short success chime for first dopamine celebrations. */
export function playFirstHitSfx(): void {
  playTone(523, 0.1, 0, "sine", 0.12);
  playTone(784, 0.14, 0.1, "sine", 0.14);
}
