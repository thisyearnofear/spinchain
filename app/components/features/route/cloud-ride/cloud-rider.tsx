"use client";

/**
 * Cloud rider — the local Mint character (rider-idle.glb) cloned, toon-
 * shaded with its golden map kept, fixed seated reference at clip t=.6s,
 * then deterministic IK. Plus the chunky mint bike (same RIG geometry,
 * balloon tyres) and a coral scarf that waves with effort.
 */

import { Component, Suspense, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useGLTF } from "@react-three/drei";
import {
  AnimationMixer,
  BufferAttribute,
  Matrix4,
  BufferGeometry,
  CanvasTexture,
  Group,
  MeshToonMaterial,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type CatmullRomCurve3,
  type Material,
  type Object3D,
} from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BIKE_DECK_OFFSET, RIG, useCyclistPose } from "../procedural-cyclist";
import { cloudFrameAt, type CloudFrame } from "./cloud-geometry";
import { toonGradientMap } from "./cloud-materials";
import type { CloudPlayback } from "./sequence";

const RIDER_URL = "/characters/rider-idle.glb";
// The toon rider suspends on this file in both harness and production —
// warm the fetch at module load so the rig rarely suspends at all.
useGLTF.preload(RIDER_URL);
const _frame: CloudFrame = { point: new Vector3(), tangent: new Vector3(), side: new Vector3(), up: new Vector3(), bank: 0 };
const _neg = new Vector3();
const _basis = new Matrix4();
const _q = new Quaternion();

// ─── Chunky bike (RIG-compatible dimensions) ───────────────────────

const UP = new Vector3(0, 1, 0);

function Tube({ from, to, radius = 0.07, color, rough = 0.6, xOffset = 0 }: { from: Vector3; to: Vector3; radius?: number; color: string; rough?: number; xOffset?: number }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = from.clone();
    const b = to.clone();
    a.x += xOffset;
    b.x += xOffset;
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new Quaternion().setFromUnitVectors(UP, dir.normalize());
    return { position: a.add(b).multiplyScalar(0.5), quaternion: q, length: len };
  }, [from, to, xOffset]);
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
}

