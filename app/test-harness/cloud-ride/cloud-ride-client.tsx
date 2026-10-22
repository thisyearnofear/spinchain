"use client";

/**
 * Cloud ride client — one authored 45s sequence. Full-viewport stage,
 * compact plum dock, view/effort/sound controls. URL carries the
 * comparison state; Share copies a paused-at-frame link.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pause, Play, RotateCcw, Share2, Volume2, VolumeX } from "lucide-react";
import { probeGpu } from "@/app/lib/gpu-probe";
import {
  CLOUD_DURATION,
  CLOUD_EFFORT,
  cloudQueryString,
  parseCloudOptions,
  parseCloudTime,
  sequenceChapter,
  type CloudOptions,
  type CloudPlayback,
} from "@/app/components/features/route/cloud-ride/sequence";
import { CloudScene } from "@/app/components/features/route/cloud-ride/cloud-scene";
import { Component, type ReactNode } from "react";
import { useCloudAudio } from "@/app/components/features/route/cloud-ride/use-cloud-audio";
import styles from "./cloud-ride.module.css";

const EFFORTS = Object.keys(CLOUD_EFFORT) as (keyof typeof CLOUD_EFFORT)[];

/** Canvas init boundary — a failed scene hands over to the fallback UI. */
class SceneErrorBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
const fmt = (s: number) => `${s.toFixed(1)} / ${CLOUD_DURATION}s`;

type Gpu = "checking" | "ok" | "no-webgl" | "context-lost";

