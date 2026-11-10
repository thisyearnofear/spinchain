"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Grid, Environment, Lightformer } from "@react-three/drei";
import { useSearchParams } from "next/navigation";
import * as THREE from "three";
import { ProceduralBike } from "@/app/components/features/route/procedural-cyclist";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const { object } = useMemo(() => {
    const obj = scene.clone(true);
    const box = new THREE.Box3().setFromObject(obj);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    obj.position.sub(sphere.center);
    const scale = sphere.radius > 0 ? 1 / sphere.radius : 1;
    obj.scale.multiplyScalar(scale);
    return { object: obj };
  }, [scene]);
  return <primitive object={object} />;
}

/** Static-phase procedural bike for screenshots (feeds Meshy image-to-3D). */
function StaticBike() {
  const phaseRef = useRef(0.8);
  const wheelRef = useRef(0.4);
  return (
    <group position={[0, -0.75, 0]}>
      <ProceduralBike phaseRef={phaseRef} wheelAngleRef={wheelRef} frameColor="#38bdf8" accentColor="#f472b6" />
    </group>
  );
}

const VIEWS: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
  side: { pos: [3.2, 0.1, 0.2], target: [0, -0.75, 0.15] },
  front: { pos: [0.2, 0.2, 3.4], target: [0, -0.75, 0.15] },
  iso: { pos: [2.4, 1.6, 2.4], target: [0, 0, 0] },
  top: { pos: [0.01, 4, 0.01], target: [0, -0.75, 0] },
};

export function ModelViewerClient() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url") || "/characters/bike-meshy-rig.glb";
  const isBike = url === "procedural-bike";
  const view = VIEWS[searchParams.get("view") || (isBike ? "side" : "iso")] ?? VIEWS.iso;
  const spin = searchParams.get("spin") !== "0" && !isBike;
  const bg = searchParams.get("bg") || "#111827";

  return (
    <div style={{ width: "100vw", height: "100vh", background: bg }}>
      <Canvas camera={{ position: view.pos, fov: isBike ? 35 : 40 }}>
        <color attach="background" args={[bg]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 4]} intensity={1.5} />
        <directionalLight position={[-4, 3, -2]} intensity={0.6} color="#7dd3fc" />
        <Suspense fallback={null}>
          <Environment resolution={64}>
            <Lightformer intensity={2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
            <Lightformer intensity={1} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#f0abfc" />
            <Lightformer intensity={1} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#67e8f9" />
          </Environment>
          {isBike ? <StaticBike /> : <Model url={url} />}
        </Suspense>
        {!isBike && (
          <Grid
            position={[0, -1.05, 0]}
            args={[10, 10]}
            cellSize={0.25}
            cellThickness={0.6}
            cellColor="#1e293b"
            sectionSize={1}
            sectionThickness={1.2}
            sectionColor="#334155"
            fadeDistance={12}
            fadeStrength={2}
          />
        )}
        <OrbitControls
          autoRotate={spin}
          autoRotateSpeed={2.5}
          enablePan={false}
          minDistance={0.5}
          maxDistance={8}
          target={view.target}
        />
      </Canvas>
    </div>
  );
}
