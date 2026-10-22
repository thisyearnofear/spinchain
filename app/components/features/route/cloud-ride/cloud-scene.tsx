"use client";

/** Cloud ride scene — Canvas, clock owner (priority −4), camera rig, hook. */

import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { ACESFilmicToneMapping, Matrix4, Quaternion, Vector3, type PerspectiveCamera, type WebGLRenderer } from "three";
import { CLOUD_EFFORT, CLOUD_VIEWS, sequenceProgress, revealAt, makeCloudCurve, type CloudOptions, type CloudPlayback } from "./sequence";
import { CloudRoad, CloudWorldScene } from "./cloud-world";
import { CloudRider } from "./cloud-rider";

declare global {
  interface Window {
    __CLOUD_RIDE__?: {
      snapshot: () => {
        seconds: number; playing: boolean; view: string; effort: string;
        soundEnabled: boolean; calls: number; triangles: number; geometries: number; textures: number;
      };
    };
  }
}

function stepPb(pb: CloudPlayback, delta: number, cadence: number) {
  const d = Math.min(delta, 0.1);
  pb.seconds += d;
  pb.pedalPhase += d * (cadence / 60) * Math.PI * 2;
  if (pb.seconds >= 45) {
    pb.seconds = 45;
    pb.playing = false;
  }
}

function Driver({ playback, cadence }: { playback: MutableRefObject<CloudPlayback>; cadence: number }) {
  const invalidate = useThree((s) => s.invalidate);
  const targetRef = useRef(cadence);
  const currentRef = useRef(cadence);
  useEffect(() => { targetRef.current = cadence; }, [cadence]);
  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    // Cadence eases toward the selected effort (~.25s settle), no jumping feet.
    currentRef.current += (targetRef.current - currentRef.current) * (1 - Math.exp(-d * 8));
    if (!playback.current.playing) return;
    stepPb(playback.current, d, currentRef.current);
    invalidate();
  }, -4);
  return null;
}

const _up = new Vector3(0, 1, 0);
const _p = new Vector3();
const _t = new Vector3();
const _s = new Vector3();
const _pos = new Vector3();
const _look = new Vector3();
const _m = new Matrix4();
const _q = new Quaternion();

function CloudCamera({ curve, options, playback }: { curve: ReturnType<typeof makeCloudCurve>; options: CloudOptions; playback: MutableRefObject<CloudPlayback> }) {
  const invalidate = useThree((s) => s.invalidate);
  const spec = CLOUD_VIEWS[options.view];
  const len = useMemo(() => curve.getLength(), [curve]);
  const has = useRef(false);
  const lastRev = useRef(-1);
  const lastView = useRef("");
  useFrame((state, delta) => {
    const camera = state.camera as PerspectiveCamera;
    const pb = playback.current;
    const u = Math.min(0.999, sequenceProgress(pb.seconds));
    curve.getPointAt(u, _p);
    curve.getTangentAt(u, _t).normalize();
    _s.crossVectors(_t, _up).normalize();
    _pos.copy(_p).addScaledVector(_t, -spec.back).addScaledVector(_s, spec.side);
    _pos.y += spec.height;
    curve.getPointAt(Math.min(1, u + spec.lookAhead / len), _look);
    _look.y += spec.lookHeight;
    _m.lookAt(_pos, _look, _up);
    _q.setFromRotationMatrix(_m);
    const snap = !has.current || lastRev.current !== pb.revision || !pb.playing;
    const k = 1 - Math.exp(-delta * 7);
    if (snap) {
      camera.position.copy(_pos);
      camera.quaternion.copy(_q);
      camera.fov = spec.fov;
      camera.updateProjectionMatrix();
    } else {
      camera.position.lerp(_pos, k);
      camera.quaternion.slerp(_q, k);
      if (camera.fov !== spec.fov) {
        camera.fov += (spec.fov - camera.fov) * k;
        camera.updateProjectionMatrix();
      }
    }
    has.current = true;
    lastRev.current = pb.revision;
    lastView.current = options.view;
  }, -1);
  useEffect(() => { invalidate(); }, [invalidate, options.view]);
  return null;
}

/**
 * Feeds the shared scene inputs from the playback clock — runs after Driver
 * (−4) so the refs always see this frame's seconds. Effort arrives through
 * the prop-synced ref in CloudScene.
 */
