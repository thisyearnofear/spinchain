"use client";

/**
 * Procedural cyclist for the 3D route world.
 *
 * Two pieces, sharing one rig space:
 *
 *   1. <ProceduralBike> — a road bike built from primitives whose geometry
 *      follows a real 52–56cm road frame (73° seat/head angles, 68mm BB
 *      drop, 172.5mm cranks, 700c wheels at 1 unit ≈ 0.67m). Wheels, cranks
 *      and chainring spin from the shared pedal phase; pedals stay level.
 *   2. useCyclistPose() — a post-animation pass for <AnimatedModel> that
 *      *fits the rider to the bike from their own proportions* and then
 *      runs analytic two-bone IK:
 *        • hips are pinned where a bike fitter would put them — the knee
 *          reaches ~145° at bottom-dead-centre given the avatar's femur,
 *          tibia and foot (saddle height), set back behind the BB (KOPS);
 *        • the torso angle is solved so the hands reach the hoods with a
 *          soft elbow bend (~40° to the horizontal for the default rider);
 *        • feet "ankle" through the stroke (toe-down through the power
 *          phase, flatter over the top), hands land palm-down on the hoods.
 *      The clip underneath (Mint seated idle or Meshy pedaling) keeps
 *      breathing, pelvis rock and shoulder motion; only the fit and the
 *      limbs are overridden.
 *
 * Rig space (all numbers below): origin on the road deck under the bottom
 * bracket, +Z forward along the route, +Y up, +X = rider's left. The rigs
 * face +Z, so no yaw flip is needed.
 *
 * Meshy's image-to-3D bike (bike-meshy-rig.glb) is a merged single mesh and
 * a visibly cruder copy of this one (it was generated from a render of it),
 * so it ships only as garage equipment ("mesh-cycle").
 */

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CatmullRomCurve3,
  Group,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  SkinnedMesh,
  TubeGeometry,
  Vector3,
} from "three";

// ─── Rig geometry (rig space, see header) ──────────────────────────
//
// 1 unit ≈ 0.67m (the 1.5× Mint rider stands 2.6 units ≈ 1.75m), so a 700c
// wheel is r 0.51, a 990mm wheelbase is 1.52, 68mm BB drop is 0.10.
const ST_DIR = new Vector3(0, Math.sin((73 * Math.PI) / 180), -Math.cos((73 * Math.PI) / 180)); // seat tube, up & back

export const RIG = {
  wheelRadius: 0.51,
  rearAxle: new Vector3(0, 0.51, -0.62),
  frontAxle: new Vector3(0, 0.51, 0.9),
  bottomBracket: new Vector3(0, 0.41, 0),
  crankLength: 0.26,
  pedalHalfWidth: 0.16,
  /** Top of the seat tube (compact sloping frame). */
  seatCluster: new Vector3(0, 1.0, -0.18),
  headTop: new Vector3(0, 1.25, 0.6),
  headBottom: new Vector3(0, 1.03, 0.68),
  /** Stem clamp — the drop bar's tops run through here (+17° stem). */
  stemClamp: new Vector3(0, 1.32, 0.66),
  /** Hoods centre: the hands land at ±gripHalfWidth of this. */
  barCenter: new Vector3(0, 1.315, 0.76),
  gripHalfWidth: 0.2,
  /** Default saddle (the fit for the Mint rider); overridden per avatar via fitRef. */
  saddle: new Vector3(0, 1.33, -0.26),
  /** Stem-top computer mount. */
  computerMount: new Vector3(0, 1.36, 0.6),
  /** Character GLB scale the fit constants were tuned at. */
  characterScale: 1.5,
  /** Initial character root; the pose pass re-pins the hips every frame. */
  characterOffset: [0, 0.15, -0.13] as [number, number, number],
  /** Fallback torso angle above horizontal when a rig has no arm bones. */
  torsoAngle: 0.7,
} as const;

/** Rig-space height of the bottom of the wheels above the road deck. */
export const BIKE_DECK_OFFSET = 0.02;

/** Anchors the pose pass needs — defaults reproduce the procedural bike. */
export interface BikeProfile {
  bottomBracket: Vector3;
  crankLength: number;
  pedalHalfWidth: number;
  barCenter: Vector3;
  gripHalfWidth: number;
}

export const DEFAULT_BIKE_PROFILE: BikeProfile = {
  bottomBracket: RIG.bottomBracket,
  crankLength: RIG.crankLength,
  pedalHalfWidth: RIG.pedalHalfWidth,
  barCenter: RIG.barCenter,
  gripHalfWidth: RIG.gripHalfWidth,
};

/** Pedal (spindle) position in rig space for a crank phase. φ=0 is top dead centre. */
function pedalPosition(
  phase: number,
  side: 1 | -1,
  out: Vector3,
  profile: BikeProfile = DEFAULT_BIKE_PROFILE,
): Vector3 {
  return out.set(
    side * profile.pedalHalfWidth,
    profile.bottomBracket.y + Math.cos(phase) * profile.crankLength,
    profile.bottomBracket.z + Math.sin(phase) * profile.crankLength,
  );
}

// ─── Bike fit (anthropometric) ─────────────────────────────────────
//
// Numbers from standard road fitting practice: knee 140–150° at BDC sets
// saddle height; the hip sits behind the BB (KOPS); torso 40–50° to the
// horizontal on the hoods with a soft elbow bend.

