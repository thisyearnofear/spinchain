"use client";

/**
 * Ride lab — client shell for the spatial experiment.
 *
 * Left: a live 3D stage running one deterministic 45s pass over the lab
 * route. Right (below on mobile): the control rail. Controls and the share
 * link capture the comparison state into the query string via replaceState,
 * so a link lands on the same world/study/camera/frame. No stores, no
 * telemetry, no app defaults touched.
 */

import { Component, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { probeGpu } from "@/app/lib/gpu-probe";
import {
  CAMERAS,
  DEFAULT_OPTIONS,
  DURATION,
  EFFORT,
  STUDIES,
  createLabPlayback,
  labQueryString,
  parseLabOptions,
  parseLabTime,
  type LabOptions,
  type LabPlayback,
} from "@/app/components/features/route/ride-lab/config";
import { RideLabScene } from "@/app/components/features/route/ride-lab/ride-lab-scene";
import { ConceptBoard } from "./concept-board";
import styles from "./ride-lab.module.css";

const STUDY_HINT: Record<string, string> = {
  ribbon: "All three studies ride the same road — compare space, not route.",
  passage: "Ride through the banks, then into open sky around 21 seconds.",
  landmark: "Approach the arch around 27 seconds; a second landmark lies beyond.",
};

const CAMERA_IDS = Object.keys(CAMERAS) as (keyof typeof CAMERAS)[];
const EFFORT_IDS = Object.keys(EFFORT) as (keyof typeof EFFORT)[];

function formatTime(s: number) {
  return `${s.toFixed(1)} / ${DURATION}s`;
}

type WebglStatus = "checking" | "ok" | "no-webgl" | "context-lost" | "init-failed";

/** Canvas init/throw boundary — a failed scene hands over to fallback UI. */
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

export function RideLabClient() {
  const searchParams = useSearchParams();

  // Query params initialize once — after that, controls own the state and
  // push it back into the URL via replaceState (no remount, no navigation).
  const initial = useMemo(() => {
    const options = parseLabOptions(searchParams);
    const { t, paused } = parseLabTime(searchParams);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Reduced motion NEVER autoplays on load, even with paused=0.
    // Explicit presses of Play afterwards still work.
    const playing = !reduced && paused !== true;
    return { options, t, playing, loop: searchParams.get("loop") === "1" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [options, setOptions] = useState<LabOptions>(initial.options);
  const [playing, setPlaying] = useState(initial.playing);
  const [loop, setLoop] = useState(initial.loop);
  const [railHidden, setRailHidden] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [webgl, setWebgl] = useState<WebglStatus>("checking");
  const [sceneKey, setSceneKey] = useState(0);
  const [shareUrl, setShareUrl] = useState("");
  const [shareStatus, setShareStatus] = useState<"" | "copied" | "failed">("");
  const [displaySeconds, setDisplaySeconds] = useState(initial.t);

  const playbackRef = useRef<LabPlayback | null>(null);
  if (playbackRef.current == null) {
    playbackRef.current = createLabPlayback(initial.t, initial.playing);
  }
  // Non-null after the lazy init above; cast once so callbacks stay clean.
  const playback = playbackRef as MutableRefObject<LabPlayback>;
  const invalidateRef = useRef<(() => void) | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const invalidate = useCallback(() => invalidateRef.current?.(), []);

  // ── Clock mirror for the DOM: 4 Hz, never per-frame. ──────────────
  useEffect(() => {
    const id = setInterval(() => {
      setDisplaySeconds(playback.current.seconds);
      setPlaying((prev) => {
        const live = playback.current.playing;
        return prev === live ? prev : live;
      });
    }, 250);
    return () => clearInterval(id);
  }, [playback]);

  // ── URL sync (state → query, no navigation). ──────────────────────
  const syncUrl = useCallback(
    (next = optionsRef.current) => {
      const qs = labQueryString(next, playback.current.seconds, !playback.current.playing, playback.current.loop);
      window.history.replaceState(null, "", `?${qs}`);
    },
    [playback],
  );

  const applyOptions = useCallback(
    (patch: Partial<LabOptions>) => {
      const next = { ...optionsRef.current, ...patch };
      optionsRef.current = next;
      playback.current.revision++; // snap camera, reset smoothing
      setOptions(next);
      syncUrl(next);
      invalidate();
    },
    [invalidate, syncUrl, playback],
  );

  const setPlayingBoth = useCallback(
    (v: boolean) => {
      playback.current.playing = v;
      setPlaying(v);
      syncUrl();
      invalidate();
    },
    [invalidate, syncUrl, playback],
  );

  const scrub = useCallback(
    (t: number) => {
      playback.current.seconds = Math.min(DURATION, Math.max(0, t));
      playback.current.revision++;
      setDisplaySeconds(playback.current.seconds);
      syncUrl();
      invalidate();
    },
    [invalidate, syncUrl, playback],
  );

  const restart = useCallback(() => {
    playback.current.seconds = 0;
    playback.current.revision++;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    playback.current.playing = !reduced;
    setPlaying(playback.current.playing);
    setDisplaySeconds(0);
    syncUrl();
    invalidate();
  }, [invalidate, syncUrl, playback]);

  const toggleLoop = useCallback(
    (v: boolean) => {
      playback.current.loop = v;
      setLoop(v);
      syncUrl();
    },
    [syncUrl, playback],
  );

  const reset = useCallback(() => {
    playback.current.seconds = 0;
    playback.current.playing = false;
    playback.current.loop = false;
    playback.current.revision++;
    setLoop(false);
    setPlaying(false);
    setDisplaySeconds(0);
    setOptions(DEFAULT_OPTIONS);
    optionsRef.current = DEFAULT_OPTIONS;
    const qs = labQueryString(DEFAULT_OPTIONS, 0, true, false);
    window.history.replaceState(null, "", `?${qs}`);
    invalidate();
  }, [invalidate, playback]);

  // Share freezes the comparison: the copied link always opens paused at
  // the current frame, whatever local playback does next.
  const share = useCallback(async () => {
    const qs = labQueryString(optionsRef.current, playback.current.seconds, true, playback.current.loop);
    window.history.replaceState(null, "", `?${qs}`);
    const url = `${window.location.origin}${window.location.pathname}?${qs}`;
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
    } catch {
      setShareStatus("failed");
    }
    window.setTimeout(() => setShareStatus(""), 2500);
  }, [playback]);

  // Board opens paused; closing stays paused.
  const toggleBoard = useCallback(() => {
    setBoardOpen((open) => {
      if (!open && playback.current.playing) {
        playback.current.playing = false;
        setPlaying(false);
      }
      return !open;
    });
  }, [playback]);

  // ── Hidden tab pauses; stays paused on return. ────────────────────
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && playback.current.playing) {
        playback.current.playing = false;
        setPlaying(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [playback]);

  // ── Keyboard: Space play/pause, 1/2/3 study. Disabled in form fields. ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, select, textarea, button")) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlayingBoth(!playback.current.playing);
      } else if (["1", "2", "3"].includes(e.key)) {
        const study = STUDIES[Number(e.key) - 1];
        if (study) applyOptions({ study: study.id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyOptions, setPlayingBoth, playback]);

  // ── WebGL availability: probe before mounting the Canvas; Retry re-probes. ──
  useEffect(() => {
    setWebgl(probeGpu().webgl ? "ok" : "no-webgl");
  }, []);

  const onContextLost = useCallback(() => {
    playback.current.playing = false; // freeze immediately
    setPlaying(false);
    setWebgl("context-lost");
  }, [playback]);

  const retry = useCallback(() => {
    if (!probeGpu().webgl) {
      setWebgl("no-webgl");
      return;
    }
    playback.current.playing = false;
    setPlaying(false);
    setWebgl("ok");
    setSceneKey((k) => k + 1);
  }, [playback]);

  const study = STUDIES.find((s) => s.id === options.study) ?? STUDIES[0];
  const worldNoun = options.world === "neon" ? "structures" : "banks";
  const hint = options.study === "passage" && options.world === "neon"
    ? STUDY_HINT.passage.replace("banks", worldNoun)
    : STUDY_HINT[study.id];

  return (
    <div className={`${styles.page}${railHidden ? ` ${styles.controlsHidden}` : ""}`}>
      <div className={styles.stage}>
        {webgl === "checking" ? (
          <div className={styles.fallback} role="status" aria-label="Loading 3D scene">
            <p>Preparing the scene…</p>
          </div>
        ) : webgl !== "ok" ? (
          <div className={styles.fallback} role="alert">
            <h2>3D scene {webgl === "context-lost" ? "lost its graphics context" : "can’t start here"}</h2>
            <p>
              {webgl === "context-lost"
                ? "The WebGL context was lost (driver reset or too many contexts). Playback is paused; Retry rebuilds the scene."
                : "This browser or device didn’t provide a usable WebGL context. The experiment needs WebGL to draw the route."}
              {" "}You can still compare the three directions on the concept board, or open the current ride demo.
            </p>
            <div className={styles.btnRow}>
              <button className={styles.primaryBtn} onClick={retry}>
                Retry
              </button>
              <button
                className={styles.ghostBtn}
                onClick={() => {
                  setBoardOpen(true);
                  setRailHidden(false);
                }}
              >
                Open concept board
              </button>
              <Link
                className={styles.ghostBtn}
                href="/rider/ride/demo"
                style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
              >
                Current ride demo
              </Link>
            </div>
          </div>
        ) : (
          <SceneErrorBoundary onFail={() => setWebgl("init-failed")}>
            <RideLabScene
              key={sceneKey}
              options={options}
              playback={playback}
              invalidateRef={invalidateRef}
              onContextLost={onContextLost}
            />
          </SceneErrorBoundary>
        )}

        {boardOpen ? (
          <div className={styles.boardOverlay} role="dialog" aria-label="Concept board">
            <div className={styles.boardHead}>
              <h2>Concept board</h2>
              <button className={styles.ghostBtn} onClick={toggleBoard}>
                Close board
              </button>
            </div>
            <ConceptBoard />
          </div>
        ) : (
          <>
            <div className={styles.stageTitle} aria-live="polite">
              {options.world === "cloud" ? "Cloud" : "Neon"} · {study.label}
            </div>

            <div className={styles.stageBar}>
              <button
                className={styles.playBtn}
                onClick={() => setPlayingBoth(!playing)}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <input
                className={styles.seek}
                type="range"
                min={0}
                max={DURATION}
                step={0.1}
                value={displaySeconds}
                onChange={(e) => scrub(Number(e.target.value))}
                aria-label="Seek — playback time in seconds"
              />
              <span className={styles.stageTime}>{formatTime(displaySeconds)}</span>
            </div>
          </>
        )}

        {railHidden && !boardOpen && (
          <button className={styles.showControls} onClick={() => setRailHidden(false)}>
            Show controls
          </button>
        )}
      </div>

      {!railHidden && (
        <aside className={styles.rail} aria-label="Ride lab controls">
          <h1>Ride lab</h1>
          <p className={styles.tagline}>Find the feeling of being there.</p>

          <div className={styles.group}>
            <span className={styles.groupLabel} id="lab-world-label">World</span>
            <div className={styles.segmented} role="group" aria-labelledby="lab-world-label">
              {(["cloud", "neon"] as const).map((w) => (
                <button
                  key={w}
                  aria-pressed={options.world === w}
                  onClick={() => applyOptions({ world: w })}
                >
                  {w === "cloud" ? "Cloud" : "Neon"}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.group}>
            <span className={styles.groupLabel}>Study — same road, different space</span>
            {STUDIES.map((s, i) => (
              <button
                key={s.id}
                className={styles.studyBtn}
                aria-pressed={options.study === s.id}
                onClick={() => applyOptions({ study: s.id })}
              >
                {i + 1}. {s.label}
                <small>{s.description}</small>
              </button>
            ))}
            <p className={styles.note}>{hint}</p>
          </div>

          <div className={styles.row}>
            <label htmlFor="lab-camera">Camera</label>
            <select
              id="lab-camera"
              value={options.camera}
              onChange={(e) => applyOptions({ camera: e.target.value as LabOptions["camera"] })}
            >
              {CAMERA_IDS.map((id) => (
                <option key={id} value={id}>
                  {CAMERAS[id].label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.row}>
            <label htmlFor="lab-effort">Simulated effort</label>
            <select
              id="lab-effort"
              value={options.effort}
              onChange={(e) => applyOptions({ effort: e.target.value as LabOptions["effort"] })}
            >
              {EFFORT_IDS.map((id) => (
                <option key={id} value={id}>
                  {id[0].toUpperCase() + id.slice(1)} · {EFFORT[id].watts}W
                </option>
              ))}
            </select>
          </div>

          <div className={styles.row}>
            <label htmlFor="lab-dpr">Resolution</label>
            <select
              id="lab-dpr"
              value={String(options.dpr)}
              onChange={(e) => applyOptions({ dpr: e.target.value === "1.5" ? 1.5 : 1 })}
            >
              <option value="1">1×</option>
              <option value="1.5">1.5×</option>
            </select>
          </div>

          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={options.effects}
              onChange={(e) => applyOptions({ effects: e.target.checked })}
            />
            Effects (restrained bloom)
          </label>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={loop} onChange={(e) => toggleLoop(e.target.checked)} />
            Loop
          </label>

          <div className={styles.btnRow}>
            <button className={styles.primaryBtn} onClick={() => setPlayingBoth(!playing)} aria-label={playing ? "Pause" : "Play"}>
              {playing ? "Pause" : "Play"}
            </button>
            <button className={styles.ghostBtn} onClick={restart}>
              Restart
            </button>
            <button className={styles.ghostBtn} onClick={reset}>
              Reset
            </button>
          </div>

          <div className={styles.btnRow}>
            <button className={styles.ghostBtn} onClick={share}>
              Share comparison
            </button>
            <button className={styles.ghostBtn} onClick={toggleBoard} aria-expanded={boardOpen}>
              Concept board
            </button>
            <button className={styles.ghostBtn} onClick={() => setRailHidden(true)}>
              Hide controls
            </button>
          </div>
          <span className={styles.shareStatus} role="status" aria-live="polite">
            {shareStatus === "copied" ? "Link copied" : shareStatus === "failed" ? "Copy blocked — link below" : ""}
          </span>
          {shareStatus === "failed" && shareUrl && (
            <>
              <input
                className={styles.readOnlyInput}
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                aria-label="Comparison link — copy manually"
              />
              <span className={styles.note}>Copy this comparison link.</span>
            </>
          )}

          <p className={styles.note}>
            Keys: Space = play/pause, 1/2/3 = study. Prototype geometry — clouds are shaded lobes, not
            volumetrics. Simulated effort only changes cadence and a small glow.
          </p>
          <Link className={styles.extLink} href="/test-harness/cloud-ride" style={{ fontWeight: 700 }}>
            Ride the Cloud sequence →
          </Link>
          <Link className={styles.extLink} href="/rider/ride/demo">
            Compare with the current ride demo →
          </Link>
        </aside>
      )}
    </div>
  );
}