function CloudInputSync({ playback, timeRef, progressRef, warmthRef }: { playback: MutableRefObject<CloudPlayback>; timeRef: MutableRefObject<number>; progressRef: MutableRefObject<number>; warmthRef: MutableRefObject<number> }) {
  useFrame(() => {
    timeRef.current = playback.current.seconds;
    progressRef.current = sequenceProgress(playback.current.seconds);
    warmthRef.current = revealAt(playback.current.seconds);
  }, -3);
  return null;
}

function Hook({ options, playback, soundRef }: { options: CloudOptions; playback: MutableRefObject<CloudPlayback>; soundRef: MutableRefObject<boolean> }) {
  const gl = useThree((s) => s.gl) as WebGLRenderer;
  const oRef = useRef(options);
  useEffect(() => { oRef.current = options; }, [options]);
  useEffect(() => {
    window.__CLOUD_RIDE__ = {
      snapshot: () => ({
        seconds: playback.current.seconds,
        playing: playback.current.playing,
        view: oRef.current.view,
        effort: oRef.current.effort,
        soundEnabled: soundRef.current,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      }),
    };
    return () => { delete window.__CLOUD_RIDE__; };
  }, [gl, playback, soundRef]);
  return null;
}

function Bridge({ invalidateRef, onLost }: { invalidateRef?: MutableRefObject<(() => void) | null>; onLost?: () => void }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const lostRef = useRef(onLost);
  useEffect(() => { lostRef.current = onLost; }, [onLost]);
  useEffect(() => {
    if (invalidateRef) invalidateRef.current = invalidate;
    return () => { if (invalidateRef) invalidateRef.current = null; };
  }, [gl, invalidate, invalidateRef]);
  useEffect(() => {
    const c = gl.domElement;
    const h = (e: Event) => { e.preventDefault(); lostRef.current?.(); };
    c.addEventListener("webglcontextlost", h);
    return () => c.removeEventListener("webglcontextlost", h);
  }, [gl]);
  return null;
}

export function CloudScene({
  options,
  playback,
  invalidateRef,
  soundRef,
  onContextLost,
}: {
  options: CloudOptions;
  playback: MutableRefObject<CloudPlayback>;
  invalidateRef?: MutableRefObject<(() => void) | null>;
  soundRef: MutableRefObject<boolean>;
  onContextLost?: () => void;
}) {
  const curve = useMemo(() => makeCloudCurve(), []);
  const effort = CLOUD_EFFORT[options.effort];
  const effortRef = useRef(effort.amount);
  useEffect(() => { effortRef.current = effort.amount; }, [effort.amount]);
  // Refs the shared world/road components read per frame — synced from the
  // playback clock by CloudInputSync (time/progress/warmth) and the option
  // effect above (effort).
  const timeRef = useRef(0);
  const progressRef = useRef(0.065);
  const warmthRef = useRef(0);
  return (
    <Canvas
      frameloop="demand"
      dpr={1}
      camera={{ fov: CLOUD_VIEWS[options.view].fov, near: 0.1, far: 2500, position: [0, 40, -80] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl, invalidate }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        invalidate();
      }}
    >
      <Bridge invalidateRef={invalidateRef} onLost={onContextLost} />
      <Suspense
        fallback={
          <Html center>
            <div role="status" style={{ color: "#fff", background: "#352941", padding: "12px 18px", borderRadius: 12 }}>
              Loading Cloud Kingdom…
            </div>
          </Html>
        }
      >
        <Driver playback={playback} cadence={effort.cadence} />
        <CloudInputSync playback={playback} timeRef={timeRef} progressRef={progressRef} warmthRef={warmthRef} />
        <CloudCamera curve={curve} options={options} playback={playback} />
        <CloudWorldScene
          curve={curve}
          timeRef={timeRef}
          progressRef={progressRef}
          effortRef={effortRef}
          warmthRef={warmthRef}
          reducedMotion={options.reducedMotion}
        />
        <CloudRoad curve={curve} banked={!options.reducedMotion} timeRef={timeRef} effortRef={effortRef} />
        <CloudRider curve={curve} playback={playback} cadence={effort.cadence} effortAmount={effort.amount} reducedMotion={options.reducedMotion} />
        <Hook options={options} playback={playback} soundRef={soundRef} />
      </Suspense>
    </Canvas>
  );
}
