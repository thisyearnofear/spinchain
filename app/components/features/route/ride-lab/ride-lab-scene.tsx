"use client";

/**
 * Ride lab scene — one bounded R3F renderer for the spatial experiments.
 *
 * Deliberately NOT the production RouteVisualizer: no stores, no telemetry,
 * no reactive overlays, no auto quality tiers. The playback clock lives in
 * a mutable ref owned by PlaybackDriver inside the Canvas; React controls
 * mutate it and bump `revision` so the camera snaps on scrub/switch instead
 * of interpolating across the jump.
 */

import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import {
  ACESFilmicToneMapping,
  Matrix4,
  Quaternion,
  Vector3,
  type PerspectiveCamera,
  type WebGLRenderer,
} from "three";
import { CAMERAS, DURATION, EFFORT, buildLabCurve, labProgress, labSideAt, type LabOptions, type LabPlayback } from "./config";
import { LabWorld } from "./ride-lab-world";
import { FirstPersonBars, LabRider } from "./ride-lab-rider";

declare global {
  interface Window {
    __RIDE_LAB__?: {
      snapshot: () => {
        seconds: number;
        playing: boolean;
        world: string;
        study: string;
        camera: string;
        effects: boolean;
        dpr: number;
        calls: number;
        triangles: number;
        geometries: number;
        textures: number;
      };
    };
  }
}

// ─── Clock owner ───────────────────────────────────────────────────

/**
 * The only place `seconds` advances. Delta capped at 0.1s so a background
 * tab doesn't teleport the ride. Stops at DURATION unless looping; a loop
 * boundary bumps revision so the camera never interpolates end→start.
 */
/** Advance the lab clock — the only writer of `seconds`. */
function stepPlayback(pb: LabPlayback, delta: number) {
  pb.seconds += Math.min(delta, 0.1);
  if (pb.seconds >= DURATION) {
    if (pb.loop) {
      pb.seconds -= DURATION;
      pb.revision += 1; // camera snaps across the wrap, never interpolates it
    } else {
      pb.seconds = DURATION;
      pb.playing = false;
    }
  }
}

function PlaybackDriver({ playback }: { playback: MutableRefObject<LabPlayback> }) {
  const invalidate = useThree((s) => s.invalidate);
  useFrame((_, delta) => {
    if (!playback.current.playing) return; // paused: no invalidate → demand loop settles
    stepPlayback(playback.current, delta);
    invalidate();
  }, -3);
  return null;
}

// ─── Camera rig ────────────────────────────────────────────────────

const _up = new Vector3(0, 1, 0);
const _point = new Vector3();
const _tangent = new Vector3();
const _side = new Vector3();
const _pos = new Vector3();
const _lookAt = new Vector3();
const _m = new Matrix4();
const _q = new Quaternion();