export function CloudRideClient() {
  const searchParams = useSearchParams();
  const initial = useMemo(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const options = parseCloudOptions(searchParams, reduced);
    const { t, paused } = parseCloudTime(searchParams);
    const playing = !reduced && paused !== true && t < CLOUD_DURATION;
    return { options, t, playing };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [options, setOptions] = useState<CloudOptions>(initial.options);
  const [playing, setPlaying] = useState(initial.playing);
  const [ended, setEnded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [gpu, setGpu] = useState<Gpu>("checking");
  const [sceneKey, setSceneKey] = useState(0);
  const [seconds, setSeconds] = useState(initial.t);
  const [soundOn, setSoundOn] = useState(false);
  const [soundError, setSoundError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareStatus, setShareStatus] = useState<"" | "copied" | "failed">("");

  const playbackRef = useRef<CloudPlayback | null>(null);
  if (playbackRef.current == null) {
    playbackRef.current = { seconds: initial.t, playing: initial.playing, revision: 0, pedalPhase: (initial.t * CLOUD_EFFORT[initial.options.effort].cadence) / 60 * Math.PI * 2 };
  }
  const playback = playbackRef as MutableRefObject<CloudPlayback>;
  const invalidateRef = useRef<(() => void) | null>(null);
  const soundRef = useRef(false);
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; }, [options]);
  const invalidate = useCallback(() => invalidateRef.current?.(), []);

  const audio = useCloudAudio(playback, CLOUD_EFFORT[options.effort].amount, setSoundError);

  // 4 Hz DOM mirror only.
  useEffect(() => {
    const id = setInterval(() => {
      const pb = playback.current;
      setSeconds(pb.seconds);
      setEnded(pb.seconds >= CLOUD_DURATION);
      setPlaying((p) => (p === pb.playing ? p : pb.playing));
    }, 250);
    return () => clearInterval(id);
  }, [playback]);

  const syncUrl = useCallback(
    (o = optionsRef.current) => {
      const qs = cloudQueryString(o, playback.current.seconds, !playback.current.playing);
      window.history.replaceState(null, "", `?${qs}`);
    },
    [playback],
  );

  const setPlay = useCallback(
    (v: boolean) => {
      const pb = playback.current;
      if (v && pb.seconds >= CLOUD_DURATION) {
        pb.seconds = 0; // "Ride again" resumes from the start
        pb.pedalPhase = 0;
        pb.revision++;
      }
      pb.playing = v;
      setPlaying(v);
      setEnded(false);
      if (v && audio.enabledRef.current) void audio.resume();
      if (!v) audio.pause();
      syncUrl();
      invalidate();
    },
    [audio, invalidate, playback, syncUrl],
  );

  const scrub = useCallback(
    (t: number) => {
      const pb = playback.current;
      pb.seconds = Math.min(CLOUD_DURATION, Math.max(0, t));
      pb.pedalPhase = (pb.seconds * CLOUD_EFFORT[optionsRef.current.effort].cadence) / 60 * Math.PI * 2;
      pb.revision++;
      pb.playing = false;
      setPlaying(false);
      setSeconds(pb.seconds);
      audio.pause();
      syncUrl();
      invalidate();
    },
    [audio, invalidate, playback, syncUrl],
  );

  const restart = useCallback(() => {
    const pb = playback.current;
    pb.seconds = 0;
    pb.pedalPhase = 0;
    pb.revision++;
    pb.playing = !optionsRef.current.reducedMotion;
    setPlaying(pb.playing);
    setSeconds(0);
    setEnded(false);
    if (pb.playing && audio.enabledRef.current) void audio.resume();
    else if (!pb.playing) audio.pause();
    syncUrl();
    invalidate();
  }, [audio, invalidate, playback, syncUrl]);

  const setView = useCallback(
    (view: CloudOptions["view"]) => {
      const next = { ...optionsRef.current, view };
      optionsRef.current = next;
      setOptions(next);
      if (!playback.current.playing) playback.current.revision++; // paused: snap for comparison
      syncUrl(next);
      invalidate();
    },
    [invalidate, playback, syncUrl],
  );

  const setEffort = useCallback(
    (effort: CloudOptions["effort"]) => {
      // Pedal phase is preserved; cadence change eases in, no jumping feet.
      const next = { ...optionsRef.current, effort };
      optionsRef.current = next;
      setOptions(next);
      syncUrl(next);
      invalidate();
    },
    [invalidate, syncUrl],
  );

  const toggleSound = useCallback(() => {
    if (soundOn) {
      audio.mute();
      soundRef.current = false;
      setSoundOn(false);
      setSoundError("");
      return;
    }
    void audio.enable().then((ok) => {
      soundRef.current = ok;
      setSoundOn(ok);
      if (!ok) setSoundError("Sound unavailable in this browser");
    });
  }, [audio, soundOn]);

  const share = useCallback(async () => {
    const qs = cloudQueryString(optionsRef.current, playback.current.seconds, true);
    window.history.replaceState(null, "", `?${qs}`);
    const url = `${window.location.origin}${window.location.pathname}?${qs}`;
    setShareUrl(url);
    setShareStatus("");
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
    } catch {
      setShareStatus("failed"); // input stays until a new share attempt
    }
  }, [playback]);

  // Hidden tab pauses + silences, no autoresume.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && playback.current.playing) {
        playback.current.playing = false;
        setPlaying(false);
        audio.pause();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [playback, audio]);

  // Keys: Space play/pause, V view, M sound — form targets ignored.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, select, textarea, button, a")) return;
      if (e.code === "Space") { e.preventDefault(); setPlay(!playback.current.playing); }
      else if (e.key === "v" || e.key === "V") setView(optionsRef.current.view === "play" ? "cinema" : "play");
      else if (e.key === "m" || e.key === "M") toggleSound();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playback, setPlay, setView, toggleSound]);

  useEffect(() => { setGpu(probeGpu().webgl ? "ok" : "no-webgl"); }, []);
  const onContextLost = useCallback(() => {
    playback.current.playing = false;
    setPlaying(false);
    audio.pause();
    setGpu("context-lost");
  }, [playback, audio]);
  const retry = useCallback(() => {
    if (!probeGpu().webgl) { setGpu("no-webgl"); return; }
    playback.current.playing = false;
    setPlaying(false);
    setGpu("ok");
    setSceneKey((k) => k + 1);
  }, [playback]);

  const effort = CLOUD_EFFORT[options.effort];
  return (
    <div className={styles.page}>
      <div className={styles.stage}>
        {gpu !== "ok" ? (
          <div className={styles.fallback} role={gpu === "checking" ? "status" : "alert"}>
            <h1>Cloud Kingdom</h1>
            <p>
              {gpu === "checking" && "Preparing the ride…"}
              {gpu === "no-webgl" && "This browser didn't provide a usable WebGL context — the sequence needs it to draw."}
              {gpu === "context-lost" && "The graphics context was lost. Playback is paused; Retry rebuilds the scene."}
            </p>
            {gpu !== "checking" && <button onClick={retry}>Retry</button>}
            <Link href="/test-harness/ride-lab" style={{ color: "#f4edff", fontSize: 13 }}>Back to ride lab</Link>
          </div>
        ) : (
          <SceneErrorBoundary onFail={() => { audio.pause(); setGpu("context-lost"); }}>
            <CloudScene
              key={sceneKey}
              options={options}
              playback={playback}
              invalidateRef={invalidateRef}
              soundRef={soundRef}
              onContextLost={onContextLost}
            />
          </SceneErrorBoundary>
        )}
      </div>

      {!hidden && (
        <>
          <div className={styles.hud}>
            <h1>Cloud Kingdom</h1>
            <div className={styles.chapter} aria-live="polite">{sequenceChapter(seconds)}</div>
            <div className={styles.tag}>45-second Cloud ride</div>
          </div>

          <div className={styles.topRight}>
            <button aria-pressed={options.view === "play"} onClick={() => setView("play")}>Play view</button>
            <button aria-pressed={options.view === "cinema"} onClick={() => setView("cinema")}>Cinema view</button>
            <button onClick={toggleSound} aria-pressed={soundOn} aria-label={soundOn ? "Sound off" : "Sound on"}>
              {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />} Sound {soundOn ? "on" : "off"}
            </button>
            <button onClick={() => setHidden(true)}>Hide controls</button>
          </div>

          <Link className={styles.backLink} href="/test-harness/ride-lab" aria-label="Back to ride lab">
            <ArrowLeft size={14} /><span className={styles.backLabel}>Back to ride lab</span>
          </Link>

          <div className={styles.shareRow}>
            <button onClick={share} aria-label="Share this moment">
              <Share2 size={14} /><span className={styles.shareLabel}>Share this moment</span>
            </button>
            <span className={styles.shareStatus} role="status">
              {shareStatus === "copied" ? "Link copied" : shareStatus === "failed" ? "Copy blocked — link below" : ""}
            </span>
            {shareStatus === "failed" && shareUrl && (
              <input className={styles.shareInput} readOnly value={shareUrl} onFocus={(e) => e.target.select()} aria-label="Comparison link" />
            )}
          </div>

          <div className={styles.dock}>
            <div className={styles.transport}>
              <button onClick={() => setPlay(!playing)} aria-label={ended ? "Ride again" : playing ? "Pause" : "Play"}>
                {ended ? <><RotateCcw size={14} />Ride again</> : playing ? <><Pause size={14} />Pause</> : <><Play size={14} />Play</>}
              </button>
              <button onClick={restart} aria-label="Restart"><RotateCcw size={14} /></button>
              <input className={styles.seek} type="range" min={0} max={CLOUD_DURATION} step={0.1} value={seconds}
                onChange={(e) => scrub(Number(e.target.value))} aria-label="Seek — playback time in seconds" />
              <span className={styles.time}>{fmt(seconds)}</span>
            </div>
            <div className={styles.effortRow}>
              {EFFORTS.map((id) => (
                <button key={id} className={styles.chip} aria-pressed={options.effort === id} onClick={() => setEffort(id)}>
                  {id === "cruise" ? "Cruise" : id === "build" ? "Build" : "Push"}
                </button>
              ))}
              <span className={styles.readout}>{effort.watts}W · {effort.cadence}rpm<small>simulated</small></span>
            </div>
            {soundError && <span className={styles.effortNote} role="status">{soundError}</span>}
          </div>
        </>
      )}
      {hidden && <button className={styles.showBtn} onClick={() => setHidden(false)}>Show controls</button>}
    </div>
  );
}
