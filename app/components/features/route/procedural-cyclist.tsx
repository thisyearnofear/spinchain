"use client";

/**
 * Procedural cyclist for the 3D route world.
 *
 * Mint's animation catalog has no pedaling clip (public/characters/
 * rider.mint.json), so the rider used to play a seated "chair idle" clip
 * with nothing underneath — a floating man. This module supplies the two
 * missing pieces without new assets:
 *
 *   1. <ProceduralBike> — a road bike built from primitives, in the same
 *      rig space as the character, whose cranks and wheels spin from a
 *      shared pedal phase.
 *   2. useCyclistPose() — a post-animation pass for <AnimatedModel> that
 *      leans the torso over the bars and runs analytic two-bone IK so the
 *      feet follow the pedals and the hands hold the bar. The Mint idle
 *      clip still plays underneath (breathing, head, weight shift); IK
 *      only overrides the limbs.
 *
 * Rig space (all numbers below): origin on the road deck under the bottom
 * bracket, +Z forward along the route, +Y up, +X = rider's left. The Mint
 * rig faces +Z, so no yaw flip is needed (the old π rotation made the
 * rider face backwards).
 *
 * When a real pedaling clip or a bike GLB lands, delete this file and the
 * three call sites in RiderMarker.
 */

import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Object3D, Quaternion, Vector3 } from "three";

// ─── Rig geometry (rig space, see header) ──────────────────────────
export const RIG = {
  wheelRadius: 0.51,
  rearAxle: new Vector3(0, 0.51, -0.62),
  frontAxle: new Vector3(0, 0.51, 0.9),
  bottomBracket: new Vector3(0, 0.4, 0),
  crankLength: 0.26,
  pedalHalfWidth: 0.16,
  saddle: new Vector3(0, 1.12, -0.36),
  seatCluster: new Vector3(0, 1.02, -0.3),
  headTop: new Vector3(0, 1.2, 0.66),
  headBottom: new Vector3(0, 0.95, 0.74),
  barCenter: new Vector3(0, 1.4, 0.56),
  gripHalfWidth: 0.24,
  /** Where to place the Mint character root so its hip joints sit on the saddle. */
  characterOffset: [-0.38, 0.33, 0.24] as [number, number, number],
  /** Character GLB scale that the offsets above were measured at. */
  characterScale: 1.5,
  /** Forward torso lean over the bars, radians. */
  torsoLean: 1.05,
} as const;

/** Rig-space height of the bottom of the wheels above the road deck. */
export const BIKE_DECK_OFFSET = 0.02;

/** Pedal (spindle) position in rig space for a crank phase. φ=0 is top dead centre. */
function pedalPosition(phase: number, side: 1 | -1, out: Vector3): Vector3 {
  return out.set(
    side * RIG.pedalHalfWidth,
    RIG.bottomBracket.y + Math.cos(phase) * RIG.crankLength,
    RIG.bottomBracket.z + Math.sin(phase) * RIG.crankLength,
  );
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
}: {
  from: Vector3;
  to: Vector3;
  radius?: number;
  color: string;
  emissive?: string;
  xOffset?: number;
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
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? color}
        emissiveIntensity={emissive ? 0.6 : 0.15}
        metalness={0.6}
        roughness={0.35}
      />
    </mesh>
  );
}