function BalloonWheel({ position, spinRef }: { position: Vector3; spinRef: MutableRefObject<Group | null> }) {
  return (
    <group position={position}>
      {/* Cream balloon tyre */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[RIG.wheelRadius - 0.05, 0.07, 12, 36]} />
        <meshStandardMaterial color="#fff4dd" roughness={0.8} />
      </mesh>
      {/* Pearl-pink disc — cylinder axis along X (lies in the YZ plane). */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[RIG.wheelRadius - 0.13, RIG.wheelRadius - 0.13, 0.03, 28]} />
        <meshStandardMaterial color="#ffd9e8" roughness={0.45} />
      </mesh>
      <group ref={spinRef}>
        {[0, 1, 2].map((i) => {
          const a = (i * Math.PI * 2) / 3;
          return (
            <mesh key={i} position={[0.025, 0.25 * Math.cos(a), 0.25 * Math.sin(a)]}>
              <sphereGeometry args={[0.05, 10, 8]} />
              <meshStandardMaterial color="#e88aa8" roughness={0.5} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function CloudBike({ phaseRef, wheelAngleRef }: { phaseRef: MutableRefObject<number>; wheelAngleRef: MutableRefObject<number> }) {
  const rearSpin = useRef<Group>(null);
  const frontSpin = useRef<Group>(null);
  const crankSpin = useRef<Group>(null);
  useFrame(() => {
    if (rearSpin.current) rearSpin.current.rotation.x = wheelAngleRef.current;
    if (frontSpin.current) frontSpin.current.rotation.x = wheelAngleRef.current;
    if (crankSpin.current) crankSpin.current.rotation.x = phaseRef.current;
  });
  const mint = "#9be8db";
  const coral = "#ff8a7a";
  const bb = RIG.bottomBracket;
  return (
    <group>
      <BalloonWheel position={RIG.rearAxle} spinRef={rearSpin} />
      <BalloonWheel position={RIG.frontAxle} spinRef={frontSpin} />
      {/* Chunky mint frame */}
      <Tube from={bb} to={RIG.seatCluster} color={mint} />
      <Tube from={RIG.seatCluster} to={RIG.headTop} color={mint} />
      <Tube from={bb} to={RIG.headBottom} color={mint} radius={0.078} />
      <Tube from={RIG.headBottom} to={RIG.headTop} color={mint} />
      <Tube from={bb} to={RIG.rearAxle} color={mint} radius={0.045} xOffset={0.07} />
      <Tube from={bb} to={RIG.rearAxle} color={mint} radius={0.045} xOffset={-0.07} />
      <Tube from={RIG.seatCluster} to={RIG.rearAxle} color={mint} radius={0.04} xOffset={0.06} />
      <Tube from={RIG.seatCluster} to={RIG.rearAxle} color={mint} radius={0.04} xOffset={-0.06} />
      <Tube from={RIG.headBottom} to={RIG.frontAxle} color={mint} radius={0.05} xOffset={0.06} />
      <Tube from={RIG.headBottom} to={RIG.frontAxle} color={mint} radius={0.05} xOffset={-0.06} />
      {/* Compact cream fairing inside the main triangle */}
      <mesh position={[0, 0.75, 0.2]} scale={[0.16, 0.34, 0.5]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#fff0cc" roughness={0.7} />
      </mesh>
      {/* Coral saddle + grips */}
      <Tube from={RIG.seatCluster} to={RIG.saddle.clone().add(new Vector3(0, -0.03, 0.01))} color={coral} radius={0.03} />
      <mesh position={RIG.saddle}>
        <boxGeometry args={[0.15, 0.06, 0.32]} />
        <meshStandardMaterial color={coral} roughness={0.7} />
      </mesh>
      <Tube from={RIG.headTop} to={RIG.barCenter} color={coral} radius={0.03} />
      <Tube
        from={RIG.barCenter.clone().setX(RIG.gripHalfWidth + 0.05)}
        to={RIG.barCenter.clone().setX(-RIG.gripHalfWidth - 0.05)}
        color={coral}
        radius={0.03}
      />
      {/* Crankset */}
      <group position={bb}>
        <group ref={crankSpin}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.03, 20]} />
            <meshStandardMaterial color="#fff0cc" metalness={0.4} roughness={0.4} />
          </mesh>
          {([1, -1] as const).map((side) => (
            <group key={side} rotation={[side === 1 ? 0 : Math.PI, 0, 0]}>
              <mesh position={[side * (RIG.pedalHalfWidth - 0.05), RIG.crankLength / 2, 0]}>
                <boxGeometry args={[0.035, RIG.crankLength, 0.05]} />
                <meshStandardMaterial color="#d9d2c8" metalness={0.5} roughness={0.4} />
              </mesh>
              <mesh position={[side * RIG.pedalHalfWidth, RIG.crankLength, 0]}>
                <boxGeometry args={[0.12, 0.035, 0.1]} />
                <meshStandardMaterial color={coral} roughness={0.55} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

// ─── Scarf ─────────────────────────────────────────────────────────

function Scarf({ timeRef, effortRef, reducedMotion }: { timeRef: MutableRefObject<number>; effortRef: MutableRefObject<number>; reducedMotion: boolean }) {
  const geoRef = useRef<BufferGeometry>(null);
  const SEGS = 12;
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new Float32Array((SEGS + 1) * 2 * 3);
    const idx: number[] = [];
    for (let i = 0; i < SEGS; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const pos = geoRef.current?.getAttribute("position") ?? geometry.getAttribute("position");
    const t = timeRef.current;
    const amp = reducedMotion ? 0 : 0.03 + 0.06 * effortRef.current;
    for (let i = 0; i <= SEGS; i++) {
      const k = i / SEGS;
      const wave = Math.sin(t * 6 + i * 0.7) * amp * k;
      const droop = -0.08 * k * k;
      const width = 0.12 * (1 - k * 0.7);
      // Rig space: from the shoulder top (y≈2.0) streaming back ~0.95.
      pos.setXYZ(i * 2, 0.1 + wave * 0.4, 2.0 + droop, -0.22 - k * 0.95);
      pos.setXYZ(i * 2 + 1, 0.1 + wave * 0.4 - width, 1.97 + droop + wave, -0.22 - k * 0.95);
    }
    pos.needsUpdate = true;
  });
  return (
    <mesh geometry={geometry} ref={undefined}>
      <meshStandardMaterial color="#ff8a7a" roughness={0.85} side={2} />
    </mesh>
  );
}

// ─── Rider assembly ────────────────────────────────────────────────

function ToonRider({ phaseRef, leanRef, rigRef, url = RIDER_URL }: { phaseRef: MutableRefObject<number>; leanRef: MutableRefObject<number>; rigRef: MutableRefObject<Group | null>; url?: string }) {
  const { scene, animations } = useGLTF(url);
  const poseCyclist = useCyclistPose(rigRef, phaseRef, leanRef, true);
  const gradient = useMemo(() => toonGradientMap(), []);

  const { clone, mixer, head } = useMemo(() => {
    const c = skeletonClone(scene);
    // Restyle cloned materials: toon ramp keeps the golden map as colour.
    const materials: Material[] = [];
    c.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh) {
        const m = o as SkinnedMesh;
        const src = Array.isArray(m.material) ? m.material : [m.material];
        const toon = src.map((mat) => {
          const t = new MeshToonMaterial({
            map: (mat as { map?: unknown }).map as never,
            color: "#ffffff",
            gradientMap: gradient,
          });
          materials.push(t);
          return t;
        });
        m.material = toon.length === 1 ? toon[0] : toon;
      }
    });
    const mx = new AnimationMixer(c);
    if (animations[0]) mx.clipAction(animations[0]).play();
    const headBone = c.getObjectByName("Head") ?? null;
    if (headBone) headBone.userData.baseScale = headBone.scale.clone();
    // Stash for disposal.
    (c as Object3D & { userData: Record<string, unknown> }).userData.toonMaterials = materials;
    return { clone: c, mixer: mx, head: headBone };
  }, [scene, animations, gradient]);

  useEffect(
    () => () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clone);
      ((clone as Object3D).userData.toonMaterials as Material[] | undefined)?.forEach((m) => m.dispose());
    },
    [clone, mixer],
  );
  useEffect(() => () => gradient.dispose(), [gradient]);

  const afterRef = useRef(poseCyclist);
  useEffect(() => {
    afterRef.current = poseCyclist;
  }, [poseCyclist]);

  useFrame(() => {
    // Fixed seated reference at clip t=.6s, then deterministic IK.
    mixer.setTime(0.6);
    clone.updateWorldMatrix(true, true);
    // Helmet reads a touch larger — apply AFTER the mixer sample, before IK.
    if (head) {
      const base = head.userData.baseScale as Vector3;
      head.scale.set(base.x * 1.14, base.y * 1.14, base.z * 1.14);
      head.updateMatrixWorld(true);
    }
    afterRef.current(clone);
  });

  return <primitive object={clone} scale={RIG.characterScale} position={RIG.characterOffset} />;
}

class CloudRiderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <FallbackRider /> : this.props.children;
  }
}

function FallbackRider() {
  return (
    <group>
      <Html position={[0, 2.4, 0]} center>
        <div role="status" style={{ color: "#fff", background: "rgba(40,28,60,.8)", padding: "4px 10px", borderRadius: 8, fontSize: 11, whiteSpace: "nowrap" }}>
          Rider model unavailable
        </div>
      </Html>
      <mesh position={[0, 1.05, -0.2]} rotation={[0.9, 0, 0]}>
        <capsuleGeometry args={[0.3, 0.95, 6, 12]} />
        <meshStandardMaterial color="#e8b45a" roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.62, 0.15]}>
        <sphereGeometry args={[0.22, 14, 12]} />
        <meshStandardMaterial color="#ffcf5c" roughness={0.7} />
      </mesh>
    </group>
  );
}