/** Knee angle at bottom dead centre (interior angle, radians). */
const KNEE_BDC = (145 * Math.PI) / 180;
/** Hip joint centre setback behind the BB (rig units). */
const HIP_SETBACK = 0.22;
/** Saddle top sits this far below the hip joint centre. */
const SADDLE_BELOW_HIP = 0.13;
/** Pedal body + shoe sole stack between spindle and the ball of the foot. */
const PEDAL_STACK = 0.05;
/** Fraction of full arm length used for the hoods reach (soft elbow). */
const ARM_REACH = 0.96;
/** Wrist sits this far behind / above the hood so the palm rests on top of it. */
const WRIST_BACK = 0.07;
const WRIST_UP = 0.045;

/** Toe-down pitch added through the stroke: flatter over the top, plantar-flexed through BDC. */
function anklePitch(phase: number) {
  return 0.18 - 0.15 * Math.cos(phase);
}

export interface RiderFit {
  /** Hip joint centre (midpoint of the two hip joints), rig space. */
  hip: Vector3;
  /** Saddle top, rig space — the bike's seatpost follows this. */
  saddle: Vector3;
  /** Torso angle above the horizontal (radians) that lands hands on the hoods. */
  torsoAngle: number;
}

interface Segments {
  femur: number;
  tibia: number;
  footLen: number;
  /** Pitch (radians below horizontal) of the ankle→ball vector when the foot is flat. */
  footRestPitch: number;
  upperArm: number;
  forearm: number;
  /** Hip joint centre → shoulder centre (the trunk a bike fitter measures). */
  torso: number;
}

function computeFit(seg: Segments, profile: BikeProfile): RiderFit {
  const bb = profile.bottomBracket;
  // Ankle at BDC: ball of the foot on the spindle (plus stack), toe down.
  const ballY = bb.y - profile.crankLength + PEDAL_STACK;
  const a = seg.footRestPitch + anklePitch(Math.PI);
  const ankleY = ballY + seg.footLen * Math.sin(a);
  const ankleZ = bb.z - seg.footLen * Math.cos(a);
  const legReach = Math.sqrt(
    seg.femur * seg.femur + seg.tibia * seg.tibia - 2 * seg.femur * seg.tibia * Math.cos(KNEE_BDC),
  );
  const hipZ = bb.z - HIP_SETBACK;
  const dz = hipZ - ankleZ;
  const hipY = ankleY + Math.sqrt(Math.max(0, legReach * legReach - dz * dz));
  const hip = new Vector3(0, hipY, hipZ);
  const saddle = new Vector3(0, hipY - SADDLE_BELOW_HIP, hipZ - 0.04);

  // Torso: shoulder centre S on a circle of radius `torso` around the hip
  // centre P, at arm-reach R from the wrist target H. Circle–circle
  // intersection in the sagittal (Y,Z) plane, upper solution.
  const py = hipY;
  const pz = hipZ;
  const hy = profile.barCenter.y + WRIST_UP;
  const hz = profile.barCenter.z - WRIST_BACK;
  const R = ARM_REACH * (seg.upperArm + seg.forearm);
  const T = seg.torso;
  const dY = hy - py;
  const dZ = hz - pz;
  const d = Math.hypot(dY, dZ);
  let torsoAngle: number = RIG.torsoAngle;
  if (T > 0 && d > 1e-6) {
    if (d >= T + R) {
      torsoAngle = Math.atan2(dY, dZ); // can't reach: point the torso at the bars
    } else {
      const along = (T * T - R * R + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, T * T - along * along));
      const uy = dY / d;
      const uz = dZ / d;
      // Perpendicular that raises the shoulders (positive Y component).
      const ny = uz;
      const nz = -uy;
      const sign = ny >= 0 ? 1 : -1;
      const sy = along * uy + sign * h * ny;
      const sz = along * uz + sign * h * nz;
      torsoAngle = Math.atan2(sy, sz);
    }
  }
  return { hip, saddle, torsoAngle };
}

// ─── Bike ──────────────────────────────────────────────────────────

const _up = new Vector3(0, 1, 0);

/** Thin cylinder spanning two rig-space points. */
function Tube({
  from,
  to,
  radius = 0.028,
  color,
  emissive,
  xOffset = 0,
  metalness = 0.55,
  roughness = 0.32,
}: {
  from: Vector3;
  to: Vector3;
  radius?: number;
  color: string;
  emissive?: string;
  xOffset?: number;
  metalness?: number;
  roughness?: number;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = from.clone();
    const b = to.clone();
    a.x += xOffset;
    b.x += xOffset;
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new Quaternion().setFromUnitVectors(_up, dir.normalize());
    return { position: a.add(b).multiplyScalar(0.5), quaternion: q, length: len };
  }, [from, to, xOffset]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 10]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? color}
        emissiveIntensity={emissive ? 0.6 : 0.12}
        metalness={metalness}
        roughness={roughness}
      />
    </mesh>
  );
}

/** Tube swept along a smooth curve through `points` (rig space). */
function SweptTube({
  points,
  radius,
  color,
  closed = false,
  segments = 32,
  metalness = 0.6,
  roughness = 0.35,
}: {
  points: Vector3[];
  radius: number;
  color: string;
  closed?: boolean;
  segments?: number;
  metalness?: number;
  roughness?: number;
}) {
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3(points, closed, "centripetal");
    return new TubeGeometry(curve, segments, radius, 8, closed);
  }, [points, radius, closed, segments]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  );
}

