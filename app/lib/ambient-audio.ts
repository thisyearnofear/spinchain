/**
 * AmbientAudio — the ride's effort soundscape: wind + tyre hum.
 *
 * Roadmap item P0-#5. Two continuous noise layers synthesized entirely in the
 * audio thread (no samples, no network, no music engine coupling):
 *
 *   wind  — white noise through a bandpass whose center frequency and gain
 *           track speed and power; a slow LFO sweeps the filter so gusts come
 *           and go without any main-thread animation.
 *   tyre  — brown noise through a lowpass; gain follows cadence/speed, and
 *           the noise's playback rate rises slightly with cadence so the hum
 *           "revs" with the rider's legs.
 *
 * Design rules, borrowed from the codebases this one admires: the layer is a
 * policies-compliant guest — it only ever starts from a user gesture (ride
 * start), it fades in/out instead of clicking, it respects the app's own SFX
 * switch (sound gets its OWN switch — see sfx-pref.ts), and it throws nothing
 * when Web Audio is unavailable (private-mode WebViews).
 *
 * Plain TS, no React. Pattern matches ceremony-sfx.ts (shared AudioContext)
 * and use-interval-audio.ts (setTargetAtTime everywhere — no zipper noise).
 */

import { getSharedAudioContext } from "@/app/lib/ceremony-sfx";
import { sfxEnabled } from "@/app/lib/sfx-pref";

interface AmbientGraph {
  master: GainNode;
  windGain: GainNode;
  windFilter: BiquadFilterNode;
  tyreGain: GainNode;
  tyreSource: AudioBufferSourceNode;
  windSource: AudioBufferSourceNode;
}

let graph: AmbientGraph | null = null;
let stopping: ReturnType<typeof setTimeout> | null = null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function makeNoiseBuffer(ctx: AudioContext, brown: boolean): AudioBuffer {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      // Paul Kellet's brown-noise integrator: warm, rumbly, no harsh highs.
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function buildGraph(ctx: AudioContext): AmbientGraph {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.connect(ctx.destination);

  // ── Wind: white noise → bandpass → gain ────────────────────────────
  const windSource = ctx.createBufferSource();
  windSource.buffer = makeNoiseBuffer(ctx, false);
  windSource.loop = true;

  const windFilter = ctx.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 600;
  windFilter.Q.value = 0.9;

  const windGain = ctx.createGain();
  windGain.gain.value = 0;

  windSource.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(master);

  // Gusts: a slow LFO sweeps the bandpass so the whoosh breathes on its own.
  // AudioParam value + connections are summed, so calling setTargetAtTime on
  // `frequency` from update() and this LFO coexist.
  const gustLfo = ctx.createOscillator();
  gustLfo.type = "sine";
  gustLfo.frequency.value = 0.13;
  const gustDepth = ctx.createGain();
  gustDepth.gain.value = 180;
  gustLfo.connect(gustDepth);
  gustDepth.connect(windFilter.frequency);
  gustLfo.start();

  // ── Tyre: brown noise → lowpass → gain ─────────────────────────────
  const tyreSource = ctx.createBufferSource();
  tyreSource.buffer = makeNoiseBuffer(ctx, true);
  tyreSource.loop = true;

  const tyreFilter = ctx.createBiquadFilter();
  tyreFilter.type = "lowpass";
  tyreFilter.frequency.value = 340;
  tyreFilter.Q.value = 0.8;

  const tyreGain = ctx.createGain();
  tyreGain.gain.value = 0;

  tyreSource.connect(tyreFilter);
  tyreFilter.connect(tyreGain);
  tyreGain.connect(master);

  windSource.start();
  tyreSource.start();

  return { master, windGain, windFilter, tyreGain, tyreSource, windSource };
}

/** Start the soundscape. No-op if disabled or already running. */
export function startAmbientAudio(): void {
  if (typeof window === "undefined" || !sfxEnabled()) return;
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  if (stopping) {
    clearTimeout(stopping);
    stopping = null;
  }
  if (!graph) {
    try {
      graph = buildGraph(ctx);
    } catch {
      graph = null;
      return;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  // Fade in from wherever we are (a fast stop→start shouldn't click).
  graph.master.gain.cancelScheduledValues(ctx.currentTime);
  graph.master.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
}

/** Fade out and tear down. Nothing throws after this. */
export function stopAmbientAudio(): void {
  if (!graph) return;
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  const dying = graph;
  graph = null;
  dying.master.gain.cancelScheduledValues(ctx.currentTime);
  dying.master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  if (stopping) clearTimeout(stopping);
  stopping = setTimeout(() => {
    try {
      dying.windSource.stop();
      dying.tyreSource.stop();
      dying.master.disconnect();
    } catch {
      // already torn down by context close — fine.
    }
  }, 800);
}

/**
 * Per-telemetry-tick level adjustment. Frequencies chosen so the layer stays
 * under the music and the coach: wind peaks ~0.085, tyre ~0.065.
 * Uses setTargetAtTime (time constants) — smooth without main-thread ramps.
 */
export function updateAmbientAudio(t: {
  cadence: number;
  power: number;
  speed: number;
}): void {
  if (!graph) return;
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const windLevel =
    0.05 * clamp01(t.speed / 40) + 0.035 * clamp01((t.power - 80) / 420);
  graph.windGain.gain.setTargetAtTime(windLevel, now, 0.4);
  // Faster = higher, thinner whoosh.
  graph.windFilter.frequency.setTargetAtTime(
    500 + clamp01(t.speed / 45) * 900,
    now,
    0.5,
  );

  const tyreLevel =
    t.cadence > 5
      ? 0.045 * clamp01(t.cadence / 100) + 0.02 * clamp01(t.speed / 30)
      : 0;
  graph.tyreGain.gain.setTargetAtTime(tyreLevel, now, 0.3);
  // Rev the hum with the legs: ~0.8× at 0rpm, ~1.05× at 100rpm.
  graph.tyreSource.playbackRate.setTargetAtTime(
    0.8 + clamp01(t.cadence / 100) * 0.25,
    now,
    0.4,
  );
}