function useSoftShadow() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, "rgba(60,40,90,0.55)");
    g.addColorStop(1, "rgba(60,40,90,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new CanvasTexture(c);
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/**
 * The authored rider kit — soft contact shadow, chunky mint bike, scarf and
 * the toon-shaded Mint clone — with placement left to the caller. All motion
 * comes in through refs, so the harness's 45s clock and the production ride's
 * live cadence drive the same rig.
 *
 * `rigRef`/`bodyRef` are owned by the caller too: the rig group is the IK
 * space the pose solver and the bike share; the body group carries the small
 * effort rock. The caller's frame callback writes `bodyRef.rotation.z`.
 */
export function CloudRiderRig({
  rigRef,
  bodyRef,
  phaseRef,
  wheelAngleRef,
  leanRef,
  effortRef,
  timeRef,
  reducedMotion,
  url,
  children,
}: {
  rigRef: MutableRefObject<Group | null>;
  bodyRef: MutableRefObject<Group | null>;
  phaseRef: MutableRefObject<number>;
  wheelAngleRef: MutableRefObject<number>;
  leanRef: MutableRefObject<number>;
  effortRef: MutableRefObject<number>;
  timeRef: MutableRefObject<number>;
  reducedMotion: boolean;
  url?: string;
  /** Rig-space extras (e.g. the diegetic bike computer) mount on the rig. */
  children?: ReactNode;
}) {
  const shadowTex = useSoftShadow();
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -BIKE_DECK_OFFSET + 0.008, 0]}>
        <planeGeometry args={[1.5 * 2, 2.8]} />
        <meshBasicMaterial map={shadowTex} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <group ref={rigRef} scale={1.25}>
        <CloudBike phaseRef={phaseRef} wheelAngleRef={wheelAngleRef} />
        {children}
        <group ref={bodyRef}>
          <Scarf timeRef={timeRef} effortRef={effortRef} reducedMotion={reducedMotion} />
          <CloudRiderBoundary>
            {/* Local boundary: while the GLB resolves, the world keeps
                drawing — the suspension must not bubble to the outer
                Suspense and blank the canvas (the settled harness clock
                never re-renders afterwards). */}
            <Suspense fallback={null}>
              <ToonRider phaseRef={phaseRef} leanRef={leanRef} rigRef={rigRef} url={url} />
            </Suspense>
          </CloudRiderBoundary>
        </group>
      </group>
    </>
  );
}