function Wheel({
  position,
  spinRef,
  rimColor,
  cassette,
}: {
  position: Vector3;
  spinRef: MutableRefObject<Group | null>;
  rimColor: string;
  cassette?: boolean;
}) {
  const spokes = useMemo(() => Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 8), []);
  return (
    <group position={position}>
      {/* Tyre + rim: torus lies in XY with axis Z — turn it so the axle is X. */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[RIG.wheelRadius - 0.015, 0.03, 12, 48]} />
        <meshStandardMaterial color="#14161c" roughness={0.92} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[RIG.wheelRadius - 0.05, 0.013, 8, 48]} />
        <meshStandardMaterial color={rimColor} emissive={rimColor} emissiveIntensity={0.7} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Spokes + hub spin with the wheel so speed reads at a glance. */}
      <group ref={spinRef}>
        {spokes.map((angle) => (
          <mesh key={angle} rotation={[angle, 0, 0]}>
            <boxGeometry args={[0.005, (RIG.wheelRadius - 0.055) * 2, 0.005]} />
            <meshStandardMaterial color="#d4d8e0" metalness={0.85} roughness={0.25} />
          </mesh>
        ))}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.028, 0.028, 0.11, 14]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.3} />
        </mesh>
        {cassette &&
          [0.075, 0.066, 0.057, 0.048].map((r, i) => (
            <mesh key={r} position={[-0.055 - i * 0.012, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[r, r, 0.007, 24]} />
              <meshStandardMaterial color="#b8bec8" metalness={0.9} roughness={0.3} />
            </mesh>
          ))}
      </group>
    </group>
  );
}

/** Chain loop around two sprockets in the sagittal plane at x. */
function chainPoints(c1: Vector3, r1: number, c2: Vector3, r2: number, x: number): Vector3[] {
  const dz = c2.z - c1.z;
  const dy = c2.y - c1.y;
  const d = Math.hypot(dz, dy);
  const base = Math.atan2(dy, dz);
  const off = Math.acos((r1 - r2) / d);
  const pts: Vector3[] = [];
  const at = (c: Vector3, r: number, a: number) => new Vector3(x, c.y + r * Math.sin(a), c.z + r * Math.cos(a));
  const arc = (c: Vector3, r: number, a0: number, a1: number, n: number) => {
    for (let i = 0; i <= n; i++) pts.push(at(c, r, a0 + ((a1 - a0) * i) / n));
  };
  const line = (a: Vector3, b: Vector3, n: number) => {
    for (let i = 1; i < n; i++) pts.push(a.clone().lerp(b, i / n));
  };
  // Around the chainring (away from the cassette), down the bottom run,
  // around the cassette, back along the top run.
  arc(c1, r1, base + off, base - off + Math.PI * 2, 36);
  line(at(c1, r1, base - off), at(c2, r2, base - off), 10);
  arc(c2, r2, base - off, base + off, 12);
  line(at(c2, r2, base + off), at(c1, r1, base + off), 10);
  return pts;
}

export interface ProceduralBikeProps {
  /** Crank phase in radians, advanced by the caller from live cadence. */
  phaseRef: MutableRefObject<number>;
  /** Wheel rotation in radians, advanced by the caller. */
  wheelAngleRef: MutableRefObject<number>;
  frameColor: string;
  accentColor: string;
  /** Rider fit from useCyclistPose — the seatpost/saddle follow it. */
  fitRef?: MutableRefObject<RiderFit | null>;
}

const DRIVE_X = -0.095; // drivetrain on the rider's right

