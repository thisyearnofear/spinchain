"use client";

/**
 * Ride lab rider — the same AnimatedModel + ProceduralBike + useCyclistPose
 * rig as the production visualizer, but driven by the deterministic lab
 * clock instead of live stores/telemetry. Crank phase AND the avatar's idle
 * clip are pure functions of `seconds` (via AnimatedModel's timeRef), so a
 * paused frame and a shared URL land on the same pose.
 */

import { Component, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, Group, Vector3, type CatmullRomCurve3 } from "three";
import { AnimatedModel } from "../animated-model";
import { BIKE_DECK_OFFSET, ProceduralBike, RIG, useCyclistPose } from "../procedural-cyclist";
import { resolveAvatar } from "@/app/lib/selection-library";
import { labProgress, type LabPlayback } from "./config";

const _point = new Vector3();
const _tangent = new Vector3();
const _look = new Vector3();
const _offset = new Vector3();

/** Small soft radial decal — a ground-contact shadow, no glow. */
function useShadowTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, "rgba(20,12,30,0.5)");
    g.addColorStop(1, "rgba(20,12,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new CanvasTexture(c);
  }, []);
}

/** Capsule rider shown when the GLB can't load — keeps the scene readable. */
function CapsuleRider() {
  return (
    <mesh position={[0, 1.1, -0.2]} rotation={[0.9, 0, 0]}>
      <capsuleGeometry args={[0.28, 0.9, 6, 12]} />
      <meshStandardMaterial color="#3b4a6b" roughness={0.7} />
    </mesh>
  );
}

/** Model-load error boundary: missing/failed GLB → capsule, never dead scene. */
class RiderErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <CapsuleRider /> : this.props.children;
  }
}

/**
 * Minimal handlebar silhouette for first-person view — a real scene group
 * (not a camera child), repositioned from the camera each frame. Width .6,
 * low edge of frame, unlit so it reads in both worlds.
 */
export function FirstPersonBars() {
  const groupRef = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    group.quaternion.copy(camera.quaternion);
    _offset.set(0, -0.3, -0.8).applyQuaternion(camera.quaternion).add(camera.position);
    group.position.copy(_offset);
  });
  return (
    <group ref={groupRef}>
      {/* bar, rotated so the cylinder axis runs along X */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.024, 0.024, 0.6, 8]} />
        <meshBasicMaterial color="#2a2f3a" />
      </mesh>
      {/* stem, angled down-forward */}
      <mesh position={[0, -0.07, -0.04]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.18, 8]} />
        <meshBasicMaterial color="#2a2f3a" />
      </mesh>
    </group>
  );
}

export function LabRider({
  curve,
  playback,
  cadence,
  hidden,
}: {
  curve: CatmullRomCurve3;
  playback: MutableRefObject<LabPlayback>;
  cadence: number;
  hidden: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const rigRef = useRef<Group>(null);
  const pedalPhaseRef = useRef(0);
  const wheelAngleRef = useRef(0);
  /** Clock fed to AnimatedModel's mixer — identical pose per second value. */
  const animationTimeRef = useRef(0);
  const poseCyclist = useCyclistPose(rigRef, pedalPhaseRef);
  const shadowTex = useShadowTexture();
  useEffect(() => () => shadowTex.dispose(), [shadowTex]);

  const avatar = useMemo(() => resolveAvatar(), []);
  const cadenceRef = useRef(cadence);
  useEffect(() => {
    cadenceRef.current = cadence;
  }, [cadence]);

  // Priority −2: after PlaybackDriver (−3) so `seconds` is current, before
  // camera (−1) and the bike/mixer (0) so the pose they see is this frame's.
  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const u = labProgress(playback.current.seconds);
    curve.getPointAt(u, _point);
    curve.getTangentAt(u, _tangent);
    if (!Number.isFinite(_point.x) || !Number.isFinite(_tangent.x)) return;
    group.position.copy(_point);
    group.position.y += BIKE_DECK_OFFSET;
    _look.copy(group.position).add(_tangent);
    group.lookAt(_look);

    // Crank + clip time both derive from the clock — deterministic, pauses.
    const phase = playback.current.seconds * (cadenceRef.current / 60) * Math.PI * 2;
    pedalPhaseRef.current = phase;
    wheelAngleRef.current = phase * 2.6;
    animationTimeRef.current = playback.current.seconds;
  }, -2);

  return (
    <group ref={groupRef} visible={!hidden}>
      {/* Contact shadow — small soft decal, no halo, no trail. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -BIKE_DECK_OFFSET + 0.006, 0]}>
        <planeGeometry args={[2.6, 3.4]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
      <group ref={rigRef} scale={1.25}>
        <ProceduralBike
          phaseRef={pedalPhaseRef}
          wheelAngleRef={wheelAngleRef}
          frameColor="#2a3550"
          accentColor="#ffd9a0"
        />
        {avatar?.clips?.length ? (
          <RiderErrorBoundary>
            <AnimatedModel
              url={avatar.modelUrl}
              clips={avatar.clips}
              activeClip="idle"
              scale={RIG.characterScale}
              position={RIG.characterOffset}
              onAfterUpdate={poseCyclist}
              timeRef={animationTimeRef}
            />
          </RiderErrorBoundary>
        ) : (
          <CapsuleRider />
        )}
      </group>
    </group>
  );
}
