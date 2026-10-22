"use client";

/**
 * Cloud ride audio — self-contained WebAudio (no remote services).
 * Gesture-gated: `enable()` must be called from a user event; it awaits
 * ctx.resume() and returns whether sound actually started. pause() silences
 * instantly (mute keeps `enabled` so play resumes sound); mute() is a full
 * off. One chime plays once per forward crossing of 21s; scrub/restart
 * (revision bump) resets edge detection so it never retriggers.
 */

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import type { CloudPlayback } from "./sequence";

const PAD = [146.83, 220, 293.66];
const CHIME = [587.33, 739.99, 880];

export interface CloudAudioEngineApi {
  enable(): Promise<boolean>;
  resume(): Promise<boolean>;
  pause(): void;
  mute(): void;
  update(playing: boolean, effort: number): void;
  chime(): void;
  dispose(): void;
  readonly ctx: AudioContext | null;
}

export function createCloudAudioEngine(): CloudAudioEngineApi {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let wind: GainNode | null = null;
  let windFilter: BiquadFilterNode | null = null;
  let noiseSrc: AudioBufferSourceNode | null = null;
  let padGain: GainNode | null = null;
  let pads: OscillatorNode[] = [];
  const chimeNodes: Set<{ o: OscillatorNode; g: GainNode }> = new Set();
  let enabled = false;
  let paused = false; // after pause(): update can't restore volume until enable/resume
  let generation = 0;
  let disposed = false;

  const silenceNow = () => {
    if (!ctx || !master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
  };

  const stopChimes = () => {
    chimeNodes.forEach(({ o, g }) => {
      try { o.stop(); } catch { /* already stopped */ }
      o.disconnect();
      g.disconnect();
    });
    chimeNodes.clear();
  };

  const build = () => {
    if (ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error("AudioContext unavailable");
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // Wind: looped seeded noise → lowpass → gain.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < len; i++) {
      s = (s * 16807) % 2147483647;
      d[i] = (s / 2147483647) * 2 - 1;
    }
    noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;
    noiseSrc.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 500;
    wind = ctx.createGain();
    wind.gain.value = 0;
    noiseSrc.connect(windFilter).connect(wind).connect(master);
    noiseSrc.start();

    padGain = ctx.createGain();
    padGain.gain.value = 0;
    padGain.connect(master);
    pads = PAD.map((f) => {
      const o = ctx!.createOscillator();
      o.frequency.value = f;
      o.type = "sine";
      o.connect(padGain!);
      o.start();
      return o;
    });
  };

  return {
    get ctx() {
      return ctx;
    },
    async enable() {
      const gen = ++generation;
      try {
        build();
        await ctx!.resume();
        // A mute/dispose that landed while resume was pending must not be
        // undone by this late promise.
        if (disposed || gen !== generation) return false;
        enabled = true;
        paused = false;
        return true;
      } catch {
        return false;
      }
    },
    async resume() {
      if (!ctx || !enabled || disposed) return false;
      try {
        await ctx.resume();
        paused = false;
        return true;
      } catch {
        enabled = false;
        return false;
      }
    },
    pause() {
      paused = true;
      silenceNow();
      stopChimes(); // a stale reveal chime must not resume after seek/restart
      void ctx?.suspend().catch(() => {});
    },
    mute() {
      generation++; // invalidate any in-flight enable
      enabled = false;
      paused = true;
      silenceNow();
      stopChimes();
      void ctx?.suspend().catch(() => {});
    },
    update(playing: boolean, effort: number) {
      if (!ctx || !master || !enabled || paused) return;
      const t = ctx.currentTime;
      const on = playing;
      master.gain.setTargetAtTime(on ? 0.25 : 0, t, 0.15);
      wind?.gain.setTargetAtTime(on ? 0.12 + effort * 0.06 : 0, t, 0.2);
      windFilter?.frequency.setTargetAtTime(500 + effort * 1000, t, 0.3);
      padGain?.gain.setTargetAtTime(on ? 0.06 / PAD.length : 0, t, 0.3);
    },
    chime() {
      if (!ctx || !master || !enabled) return;
      CHIME.forEach((f, i) => {
        const o = ctx!.createOscillator();
        const g = ctx!.createGain();
        const t0 = ctx!.currentTime + i * 0.18;
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.12, t0 + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
        o.connect(g).connect(master!);
        o.start(t0);
        o.stop(t0 + 1.4);
        const node = { o, g };
        chimeNodes.add(node);
        o.onended = () => {
          o.disconnect();
          g.disconnect();
          chimeNodes.delete(node); // bounded set, no leak
        };
      });
    },
    dispose() {
      disposed = true;
      generation++;
      try {
        stopChimes();
        noiseSrc?.stop();
        noiseSrc?.disconnect();
        pads.forEach((o) => { o.stop(); o.disconnect(); });
        wind?.disconnect();
        windFilter?.disconnect();
        padGain?.disconnect();
        master?.disconnect();
        if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {});
      } catch { /* nonfatal */ }
      ctx = null;
      master = null;
      enabled = false;
      pads = [];
    },
  };
}

/**
 * Hook: owns one engine per mount and the level/chime poller.
 * Returned methods are intended to be called from user gestures.
 */
export function useCloudAudio(
  playback: MutableRefObject<CloudPlayback>,
  effortAmount: number,
  onError?: (message: string) => void,
) {
  const engineRef = useRef<CloudAudioEngineApi | null>(null);
  const enabledRef = useRef(false);
  const lastSecondsRef = useRef(0);
  const lastRevRef = useRef(-1);
  const effortRef = useRef(effortAmount);
  useEffect(() => { effortRef.current = effortAmount; }, [effortAmount]);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    engineRef.current = createCloudAudioEngine();
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const enable = useCallback(async () => {
    const ok = (await engineRef.current?.enable()) ?? false;
    enabledRef.current = ok;
    if (!ok) onErrorRef.current?.("Sound unavailable in this browser");
    return ok;
  }, []);

  const resume = useCallback(async () => {
    if (!enabledRef.current) return false;
    const ok = (await engineRef.current?.resume()) ?? false;
    if (!ok) {
      enabledRef.current = false;
      onErrorRef.current?.("Sound paused by the browser");
    }
    return ok;
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const mute = useCallback(() => {
    enabledRef.current = false;
    engineRef.current?.mute();
  }, []);

  // Levels + reveal-chime edge detection + play→stop suspend.
  const lastPlayingRef = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      const pb = playback.current;
      const eng = engineRef.current;
      if (!eng?.ctx || !enabledRef.current) {
        lastSecondsRef.current = pb.seconds;
        lastPlayingRef.current = pb.playing;
        return;
      }
      eng.update(enabledRef.current && pb.playing && pb.seconds < 45, effortRef.current);
      if (pb.revision !== lastRevRef.current) {
        lastRevRef.current = pb.revision;
        lastSecondsRef.current = pb.seconds;
      }
      if (enabledRef.current && pb.playing && lastSecondsRef.current < 21 && pb.seconds >= 21) eng.chime();
      // Natural end / external stop: suspend once, not every poll.
      if (lastPlayingRef.current && !pb.playing) eng.pause();
      lastSecondsRef.current = pb.seconds;
      lastPlayingRef.current = pb.playing;
    }, 200);
    return () => clearInterval(id);
  }, [playback]);

  // Stable object — callers add it to effect deps.
  const api = useMemo(
    () => ({ enable, resume, pause, mute, enabledRef }),
    [enable, resume, pause, mute],
  );
  return api;
}