export function ProceduralBike({ phaseRef, wheelAngleRef, frameColor, accentColor, fitRef }: ProceduralBikeProps) {
  const rearSpin = useRef<Group>(null);
  const frontSpin = useRef<Group>(null);
  const crankSpin = useRef<Group>(null);
  const pedalL = useRef<Group>(null);
  const pedalR = useRef<Group>(null);
  const saddleRef = useRef<Group>(null);
  const postRef = useRef<Mesh>(null);

  const bb = RIG.bottomBracket;
  const geo = useMemo(() => {
    const c = RIG.stemClamp;
    const bar = (s: 1 | -1) => [
      new Vector3(s * 0.05, c.y, c.z),
      new Vector3(s * 0.2, c.y, c.z),
      new Vector3(s * 0.21, c.y + 0.004, c.z + 0.07),
      new Vector3(s * 0.21, c.y - 0.005, c.z + 0.11),
      new Vector3(s * 0.21, c.y - 0.06, c.z + 0.13),
      new Vector3(s * 0.21, c.y - 0.13, c.z + 0.08),
      new Vector3(s * 0.21, c.y - 0.14, c.z - 0.01),
    ];
    return {
      barL: bar(1),
      barR: bar(-1),
      barTops: { from: new Vector3(-0.2, c.y, c.z), to: new Vector3(0.2, c.y, c.z) },
      chain: chainPoints(bb, 0.13, RIG.rearAxle, 0.06, DRIVE_X),
      postDir: ST_DIR.clone(),
      bottleFrom: bb.clone().lerp(RIG.headBottom, 0.42).add(new Vector3(0, 0.055, -0.03)),
      bottleTo: bb.clone().lerp(RIG.headBottom, 0.68).add(new Vector3(0, 0.055, -0.03)),
    };
  }, [bb]);

  useFrame(() => {
    const w = wheelAngleRef.current;
    if (rearSpin.current) rearSpin.current.rotation.x = w;
    if (frontSpin.current) frontSpin.current.rotation.x = w;
    // Crank arm geometry points +Y at rotation 0; rotating about +X by φ
    // moves it toward +Z — the same convention as pedalPosition().
    const phase = phaseRef.current;
    if (crankSpin.current) crankSpin.current.rotation.x = phase;
    // Pedals hang level on their spindles.
    if (pedalL.current) pedalL.current.rotation.x = -phase;
    if (pedalR.current) pedalR.current.rotation.x = -phase - Math.PI;

    // Seatpost + saddle follow the rider's fit.
    const saddle = fitRef?.current?.saddle ?? RIG.saddle;
    if (saddleRef.current) saddleRef.current.position.copy(saddle);
    if (postRef.current) {
      // Post runs from the seat cluster along the seat tube to under the rails.
      const len = Math.max(0.05, _fitTmp.subVectors(saddle, RIG.seatCluster).dot(geo.postDir) - 0.03);
      postRef.current.position.copy(RIG.seatCluster).addScaledVector(geo.postDir, len / 2);
      postRef.current.scale.y = len;
    }
  });

  const postQuat = useMemo(() => new Quaternion().setFromUnitVectors(_up, geo.postDir), [geo.postDir]);

  return (
    <group>
      <Wheel position={RIG.rearAxle} spinRef={rearSpin} rimColor={accentColor} cassette />
      <Wheel position={RIG.frontAxle} spinRef={frontSpin} rimColor={accentColor} />

      {/* Main triangle */}
      <Tube from={bb} to={RIG.seatCluster} color={frameColor} radius={0.03} />
      <Tube from={RIG.seatCluster} to={RIG.headTop} color={frameColor} radius={0.028} />
      <Tube from={bb} to={RIG.headBottom} color={frameColor} radius={0.036} />
      <Tube from={RIG.headBottom} to={RIG.headTop} color={frameColor} radius={0.038} />
      {/* BB shell */}
      <mesh position={bb} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.14, 16]} />
        <meshStandardMaterial color={frameColor} metalness={0.55} roughness={0.32} />
      </mesh>
      {/* Rear triangle (both sides) */}
      <Tube from={bb} to={RIG.rearAxle} color={frameColor} radius={0.017} xOffset={0.06} />
      <Tube from={bb} to={RIG.rearAxle} color={frameColor} radius={0.017} xOffset={-0.06} />
      <Tube from={RIG.seatCluster} to={RIG.rearAxle} color={frameColor} radius={0.014} xOffset={0.05} />
      <Tube from={RIG.seatCluster} to={RIG.rearAxle} color={frameColor} radius={0.014} xOffset={-0.05} />
      {/* Fork */}
      <Tube from={RIG.headBottom} to={RIG.frontAxle} color={frameColor} radius={0.019} xOffset={0.05} />
      <Tube from={RIG.headBottom} to={RIG.frontAxle} color={frameColor} radius={0.019} xOffset={-0.05} />
      {/* Bottle on the down tube */}
      <Tube from={geo.bottleFrom} to={geo.bottleTo} color="#e5e7eb" radius={0.036} metalness={0.1} roughness={0.5} />

      {/* Seat post + saddle (positions driven from fitRef in useFrame) */}
      <mesh ref={postRef} quaternion={postQuat}>
        <cylinderGeometry args={[0.016, 0.016, 1, 10]} />
        <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.3} />
      </mesh>
      <group ref={saddleRef} position={RIG.saddle}>
        {/* Saddle: wide rear + narrow nose. */}
        <mesh position={[0, -0.02, -0.06]} scale={[0.13, 0.03, 0.15]}>
          <sphereGeometry args={[1, 18, 12]} />
          <meshStandardMaterial color="#0b0f19" roughness={0.65} />
        </mesh>
        <mesh position={[0, -0.022, 0.07]} scale={[0.05, 0.026, 0.2]}>
          <sphereGeometry args={[1, 14, 10]} />
          <meshStandardMaterial color="#0b0f19" roughness={0.65} />
        </mesh>
        <mesh position={[0, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.006, 0.006, 0.08, 6]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      {/* Stem + drop bar + hoods */}
      <Tube from={RIG.headTop} to={RIG.stemClamp} color="#1f2937" radius={0.02} metalness={0.7} roughness={0.3} />
      <Tube from={geo.barTops.from} to={geo.barTops.to} color="#1f2937" radius={0.015} metalness={0.5} roughness={0.5} />
      <SweptTube points={geo.barL} radius={0.015} color="#1f2937" metalness={0.5} roughness={0.5} />
      <SweptTube points={geo.barR} radius={0.015} color="#1f2937" metalness={0.5} roughness={0.5} />
      {([1, -1] as const).map((s) => (
        <mesh key={s} position={[s * 0.21, RIG.stemClamp.y + 0.02, RIG.stemClamp.z + 0.11]} rotation={[-0.35, 0, 0]}>
          <capsuleGeometry args={[0.018, 0.05, 4, 8]} />
          <meshStandardMaterial color="#0b0f19" roughness={0.6} />
        </mesh>
      ))}

      {/* Drivetrain: chainring + chain (static loop; the ring spins) */}
      <SweptTube points={geo.chain} radius={0.007} color="#6b7280" closed segments={96} metalness={0.9} roughness={0.35} />
      <group position={bb}>
        <group ref={crankSpin}>
          <mesh position={[DRIVE_X, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.13, 0.13, 0.008, 36]} />
            <meshStandardMaterial color="#b8bec8" metalness={0.9} roughness={0.28} />
          </mesh>
          <mesh position={[DRIVE_X + 0.006, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.012, 24]} />
            <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.35} />
          </mesh>
          {([1, -1] as const).map((side) => (
            <group key={side} rotation={[side === 1 ? 0 : Math.PI, 0, 0]}>
              <mesh position={[side * (RIG.pedalHalfWidth - 0.045), RIG.crankLength / 2, 0]}>
                <boxGeometry args={[0.022, RIG.crankLength, 0.034]} />
                <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.25} />
              </mesh>
              {/* Pedal spindle + level platform (counter-rotated in useFrame). */}
              <mesh position={[side * (RIG.pedalHalfWidth - 0.01), RIG.crankLength, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.008, 0.008, 0.07, 8]} />
                <meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.3} />
              </mesh>
              <group ref={side === 1 ? pedalL : pedalR} position={[side * RIG.pedalHalfWidth, RIG.crankLength, 0]}>
                <mesh>
                  <boxGeometry args={[0.1, 0.018, 0.09]} />
                  <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.5} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