function LabCameraRig({
  curve,
  options,
  playback,
}: {
  curve: ReturnType<typeof buildLabCurve>;
  options: LabOptions;
  playback: MutableRefObject<LabPlayback>;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const spec = CAMERAS[options.camera];
  const effort = EFFORT[options.effort];
  const curveLength = useMemo(() => curve.getLength(), [curve]);

  const hasPose = useRef(false);
  const lastRevision = useRef(-1);
  const lastCamera = useRef("");

  // FOV: spec base + small effort lift when effects are on.
  const targetFov = spec.fov + (options.effects ? effort.amount * 4 : 0);

  useFrame((state, delta) => {
    const camera = state.camera as PerspectiveCamera;
    const pb = playback.current;
    const u = Math.min(0.999, labProgress(pb.seconds));
    curve.getPointAt(u, _point);
    curve.getTangentAt(u, _tangent).normalize();
    if (!Number.isFinite(_point.x) || !Number.isFinite(_tangent.x)) return;
    _side.crossVectors(_tangent, _up);
    if (_side.lengthSq() < 1e-10) _side.set(1, 0, 0);
    _side.normalize();

    // pos = point − tangent·back + side·sideOffset + up·height
    _pos.copy(_point).addScaledVector(_tangent, -spec.back).addScaledVector(_side, spec.side);
    _pos.y += spec.height;

    // Look toward the curve point lookAhead arc-length units forward.
    const aheadU = Math.min(1, u + spec.lookAhead / curveLength);
    curve.getPointAt(aheadU, _lookAt);
    _lookAt.y += spec.lookHeight;

    _m.lookAt(_pos, _lookAt, _up);
    _q.setFromRotationMatrix(_m);

    const snap =
      !hasPose.current ||
      lastRevision.current !== pb.revision ||
      lastCamera.current !== options.camera;

    if (snap || !pb.playing) {
      camera.position.copy(_pos);
      camera.quaternion.copy(_q);
    } else {
      const k = 1 - Math.exp(-delta * 7);
      camera.position.lerp(_pos, k);
      camera.quaternion.slerp(_q, k);
    }
    hasPose.current = true;
    lastRevision.current = pb.revision;
    lastCamera.current = options.camera;

    if (camera.fov !== targetFov) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
  }, -1);

  // First draw must not wait for a user action.
  useEffect(() => {
    invalidate();
  }, [invalidate, options.camera]);

  return null;
}

// ─── Read-only bench hook (lead's benchmark surface) ───────────────
// NOTE: with post-processing on, gl.info.render reflects the LAST composer
// pass only — not scene totals. Documented in docs/ride-lab.md.

function LabInfoHook({ options, playback }: { options: LabOptions; playback: MutableRefObject<LabPlayback> }) {
  const gl = useThree((s) => s.gl) as WebGLRenderer;
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);
  useEffect(() => {
    window.__RIDE_LAB__ = {
      snapshot: () => ({
        seconds: playback.current.seconds,
        playing: playback.current.playing,
        world: optionsRef.current.world,
        study: optionsRef.current.study,
        camera: optionsRef.current.camera,
        effects: optionsRef.current.effects,
        dpr: optionsRef.current.dpr,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      }),
    };
    return () => {
      delete window.__RIDE_LAB__;
    };
  }, [gl, playback]);
  return null;
}

// ─── Context loss + lifecycle ──────────────────────────────────────

/** Owns the contextlost listener + invalidate wiring with real cleanup. */
function SceneBridge({
  invalidateRef,
  onLost,
}: {
  invalidateRef?: MutableRefObject<(() => void) | null>;
  onLost?: () => void;
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const onLostRef = useRef(onLost);
  useEffect(() => {
    onLostRef.current = onLost;
  }, [onLost]);

  useEffect(() => {
    if (invalidateRef) invalidateRef.current = invalidate;
    return () => {
      if (invalidateRef) invalidateRef.current = null;
    };
  }, [gl, invalidate, invalidateRef]);

  useEffect(() => {
    const canvas = gl.domElement;
    const handler = (e: Event) => {
      e.preventDefault();
      onLostRef.current?.();
    };
    canvas.addEventListener("webglcontextlost", handler);
    return () => canvas.removeEventListener("webglcontextlost", handler);
  }, [gl]);

  return null;
}

// ─── Scene ─────────────────────────────────────────────────────────

export interface RideLabSceneProps {
  options: LabOptions;
  playback: MutableRefObject<LabPlayback>;
  /** Filled with R3F's invalidate so controls can wake the demand loop. */
  invalidateRef?: MutableRefObject<(() => void) | null>;
  onContextLost?: () => void;
}

export function RideLabScene({ options, playback, invalidateRef, onContextLost }: RideLabSceneProps) {
  const curve = useMemo(() => buildLabCurve(), []);
  const effort = EFFORT[options.effort];

  return (
    <Canvas
      frameloop="demand"
      dpr={options.dpr}
      camera={{ fov: CAMERAS[options.camera].fov, near: 0.1, far: 2000, position: [0, 30, -60] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl, invalidate }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        invalidate();
      }}
    >
      <SceneBridge invalidateRef={invalidateRef} onLost={onContextLost} />
      <Suspense fallback={null}>
        <PlaybackDriver playback={playback} />
        <LabCameraRig curve={curve} options={options} playback={playback} />
        <LabWorld options={options} curve={curve} effortAmount={effort.amount} />
        <LabRider curve={curve} playback={playback} cadence={effort.cadence} hidden={options.camera === "first"} />
        {options.camera === "first" && <FirstPersonBars />}
        {options.effects && (
          <EffectComposer resolutionScale={0.5}>
            <Bloom intensity={0.2 + effort.amount * 0.15} luminanceThreshold={1} mipmapBlur />
          </EffectComposer>
        )}
        <LabInfoHook options={options} playback={playback} />
      </Suspense>
    </Canvas>
  );
}

// Re-export so the client doesn't import three for side vector math.
export { labSideAt };
