"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Environment, Lightformer } from "@react-three/drei";
import { useSearchParams } from "next/navigation";
import { Group, Vector3 } from "three";
import { AnimatedModel } from "@/app/components/features/route/animated-model";
import {
  ProceduralBike,
  useCyclistPose,
  RIG,
  DEFAULT_BIKE_PROFILE,
  type BikeProfile,
  type RiderFit,
} from "@/app/components/features/route/procedural-cyclist";
import { resolveAvatar } from "@/app/lib/selection-library";

const VIEWS: Record<string, { pos: [number, number, number]; target: [number, number, number]; fov?: number }> = {
  side: { pos: [4.2, 0.9, 0.15], target: [0, 0.8, 0.15], fov: 30 },
  front: { pos: [0.05, 0.9, 4.4], target: [0, 0.8, 0.15], fov: 30 },
  back: { pos: [0.05, 0.9, -4.3], target: [0, 0.8, 0.15], fov: 30 },
  iso: { pos: [3, 1.8, 3], target: [0, 0.8, 0.1], fov: 32 },
  rear34: { pos: [-2.6, 1.9, -3.2], target: [0, 0.9, 0.1], fov: 32 },
  top: { pos: [0.01, 5, 0.15], target: [0, 0.8, 0.15], fov: 30 },
  pedal: { pos: [2.2, 0.35, 0.3], target: [0, 0.4, 0.05], fov: 24 },
  bars: { pos: [1.6, 1.7, 2.2], target: [0, 1.25, 0.7], fov: 24 },
  head: { pos: [2.4, 2.0, 0.6], target: [0, 1.9, 0.4], fov: 22 },
};

function Marker({ p, color, r = 0.025 }: { p: Vector3 | [number, number, number]; color: string; r?: number }) {
  const pos = Array.isArray(p) ? p : ([p.x, p.y, p.z] as [number, number, number]);
  return (
    <mesh position={pos}>
      <sphereGeometry args={[r, 12, 12]} />
      <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.9} />
    </mesh>
  );
}

function Markers({ profile, fitRef }: { profile: BikeProfile; fitRef: React.MutableRefObject<RiderFit | null> }) {
  const hipRef = useRef<Group>(null);
  useFrame(() => {
    const fit = fitRef.current;
    if (fit && hipRef.current) hipRef.current.position.copy(fit.hip);
  });
  return (
    <group renderOrder={999}>
      <Marker p={RIG.rearAxle} color="#f43f5e" />
      <Marker p={RIG.frontAxle} color="#f43f5e" />
      <Marker p={profile.bottomBracket} color="#22d3ee" r={0.03} />
      <Marker p={[profile.gripHalfWidth, profile.barCenter.y, profile.barCenter.z]} color="#fbbf24" />
      <Marker p={[-profile.gripHalfWidth, profile.barCenter.y, profile.barCenter.z]} color="#fbbf24" />
      <group ref={hipRef}>
        <Marker p={[0, 0, 0]} color="#c084fc" r={0.035} />
      </group>
    </group>
  );
}

function Rig({
  avatarId,
  phaseParam,
  tParam,
  markers,
  nobike,
  debug,
}: {
  avatarId: string;
  phaseParam: number | null;
  tParam: number | null;
  markers: boolean;
  nobike: boolean;
  debug: boolean;
}) {
  const avatar = resolveAvatar(avatarId);
  const rigRef = useRef<Group>(null);
  const phaseRef = useRef(phaseParam ?? 0);
  const wheelRef = useRef(0);
  const leanRef = useRef(0);
  const timeRef = useRef(tParam ?? 0);
  const rateRef = useRef(1);
  const fitRef = useRef<RiderFit | null>(null);
  const logged = useRef(false);
  const hasPedal = !!avatar?.clips?.some((c) => c.name === "pedal");
  const options = useMemo(() => ({ fitRef }), []);
  const pose = useCyclistPose(rigRef, phaseRef, leanRef, true, hasPedal ? "clip" : "full", options);

  useFrame((_, delta) => {
    if (phaseParam === null) {
      // 80 rpm.
      phaseRef.current += delta * (80 / 60) * Math.PI * 2;
      wheelRef.current += delta * 6;
    }
    if (tParam === null) timeRef.current += delta;
    if (debug && !logged.current && fitRef.current) {
      logged.current = true;
      const f = fitRef.current;
      const summary = {
        hip: f.hip.toArray().map((v) => +v.toFixed(3)),
        saddle: f.saddle.toArray().map((v) => +v.toFixed(3)),
        torsoDeg: +((f.torsoAngle * 180) / Math.PI).toFixed(1),
      };
      console.log("[rig-studio] fit", summary);
      (window as unknown as { __rigStudioFit?: unknown }).__rigStudioFit = summary;
    }
  });

  if (!avatar) return null;
  return (
    <group ref={rigRef}>
      {!nobike && (
        <ProceduralBike phaseRef={phaseRef} wheelAngleRef={wheelRef} frameColor="#38bdf8" accentColor="#f472b6" fitRef={fitRef} />
      )}
      {markers && <Markers profile={DEFAULT_BIKE_PROFILE} fitRef={fitRef} />}
      <AnimatedModel
        url={avatar.modelUrl}
        clips={avatar.clips}
        activeClip={hasPedal ? "pedal" : "idle"}
        scale={RIG.characterScale}
        position={RIG.characterOffset}
        onAfterUpdate={pose}
        timeRef={timeRef}
        rateRef={rateRef}
      />
    </group>
  );
}

export function RigStudioClient() {
  const sp = useSearchParams();
  const avatarId = sp.get("avatar") || "meshy-rider";
  const view = VIEWS[sp.get("view") || "side"] ?? VIEWS.side;
  const num = (k: string) => {
    const v = sp.get(k);
    const n = Number(v);
    return v !== null && Number.isFinite(n) ? n : null;
  };
  const bg = sp.get("bg") || "#0f172a";

  return (
    <div style={{ width: "100vw", height: "100vh", background: bg }}>
      <Canvas camera={{ position: view.pos, fov: view.fov ?? 30 }} shadows>
        <color attach="background" args={[bg]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 4]} intensity={1.6} />
        <directionalLight position={[-4, 3, -2]} intensity={0.7} color="#bae6fd" />
        <Suspense fallback={null}>
          <Environment resolution={64}>
            <Lightformer intensity={2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
            <Lightformer intensity={1} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#fde68a" />
            <Lightformer intensity={1} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#a5f3fc" />
          </Environment>
          <Rig
            avatarId={avatarId}
            phaseParam={num("phase")}
            tParam={num("t")}
            markers={sp.get("markers") === "1"}
            nobike={sp.get("nobike") === "1"}
            debug={sp.get("debug") === "1"}
          />
        </Suspense>
        <Grid
          position={[0, 0, 0]}
          args={[10, 10]}
          cellSize={0.1}
          cellThickness={0.5}
          cellColor="#1e293b"
          sectionSize={0.5}
          sectionThickness={1}
          sectionColor="#475569"
          fadeDistance={10}
          fadeStrength={1.5}
        />
        <OrbitControls enablePan={false} target={view.target} />
      </Canvas>
    </div>
  );
}