const _fitTmp = new Vector3();

// ─── Pose / IK ─────────────────────────────────────────────────────

interface CyclistBones {
  /** Torso chain frozen to one seated reference frame (see FREEZE_AFTER_FRAMES). */
  torso: Object3D[];
  frozen: Array<{ bone: Object3D; quaternion: Quaternion; position: Vector3 }> | null;
  frames: number;
  /** Trunk pivot — the pelvis (Hips) so the whole trunk tips like a rider's. */
  pivot: Object3D | null;
  head: Object3D | null;
  legs: Array<{ up: Object3D; mid: Object3D; end: Object3D; toe: Object3D | null; side: 1 | -1 }>;
  arms: Array<{ up: Object3D; mid: Object3D; end: Object3D; side: 1 | -1; palm: Vector3 | null }>;
  /** Anthropometric fit, computed on the first posed frame. */
  fit: RiderFit | null;
  /** The bike profile `fit` was solved against — re-solved if it changes. */
  fitProfile: BikeProfile | null;
  segments: Segments | null;
  /** Slow average of the clip's own torso angle, so its bob survives the fit. */
  torsoAvg: number | null;
  /** Pre/post rotation snapshots for bones we rotate relatively (see restoreIfUntouched). */
  applied: Map<Object3D, { pre: Quaternion; post: Quaternion }>;
}

const boneCache = new WeakMap<Object3D, CyclistBones | null>();

function findBones(root: Object3D): CyclistBones | null {
  if (boneCache.has(root)) return boneCache.get(root) ?? null;
  const get = (name: string) => root.getObjectByName(name) ?? null;
  const legs: CyclistBones["legs"] = [];
  const arms: CyclistBones["arms"] = [];
  // Mixamo naming; +X is the rider's left in rig space.
  for (const [prefix, side] of [["Left", 1], ["Right", -1]] as const) {
    const up = get(`${prefix}UpLeg`);
    const mid = get(`${prefix}Leg`);
    const end = get(`${prefix}Foot`);
    if (up && mid && end) legs.push({ up, mid, end, toe: get(`${prefix}ToeBase`), side });
    const aUp = get(`${prefix}Arm`);
    const aMid = get(`${prefix}ForeArm`);
    const aEnd = get(`${prefix}Hand`);
    if (aUp && aMid && aEnd) arms.push({ up: aUp, mid: aMid, end: aEnd, side, palm: bindPalmAxis(root, aEnd) });
  }
  const torso = ["Hips", "Spine02", "Spine01", "Spine", "neck", "Head", "LeftShoulder", "RightShoulder"]
    .map(get)
    .filter((b): b is Object3D => b !== null);
  const bones: CyclistBones | null =
    legs.length === 2
      ? {
          torso,
          frozen: null,
          frames: 0,
          pivot: get("Hips") ?? get("Spine02") ?? get("Spine"),
          head: get("Head"),
          legs,
          arms,
          fit: null,
          fitProfile: null,
          segments: null,
          torsoAvg: null,
          applied: new Map(),
        }
      : null;
  boneCache.set(root, bones);
  return bones;
}

// Scratch objects — the pose pass runs every frame and must not allocate.
const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _cur = new Vector3();
const _des = new Vector3();
const _dir = new Vector3();
const _pole = new Vector3();
const _knee = new Vector3();
const _target = new Vector3();
const _tmp = new Vector3();
const _root = new Vector3();
const _wTarget = new Vector3();
const _wPole = new Vector3();
const _axis = new Vector3();
const _scale = new Vector3();
const _q = new Quaternion();
const _qw = new Quaternion();
const _qRig = new Quaternion();
const _qPre = new Quaternion();
const _qp = new Quaternion();
const _m = new Matrix4();

/** Rotate `bone` (in world space) so that `child` points at `targetWorld`. */
function aimBone(bone: Object3D, child: Object3D, targetWorld: Vector3) {
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  _cur.subVectors(_b, _a);
  _des.subVectors(targetWorld, _a);
  if (_cur.lengthSq() < 1e-10 || _des.lengthSq() < 1e-10) return;
  _q.setFromUnitVectors(_cur.normalize(), _des.normalize());
  rotateBoneWorld(bone, _q);
}

/** Apply a world-space rotation to a bone, keeping it in its parent's frame. */
function rotateBoneWorld(bone: Object3D, worldRotation: Quaternion) {
  bone.getWorldQuaternion(_qw);
  _qw.premultiply(worldRotation);
  if (bone.parent) {
    bone.parent.getWorldQuaternion(_qp);
    bone.quaternion.copy(_qp.invert().multiply(_qw));
  } else {
    bone.quaternion.copy(_qw);
  }
  bone.updateMatrixWorld(true);
}

/**
 * Analytic two-bone IK: place `mid` (knee/elbow) so `end` reaches `target`,
 * bending toward `poleWorld`. Bone lengths come from the current pose.
 */