function Wheel({
  position,
  spinRef,
  rimColor,
}: {
  position: Vector3;
  spinRef: MutableRefObject<Group | null>;
  rimColor: string;
}) {
  const spokes = [0, Math.PI / 3, (2 * Math.PI) / 3];
  return (
    <group position={position}>
      {/* Tyre + rim: torus lies in XY with axis Z — turn it so the axle is X. */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[RIG.wheelRadius, 0.035, 10, 40]} />
        <meshStandardMaterial color="#111318" roughness={0.9} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[RIG.wheelRadius - 0.045, 0.012, 6, 40]} />
        <meshStandardMaterial color={rimColor} emissive={rimColor} emissiveIntensity={0.8} />
      </mesh>
      {/* Spokes spin with the wheel so speed reads at a glance. */}
      <group ref={spinRef}>
        {spokes.map((angle) => (
          <mesh key={angle} rotation={[angle, 0, 0]}>
            <boxGeometry args={[0.012, RIG.wheelRadius * 1.9, 0.012]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 0.1, 12]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

export interface ProceduralBikeProps {
  /** Crank phase in radians, advanced by the caller from live cadence. */
  phaseRef: MutableRefObject<number>;
  /** Wheel rotation in radians, advanced by the caller. */
  wheelAngleRef: MutableRefObject<number>;
  frameColor: string;
  accentColor: string;
}

export function ProceduralBike({ phaseRef, wheelAngleRef, frameColor, accentColor }: ProceduralBikeProps) {
  const rearSpin = useRef<Group>(null);
  const frontSpin = useRef<Group>(null);
  const crankSpin = useRef<Group>(null);

  useFrame(() => {
    const w = wheelAngleRef.current;
    if (rearSpin.current) rearSpin.current.rotation.x = w;
    if (frontSpin.current) frontSpin.current.rotation.x = w;
    // Crank arm geometry points +Y at rotation 0; rotating about +X by φ
    // moves it toward +Z — the same convention as pedalPosition().
    if (crankSpin.current) crankSpin.current.rotation.x = phaseRef.current;
  });

  const bb = RIG.bottomBracket;
  const seatPostTop = useMemo(() => RIG.saddle.clone().add(new Vector3(0, -0.04, 0.01)), []);
  const barLeft = useMemo(() => RIG.barCenter.clone().setX(RIG.gripHalfWidth + 0.04), []);
  const barRight = useMemo(() => RIG.barCenter.clone().setX(-RIG.gripHalfWidth - 0.04), []);

  return (
    <group>
      <Wheel position={RIG.rearAxle} spinRef={rearSpin} rimColor={accentColor} />
      <Wheel position={RIG.frontAxle} spinRef={frontSpin} rimColor={accentColor} />

      {/* Main triangle */}
      <Tube from={bb} to={RIG.seatCluster} color={frameColor} radius={0.032} />
      <Tube from={RIG.seatCluster} to={RIG.headTop} color={frameColor} radius={0.03} />
      <Tube from={bb} to={RIG.headBottom} color={frameColor} radius={0.036} />
      <Tube from={RIG.headBottom} to={RIG.headTop} color={frameColor} radius={0.04} />
      {/* Rear triangle (both sides) */}
      <Tube from={bb} to={RIG.rearAxle} color={frameColor} radius={0.02} xOffset={0.06} />
      <Tube from={bb} to={RIG.rearAxle} color={frameColor} radius={0.02} xOffset={-0.06} />
      <Tube from={RIG.seatCluster} to={RIG.rearAxle} color={frameColor} radius={0.018} xOffset={0.05} />
      <Tube from={RIG.seatCluster} to={RIG.rearAxle} color={frameColor} radius={0.018} xOffset={-0.05} />
      {/* Fork */}
      <Tube from={RIG.headBottom} to={RIG.frontAxle} color={frameColor} radius={0.022} xOffset={0.05} />
      <Tube from={RIG.headBottom} to={RIG.frontAxle} color={frameColor} radius={0.022} xOffset={-0.05} />
      {/* Seat post + saddle */}
      <Tube from={RIG.seatCluster} to={seatPostTop} color="#1f2937" radius={0.018} />
      <mesh position={RIG.saddle}>
        <boxGeometry args={[0.13, 0.05, 0.3]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.6} />
      </mesh>
      {/* Stem + bar */}
      <Tube from={RIG.headTop} to={RIG.barCenter} color="#1f2937" radius={0.022} />
      <Tube from={barLeft} to={barRight} color="#e5e7eb" radius={0.018} emissive={accentColor} />

      {/* Crankset — arms at φ and φ+π with pedals, spinning about the BB. */}
      <group position={bb}>
        <group ref={crankSpin}>
          <mesh>
            <cylinderGeometry args={[0.11, 0.11, 0.02, 20]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} />
          </mesh>
          {([1, -1] as const).map((side) => (
            <group key={side} rotation={[side === 1 ? 0 : Math.PI, 0, 0]}>
              <mesh position={[side * (RIG.pedalHalfWidth - 0.05), RIG.crankLength / 2, 0]}>
                <boxGeometry args={[0.025, RIG.crankLength, 0.04]} />
                <meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.25} />
              </mesh>
              <mesh position={[side * RIG.pedalHalfWidth, RIG.crankLength, 0]}>
                <boxGeometry args={[0.1, 0.025, 0.08]} />
                <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.6} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

// ─── Pose / IK ─────────────────────────────────────────────────────

interface CyclistBones {
  /** Torso chain frozen to one seated reference frame (see FREEZE_AFTER_FRAMES). */
  torso: Object3D[];
  frozen: Array<{ bone: Object3D; quaternion: Quaternion; position: Vector3 }> | null;
  frames: number;
  spine: Object3D | null;
  head: Object3D | null;
  legs: Array<{ up: Object3D; mid: Object3D; end: Object3D; toe: Object3D | null; side: 1 | -1 }>;
  arms: Array<{ up: Object3D; mid: Object3D; end: Object3D; side: 1 | -1 }>;
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
    if (aUp && aMid && aEnd) arms.push({ up: aUp, mid: aMid, end: aEnd, side });
  }
  const torso = ["Hips", "Spine02", "Spine01", "Spine", "neck", "Head", "LeftShoulder", "RightShoulder"]
    .map(get)
    .filter((b): b is Object3D => b !== null);
  const bones: CyclistBones | null =
    legs.length === 2
      ? { torso, frozen: null, frames: 0, spine: get("Spine02") ?? get("Spine"), head: get("Head"), legs, arms }
      : null;
  boneCache.set(root, bones);
  return bones;
}

// Scratch objects — the pose pass runs every frame and must not allocate.
const _a = new Vector3();
const _b = new Vector3();
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
const _q = new Quaternion();
const _qw = new Quaternion();
const _qp = new Quaternion();

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

/** Frames to let the clip fade in before freezing the torso reference. */
const FREEZE_AFTER_FRAMES = 30;

/** Palm-down roll about the forearm (radians, sign mirrored per side). */
const HAND_ROLL = -Math.PI / 2;

// Rig-space scratch
const _rigPedal = new Vector3();

/**
 * Returns a callback for <AnimatedModel onAfterUpdate>. `rigRef` is the
 * group that owns rig space (the bike's parent); `phaseRef` is the crank
 * phase shared with <ProceduralBike>.
 */
export function useCyclistPose(
  rigRef: MutableRefObject<Group | null>,
  phaseRef: MutableRefObject<number>,
  leanRef?: MutableRefObject<number>,
) {
  return useMemo(
    () => (character: Object3D) => {
      const rig = rigRef.current;
      if (!rig) return;
      const bones = findBones(character);
      if (!bones) return;

      // The seated idle clip leans back and stretches over its 10s loop,
      // which made the rider sit up and slump at random. Snapshot the torso
      // once the clip has faded in (~0.5s) and hold it; the IK and lean
      // below are then applied to a stable base.
      if (!bones.frozen) {
        bones.frames += 1;
        if (bones.frames >= FREEZE_AFTER_FRAMES) {
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
      character.updateWorldMatrix(true, true);

      // Rig axes in world space.
      rig.getWorldQuaternion(_qw);
      _axis.set(1, 0, 0).applyQuaternion(_qw); // rider's left → lean axis

      // 1. Torso over the bars, head back up to look down the road.
      const lean = RIG.torsoLean + (leanRef?.current ?? 0);
      if (bones.spine) rotateBoneWorld(bones.spine, _q.setFromAxisAngle(_axis, lean));
      // The seated clip already tips the head down, so counter more than the lean.
      if (bones.head) rotateBoneWorld(bones.head, _q.setFromAxisAngle(_axis, -(lean * 0.85)));

      // 2. Legs → pedals. Ankle sits slightly above/behind the spindle so
      //    the ball of the foot, not the heel, is on the pedal.
      for (const leg of bones.legs) {
        const phase = phaseRef.current + (leg.side === 1 ? 0 : Math.PI);
        pedalPosition(phase, leg.side, _rigPedal);
        _rigPedal.y += 0.1;
        _rigPedal.z -= 0.08;
        rig.localToWorld(_wTarget.copy(_rigPedal));
        // Knees forward, slightly up and out.
        rig.localToWorld(_wPole.set(leg.side * 0.22, 1.5, 1.4));
        solveTwoBone(leg.up, leg.mid, leg.end, _wTarget, _wPole);
        if (leg.toe) {
          // Toes just ahead of the spindle: foot roughly flat on the pedal.
          pedalPosition(phase, leg.side, _wTarget).z += 0.14;
          aimBone(leg.end, leg.toe, rig.localToWorld(_wTarget));
        }
      }

      // 3. Hands → grips, elbows down and out.
      for (const arm of bones.arms) {
        // Target the wrist a little behind/above the bar so the palm lands on it.
        rig.localToWorld(_wTarget.set(arm.side * RIG.gripHalfWidth, RIG.barCenter.y - 0.01, RIG.barCenter.z - 0.1));
        rig.localToWorld(_wPole.set(arm.side * 0.9, 0.9, -0.4));
        solveTwoBone(arm.up, arm.mid, arm.end, _wTarget, _wPole);
        // Rig has no finger bones: a straight wrist (hand continuing the
        // forearm), rolled palm-down, reads as gripping the bar.
        arm.end.quaternion.identity();
        arm.end.updateMatrixWorld(true);
        arm.end.getWorldPosition(_a);
        arm.mid.getWorldPosition(_b);
        _dir.subVectors(_a, _b).normalize();
        rotateBoneWorld(arm.end, _q.setFromAxisAngle(_dir, HAND_ROLL * arm.side));
      }
    },
    [rigRef, phaseRef, leanRef],
  );
}