export function CloudRider({
  curve,
  playback,
  cadence,
  effortAmount,
  reducedMotion,
}: {
  curve: CatmullRomCurve3;
  playback: MutableRefObject<CloudPlayback>;
  cadence: number;
  effortAmount: number;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const rigRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const wheelRef = useRef(0);
  const leanRef = useRef(0);
  const effortRef = useRef(effortAmount);
  const timeRef = useRef(0);
  const cadenceRef = useRef(cadence);
  useEffect(() => {
    cadenceRef.current = cadence;
  }, [cadence]);
  useEffect(() => {
    effortRef.current = effortAmount;
  }, [effortAmount]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const u = Math.min(0.999, playback.current.seconds / 45 * 0.87 + 0.065);
    cloudFrameAt(curve, u, _frame, !reducedMotion);
    // Same frame as the road/dashes: localX = −side, localY = banked up,
    // localZ = tangent. Wheels lifted by the balloon tyre delta (.025).
    _neg.copy(_frame.side).negate();
    _basis.makeBasis(_neg, _frame.up, _frame.tangent);
    _q.setFromRotationMatrix(_basis);
    group.quaternion.copy(_q);
    group.position.copy(_frame.point).addScaledVector(_frame.up, BIKE_DECK_OFFSET + 0.025);

    phaseRef.current = playback.current.pedalPhase;
    wheelRef.current = playback.current.pedalPhase * 2.6;
    timeRef.current = playback.current.seconds;
    // Effort tucks the torso (≤.12 rad) via IK only — the bike/wheels stay
    // planted; a small body roll (≤.02) lives on the body group, not the rig.
    const rock = reducedMotion ? 0 : Math.sin(playback.current.pedalPhase) * 0.02 * effortRef.current;
    leanRef.current = effortRef.current * 0.12;
    if (bodyRef.current) bodyRef.current.rotation.z = rock;
  }, -2);

  return (
    <group ref={groupRef}>
      <CloudRiderRig
        rigRef={rigRef}
        bodyRef={bodyRef}
        phaseRef={phaseRef}
        wheelAngleRef={wheelRef}
        leanRef={leanRef}
        effortRef={effortRef}
        timeRef={timeRef}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}