function solveTwoBone(
  up: Object3D,
  mid: Object3D,
  end: Object3D,
  target: Vector3,
  poleWorld: Vector3,
) {
  const root = up.getWorldPosition(_root);
  mid.getWorldPosition(_tmp);
  const l1 = root.distanceTo(_tmp);
  end.getWorldPosition(_b);
  const l2 = _tmp.distanceTo(_b);

  _dir.subVectors(target, root);
  let d = _dir.length();
  if (d < 1e-6) return;
  _dir.divideScalar(d);
  d = Math.min(Math.max(d, Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);

  // Knee position via law of cosines, bent toward the pole.
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  _pole.subVectors(poleWorld, root);
  _pole.addScaledVector(_dir, -_pole.dot(_dir));
  if (_pole.lengthSq() < 1e-10) return;
  _pole.normalize();
  _knee.copy(root).addScaledVector(_dir, along).addScaledVector(_pole, height);
  _target.copy(root).addScaledVector(_dir, d);

  aimBone(up, mid, _knee);
  aimBone(mid, end, _target);
}

/**
 * A relative rotation on a bone the clip doesn't animate would accumulate
 * frame over frame (optimized clips drop static tracks). If the bone still
 * holds exactly what we left last frame, the mixer didn't touch it — put
 * back the pre-rotation value first so the rotation is applied once.
 */
function restoreIfUntouched(bones: CyclistBones, bone: Object3D) {
  const rec = bones.applied.get(bone);
  if (rec && bone.quaternion.equals(rec.post)) {
    bone.quaternion.copy(rec.pre);
    bone.updateMatrixWorld(true);
  }
}
function recordApplied(bones: CyclistBones, bone: Object3D, pre: Quaternion) {
  let rec = bones.applied.get(bone);
  if (!rec) {
    rec = { pre: new Quaternion(), post: new Quaternion() };
    bones.applied.set(bone, rec);
  }
  rec.pre.copy(pre);
  rec.post.copy(bone.quaternion);
}

/**
 * Pitch of the ankle→ball vector in the skin bind pose (the foot flat on
 * the floor), from the skeleton's inverse bind matrices. Falls back to the
 * Mixamo-typical ~40° when the bones aren't skinned.
 */
function bindFootPitch(root: Object3D, foot: Object3D, toe: Object3D): number {
  let pitch = 0.7;
  root.traverse((o) => {
    const sm = o as SkinnedMesh;
    if (!sm.isSkinnedMesh || !sm.skeleton) return;
    const fi = sm.skeleton.bones.indexOf(foot as never);
    const ti = sm.skeleton.bones.indexOf(toe as never);
    if (fi < 0 || ti < 0) return;
    _m.copy(sm.skeleton.boneInverses[fi]).invert();
    _a.setFromMatrixPosition(_m);
    _m.copy(sm.skeleton.boneInverses[ti]).invert();
    _b.setFromMatrixPosition(_m);
    _c.subVectors(_b, _a);
    if (_c.lengthSq() > 1e-8) pitch = Math.atan2(-_c.y, Math.abs(_c.z));
  });
  return pitch;
}

/**
 * Hand-local axis that faced the floor in the skin bind pose — the palm
 * normal for the Mixamo-style T/A-pose these rigs are bound in (palms down).
 * Lets the pose pass roll the hand palm-down by construction instead of a
 * tuned roll that depends on each rig's wrist twist.
 */
function bindPalmAxis(root: Object3D, hand: Object3D): Vector3 | null {
  let best: Vector3 | null = null;
  let bestY = Infinity;
  root.traverse((o) => {
    const sm = o as SkinnedMesh;
    if (best || !sm.isSkinnedMesh || !sm.skeleton) return;
    const hi = sm.skeleton.bones.indexOf(hand as never);
    if (hi < 0) return;
    _m.copy(sm.skeleton.boneInverses[hi]).invert();
    _qw.setFromRotationMatrix(_m);
    for (const axis of PALM_CANDIDATES) {
      _a.copy(axis).applyQuaternion(_qw);
      if (_a.y < bestY) {
        bestY = _a.y;
        best = axis.clone();
      }
    }
  });
  // Best axis should point nearly straight down (y ≈ -1) in bind pose;
  // anything else means this rig's palm normal isn't an axis we modelled.
  if (best && bestY > -0.7) {
    console.warn(
      `[cyclist] ${hand.name}: no palm axis faces down in bind pose (best y=${bestY.toFixed(2)}) — hand roll may be off.`,
    );
  }
  return best;
}
const PALM_CANDIDATES = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
];

/** Measure the avatar's segment lengths in rig units from the current pose. */
function measureSegments(root: Object3D, bones: CyclistBones, rig: Object3D): Segments {
  rig.getWorldScale(_scale);
  const s = 1 / (_scale.x || 1);
  const dist = (p: Object3D, q: Object3D) => p.getWorldPosition(_a).distanceTo(q.getWorldPosition(_b)) * s;
  const leg = bones.legs[0];
  const arm = bones.arms[0];
  const femur = dist(leg.up, leg.mid);
  const tibia = dist(leg.mid, leg.end);
  const footLen = leg.toe ? dist(leg.end, leg.toe) : 0.2;
  const footRestPitch = leg.toe ? bindFootPitch(root, leg.end, leg.toe) : 0.7;
  const upperArm = arm ? dist(arm.up, arm.mid) : 0.32;
  const forearm = arm ? dist(arm.mid, arm.end) : 0.34;
  // Trunk: hip joint centre → shoulder centre.
  let torso = 0.75;
  if (bones.arms.length === 2) {
    bones.legs[0].up.getWorldPosition(_a);
    bones.legs[1].up.getWorldPosition(_b);
    _c.copy(_a).add(_b).multiplyScalar(0.5);
    bones.arms[0].up.getWorldPosition(_a);
    bones.arms[1].up.getWorldPosition(_b);
    torso = _a.add(_b).multiplyScalar(0.5).distanceTo(_c) * s;
  }
  return { femur, tibia, footLen, footRestPitch, upperArm, forearm, torso };
}

/** Frames to let the clip fade in before freezing the torso reference. */
const FREEZE_AFTER_FRAMES = 30;

/** Hand pitch below horizontal on the hoods — fingers drape over the front (radians). */
const HAND_PITCH = 0.55;
/** Extra head pitch-up on top of undoing the trunk lean (radians). */
const HEAD_LIFT = 0.1;

/** How fast the measured clip torso angle is averaged (per frame). */
const TORSO_AVG_RATE = 0.04;
/** Fraction of the clip's own torso swing kept around the fitted angle — the
 *  Meshy pedaling clips rock ~20°, a real seated rider only a few degrees. */
const TORSO_BOB_KEEP = 0.3;

// Rig-space scratch
const _rigPedal = new Vector3();
const _rigHip = new Vector3();
const _rigPivot = new Vector3();
const _rigShoulder = new Vector3();

export interface CyclistPoseOptions {
  /** Bike anchors; defaults to the procedural bike. */
  profile?: BikeProfile;
  /** Receives the solved fit so the bike can place its saddle. */
  fitRef?: MutableRefObject<RiderFit | null>;
}

/**
 * Returns a callback for <AnimatedModel onAfterUpdate>. `rigRef` is the
 * group that owns rig space (the bike's parent); `phaseRef` is the crank
 * phase shared with <ProceduralBike>.
 *
 * `torsoMode`:
 *  - "full" (default): freeze the torso after fade-in (clips that don't own
 *    the torso, e.g. Mint's seated idle, drift over their loop), then fit.
 *  - "clip": the clip owns the torso (Meshy pedaling clips carry their own
 *    posture and pedal-synced bob) — no freeze; the fit is applied as a
 *    correction to the clip's *average* torso angle so the bob survives.
 * In both modes the hips are pinned to the fitted saddle position, the
 * limbs are IK'd to pedals and hoods, and `leanRef` adds extra forward lean.
 */
export function useCyclistPose(
  rigRef: MutableRefObject<Group | null>,
  phaseRef: MutableRefObject<number>,
  leanRef?: MutableRefObject<number>,
  freezeReferenceImmediately = false,
  torsoMode: "full" | "clip" = "full",
  options: CyclistPoseOptions = {},
) {
  const { profile = DEFAULT_BIKE_PROFILE, fitRef } = options;
  return useMemo(
    () => (character: Object3D) => {
      const rig = rigRef.current;
      if (!rig) return;
      const bones = findBones(character);
      if (!bones) return;
      const clipDrivenTorso = torsoMode === "clip";

      // The seated idle clip leans back and stretches over its 10s loop,
      // which made the rider sit up and slump at random. Snapshot the torso
      // once the clip has faded in (~0.5s) and hold it; the IK and lean
      // below are then applied to a stable base. Skipped entirely when the
      // clip owns the torso — freezing would kill its pedal-synced motion.
      if (!clipDrivenTorso) {
        if (!bones.frozen) {
          bones.frames += 1;
          if (freezeReferenceImmediately || bones.frames >= FREEZE_AFTER_FRAMES) {
            bones.frozen = bones.torso.map((bone) => ({
              bone,
              quaternion: bone.quaternion.clone(),
              position: bone.position.clone(),
            }));
          }
        } else {
          for (const f of bones.frozen) {
            f.bone.quaternion.copy(f.quaternion);
            f.bone.position.copy(f.position);
          }
        }
      }
      character.updateWorldMatrix(true, true);

      // 0. Fit the rider to the bike from their own proportions (once per
      //    profile — a different bike gets a fresh solve).
      if (!bones.fit || bones.fitProfile !== profile) {
        bones.segments = measureSegments(character, bones, rig);
        bones.fit = computeFit(bones.segments, profile);
        bones.fitProfile = profile;
      }
      const fit = bones.fit;
      if (fitRef && fitRef.current !== fit) fitRef.current = fit;

      const phase = phaseRef.current;
      // Rig axes in world space.
      rig.getWorldQuaternion(_qRig);
      _axis.set(1, 0, 0).applyQuaternion(_qRig); // rider's left → lean axis

      // 1. Trunk over the bars: measure the clip's trunk angle (hip centre →
      //    shoulder centre, sagittal plane), average it, and tip the pelvis
      //    by the difference to the fitted angle — the legs are re-aimed by
      //    IK below, so rotating their parent is free. The head
      //    counter-rotates to look down the road.
      if (bones.pivot && bones.arms.length === 2) {
        restoreIfUntouched(bones, bones.pivot);
        if (bones.head) restoreIfUntouched(bones, bones.head);
        character.updateWorldMatrix(true, true);
        bones.legs[0].up.getWorldPosition(_a);
        bones.legs[1].up.getWorldPosition(_b);
        rig.worldToLocal(_rigPivot.copy(_a).add(_b).multiplyScalar(0.5));
        bones.arms[0].up.getWorldPosition(_a);
        bones.arms[1].up.getWorldPosition(_b);
        rig.worldToLocal(_rigShoulder.copy(_a).add(_b).multiplyScalar(0.5));
        const measured = Math.atan2(_rigShoulder.y - _rigPivot.y, _rigShoulder.z - _rigPivot.z);
        bones.torsoAvg =
          bones.torsoAvg === null || !clipDrivenTorso
            ? measured
            : bones.torsoAvg + (measured - bones.torsoAvg) * TORSO_AVG_RATE;
        // Positive rotation about +X tips the trunk forward (lowers its angle).
        // Target = fitted angle + a damped share of the clip's swing.
        const target = fit.torsoAngle + TORSO_BOB_KEEP * (measured - bones.torsoAvg);
        const lean = measured - target + (leanRef?.current ?? 0);
        _qPre.copy(bones.pivot.quaternion);
        rotateBoneWorld(bones.pivot, _q.setFromAxisAngle(_axis, lean));
        recordApplied(bones, bones.pivot, _qPre);
        // Eyes up the road: undo the lean and lift a little more, since the
        // seated clips already pitch the head down.
        if (bones.head) {
          _qPre.copy(bones.head.quaternion);
          rotateBoneWorld(bones.head, _q.setFromAxisAngle(_axis, -(lean + HEAD_LIFT)));
          recordApplied(bones, bones.head, _qPre);
        }
      }

      // 2. Pin the hip joint centre to the fitted position (plus a hint of
      //    the natural sit-bone rock, twice per revolution). The character
      //    root is a direct child of the rig, so the correction is rig-space.
      bones.legs[0].up.getWorldPosition(_a);
      bones.legs[1].up.getWorldPosition(_b);
      rig.worldToLocal(_rigHip.copy(_a).add(_b).multiplyScalar(0.5));
      _tmp.copy(fit.hip);
      _tmp.y += 0.008 * Math.sin(2 * phase);
      character.position.add(_tmp.sub(_rigHip));
      character.updateWorldMatrix(true, true);

      // 3. Legs → pedals. Ball of the foot on the spindle (plus stack); the
      //    ankle sits up/back along the foot at the stroke's ankle pitch,
      //    then the foot bone is aimed so the toes point down the same line.
      const seg = bones.segments!;
      for (const leg of bones.legs) {
        const legPhase = phase + (leg.side === 1 ? 0 : Math.PI);
        pedalPosition(legPhase, leg.side, _rigPedal, profile);
        _rigPedal.y += PEDAL_STACK;
        const a = seg.footRestPitch + anklePitch(legPhase);
        const fy = -Math.sin(a) * seg.footLen;
        const fz = Math.cos(a) * seg.footLen;
        // Ankle = ball − foot vector.
        _tmp.set(_rigPedal.x, _rigPedal.y - fy, _rigPedal.z - fz);
        rig.localToWorld(_wTarget.copy(_tmp));
        // Knees track forward and slightly out, over the pedals.
        rig.localToWorld(_wPole.set(leg.side * 0.2, fit.hip.y + 0.2, 1.6));
        solveTwoBone(leg.up, leg.mid, leg.end, _wTarget, _wPole);
        if (leg.toe) {
          _tmp.set(_rigPedal.x, _rigPedal.y, _rigPedal.z);
          aimBone(leg.end, leg.toe, rig.localToWorld(_tmp));
        }
      }

      // 4. Hands → hoods, elbows down and a little out.
      for (const arm of bones.arms) {
        // Wrist behind/above the hood so the palm rests on it and the
        // fingers drape over its front.
        rig.localToWorld(
          _wTarget.set(arm.side * profile.gripHalfWidth, profile.barCenter.y + WRIST_UP, profile.barCenter.z - WRIST_BACK),
        );
        rig.localToWorld(_wPole.set(arm.side * 0.42, profile.barCenter.y - 0.45, profile.barCenter.z - 0.55));
        solveTwoBone(arm.up, arm.mid, arm.end, _wTarget, _wPole);
        // Rig has no finger bones. With an identity wrist the hand continues
        // the forearm; re-aim it to a fixed rig-space pitch over the hood
        // (independent of where the elbow ended up), then roll it so the
        // bind-pose palm normal faces the floor.
        arm.end.quaternion.identity();
        arm.end.updateMatrixWorld(true);
        arm.end.getWorldPosition(_a);
        arm.mid.getWorldPosition(_b);
        _dir.subVectors(_a, _b).normalize();
        _des.set(0, -Math.sin(HAND_PITCH), Math.cos(HAND_PITCH)).applyQuaternion(_qRig);
        rotateBoneWorld(arm.end, _q.setFromUnitVectors(_dir, _des));
        if (arm.palm) {
          arm.end.getWorldQuaternion(_qw);
          _cur.copy(arm.palm).applyQuaternion(_qw);
          _cur.addScaledVector(_des, -_cur.dot(_des));
          _tmp.set(0, -1, 0).applyQuaternion(_qRig);
          _tmp.addScaledVector(_des, -_tmp.dot(_des));
          if (_cur.lengthSq() > 1e-8 && _tmp.lengthSq() > 1e-8) {
            _cur.normalize();
            _tmp.normalize();
            const angle = Math.atan2(_pole.crossVectors(_cur, _tmp).dot(_des), _cur.dot(_tmp));
            rotateBoneWorld(arm.end, _q.setFromAxisAngle(_des, angle));
          }
        }
      }
    },
    [rigRef, phaseRef, leanRef, freezeReferenceImmediately, torsoMode, profile, fitRef],
  );
}
