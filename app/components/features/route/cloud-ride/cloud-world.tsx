"use client";

/**
 * Cloud world — three continuous cumulus geometries (metaball lobes,
 * not stretched puffs) instanced into the authored sequence:
 * open sea → cloud cathedral → warm reveal → open vista with islands.
 * Deterministic layout; near forms breathe ±.015 unless reduced motion.
 */

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Fog,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { labAnchorAt } from "../ride-lab/config";
import { seeded } from "./sequence";
import { createCloudSkyGeometry, createCloudSkyMaterial, createPulseMaterial } from "./cloud-materials";
import { buildCloudPiping, buildCloudRoadGeometry, cloudDashPlacements } from "./cloud-geometry";

const FOG_NEAR = new Color("#d4d7ed");
const FOG_REVEAL = new Color("#f2dfd9");
const _m4 = new Matrix4();

// ─── Metaball geometry ─────────────────────────────────────────────

/** Deliberately separated lobes → one connected cauliflower mass. */
const BALLS: [number, number, number][] = [
  [0.23, 0.43, 0.5],
  [0.39, 0.43, 0.5],
  [0.56, 0.43, 0.5],
  [0.73, 0.43, 0.5],
  [0.32, 0.58, 0.5],
  [0.5, 0.66, 0.5],
  [0.67, 0.57, 0.5],
  [0.43, 0.46, 0.36],
  [0.57, 0.46, 0.65],
];

/** One continuous cumulus geometry, centered and normalized to [−1,1]. */
export function buildCloudGeometry(resolution: number, seedBase: number): BufferGeometry {
  const mc = new MarchingCubes(resolution, new MeshLambertMaterial(), false, false, 20000);
  mc.isolation = 70;
  BALLS.forEach((b, i) => {
    mc.addBall(
      b[0] + (seeded(seedBase + i * 3) - 0.5) * 0.04,
      b[1] + (seeded(seedBase + i * 5) - 0.5) * 0.04,
      b[2] + (seeded(seedBase + i * 7) - 0.5) * 0.04,
      0.6,
      12,
    );
  });
  mc.update();
  const src = mc.geometry as BufferGeometry;
  const pos = src.getAttribute("position");
  const nor = src.getAttribute("normal");
  const count = src.drawRange.count;
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos.array.slice(0, count * 3) as Float32Array, 3));
  geo.setAttribute("normal", new BufferAttribute(nor.array.slice(0, count * 3) as Float32Array, 3));
  // applyMatrix4 keeps normals correct (inverse-transpose) — center + scale
  // the field-space bounds to [−1,1] per axis.
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const c = bb.getCenter(new Vector3());
  const s = bb.getSize(new Vector3());
  _m4.makeScale(2 / Math.max(s.x, 1e-6), 2 / Math.max(s.y, 1e-6), 2 / Math.max(s.z, 1e-6));
  _m4.setPosition(-c.x * (2 / s.x), -c.y * (2 / s.y), -c.z * (2 / s.z));
  geo.applyMatrix4(_m4);
  geo.computeBoundingSphere();
  src.dispose();
  (mc.material as MeshLambertMaterial).dispose();
  return geo;
}

// ─── Composition ───────────────────────────────────────────────────

interface CloudPlacement {
  position: Vector3;
  scale: Vector3;
  period: number; // 0 = static
  phase: number;
}
const place = (curve: CatmullRomCurve3, u: number, lat: number, dy: number, s: [number, number, number], period = 0, phase = 0): CloudPlacement => ({
  position: labAnchorAt(curve, u, lat, dy),
  scale: new Vector3(...s),
  period,
  phase,
});

export interface CloudLayout {
  sea: CloudPlacement[];
  islands: CloudPlacement[];
  towers: CloudPlacement[]; // cathedral + arches — the breathing set
}

export function buildCloudLayout(curve: CatmullRomCurve3): CloudLayout {
  // Lower connected sea: 50 mid clusters + 18 giant horizon banks.
  const sea: CloudPlacement[] = [];
  for (let i = 0; i < 50; i++) {
    const u = i / 50;
    const sideSign = i % 2 ? 1 : -1;
    sea.push(place(curve, u, sideSign * (28 + seeded(100 + i * 7) * 67), -35 + seeded(200 + i * 11) * 13, [20 + seeded(300 + i) * 16, 7 + seeded(400 + i) * 5, 16 + seeded(500 + i) * 12]));
  }
  for (let i = 0; i < 18; i++) {
    const u = (i + 0.5) / 18;
    const sideSign = i % 2 ? 1 : -1;
    sea.push(place(curve, u, sideSign * (110 + seeded(600 + i) * 110), -55, [55, 18, 45]));
  }

  // Cathedral: at each anchor u, a column of 3 overlapping levels so the
  // tower reads as stacked cumulus, not a stretched capsule. Crowns sit
  // +5 further out so they never hang low over the road.
  const towers: CloudPlacement[] = [];
  [0.2, 0.27, 0.34, 0.4].forEach((u, i) => {
    const sideSign = i % 2 ? 1 : -1;
    const baseLat = sideSign * (20 + seeded(800 + i * 13) * 6);
    const k = 0.9 + seeded(840 + i) * 0.3;
    const period = 7 + seeded(900 + i) * 5;
    const phase = seeded(920 + i) * Math.PI * 2;
    towers.push(place(curve, u, baseLat, -8 + 8, [10 * k, 12 * k, 12 * k], period, phase));
    towers.push(place(curve, u, baseLat + sideSign * 2, 8 + 6, [13 * k, 10 * k, 14 * k], period, phase));
    towers.push(place(curve, u, baseLat + sideSign * 5, 22 + 4, [16 * k, 9 * k, 15 * k], period, phase));
  });
  // Main arch at u .45 — two 3-level buttresses + a top mass joining them.
  for (const [lat, k] of [[-19, 1], [20, 1.1]] as const) {
    const period = 9 + seeded(950 + lat) * 2;
    towers.push(place(curve, 0.45, lat, 6, [11 * k, 12 * k, 15 * k], period, lat));
    towers.push(place(curve, 0.45, lat, 17, [12 * k, 11 * k, 15 * k], period, lat));
    towers.push(place(curve, 0.45, lat * 0.55, 28, [14 * k, 9 * k, 14 * k], period, lat));
  }
  towers.push(place(curve, 0.45, 0, 36, [24, 11, 13], 10, 4));
  // Second, lighter arch at u .84 — visible ahead during the reveal.
  for (const lat of [-20, 20]) {
    towers.push(place(curve, 0.84, lat, 8, [9, 10, 12], 0, 0));
    towers.push(place(curve, 0.84, lat, 20, [10, 9, 12], 0, 0));
    towers.push(place(curve, 0.84, lat * 0.5, 30, [11, 8, 12], 0, 0));
  }
  towers.push(place(curve, 0.84, 0, 36, [18, 8, 11], 0, 0));

  // Floating islands beyond the arch — the wind ribbons live on these.
  const islands: CloudPlacement[] = [];
  for (const [u, lat, dy] of [
    [0.7, -40, -18],
    [0.7, 44, -20],
    [0.86, -55, -24],
    [0.86, 38, -16],
  ] as const) {
    islands.push(place(curve, u, lat, dy, [30, 10, 22]));
  }
  return { sea, islands, towers };
}

function fillInstances(list: CloudPlacement[], node: InstancedMesh | null) {
  if (!node) return;
  list.forEach((d, i) => {
    _m4.makeScale(d.scale.x, d.scale.y, d.scale.z).setPosition(d.position);
    node.setMatrixAt(i, _m4);
  });
  node.instanceMatrix.needsUpdate = true;
  node.computeBoundingSphere();
}

// ─── Wisps ─────────────────────────────────────────────────────────

function useWispTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 32;
    const ctx = c.getContext("2d")!;
    for (let i = 0; i < 14; i++) {
      const x = 8 + seeded(7000 + i) * 48;
      const y = 8 + seeded(7100 + i) * 16;
      const r = 5 + seeded(7200 + i) * 8;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,248,244,0.5)");
      g.addColorStop(1, "rgba(255,248,244,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 32);
    }
    return new CanvasTexture(c);
  }, []);
}

const WISP_COUNT = 12;

// ─── Scene component ───────────────────────────────────────────────

/**
 * Live inputs the authored world reads once per frame. The harness feeds
 * them from its 45s playback clock; the production visualizer feeds them
 * from the ride clock, the rider's real progress, and live effort — the
 * scene itself never knows which side is driving it.
 */
export interface CloudSceneInputs {
  /** Seconds — drives tower breathing and wisp drift. */
  timeRef: MutableRefObject<number>;
  /** Rider's route fraction (0..1) — anchors the wisp sweep beside it. */
  progressRef: MutableRefObject<number>;
  /** 0..1 effort — wisp drift speed. */
  effortRef: MutableRefObject<number>;
  /** 0..1 sky/light/fog warmth (the harness's reveal; the ride's effort). */
  warmthRef: MutableRefObject<number>;
  reducedMotion: boolean;
}

export function CloudWorldScene({
  curve,
  timeRef,
  progressRef,
  effortRef,
  warmthRef,
  reducedMotion,
}: { curve: CatmullRomCurve3 } & CloudSceneInputs) {
  const camera = useThree((s) => s.camera);
  const layout = useMemo(() => buildCloudLayout(curve), [curve]);
  // Three silhouette variants: towers (cathedral/arches), sea, islands.
  const towerGeo = useMemo(() => buildCloudGeometry(32, 11), []);
  const seaGeo = useMemo(() => buildCloudGeometry(22, 31), []);
  const islandGeo = useMemo(() => buildCloudGeometry(22, 71), []);
  useEffect(() => () => { towerGeo.dispose(); seaGeo.dispose(); islandGeo.dispose(); }, [towerGeo, seaGeo, islandGeo]);

  const sky = useMemo(() => ({ m: createCloudSkyMaterial(), g: createCloudSkyGeometry() }), []);
  useEffect(() => () => { sky.m.dispose(); sky.g.dispose(); }, [sky]);
  const wispTex = useWispTexture();
  useEffect(() => () => wispTex.dispose(), [wispTex]);

  const towersRef = useRef<InstancedMesh>(null);
  const skyMeshRef = useRef<Mesh>(null);
  const keyRef = useRef<DirectionalLight>(null);

  // Fog attaches to the SCENE — <fog> sits at fragment level, so its parent
  // is the scene, never a group.
  const fogObjRef = useRef<Fog>(null);

  // Wisps: sprites swept back along the route with effort.
  const wispMats = useMemo(
    () => Array.from({ length: WISP_COUNT }, () => new SpriteMaterial({ map: wispTex, transparent: true, depthWrite: false, opacity: 0 })),
    [wispTex],
  );
  useEffect(() => () => wispMats.forEach((m) => m.dispose()), [wispMats]);
  const wispMatRef = useRef(wispMats);
  useEffect(() => { wispMatRef.current = wispMats; }, [wispMats]);
  const wisps = useMemo(() => {
    return wispMats.map((m) => {
      const sp = new Sprite(m);
      sp.scale.set(2.2, 0.9, 1);
      return sp;
    });
  }, [wispMats]);

  // Per-frame: breathing, sky follows camera, reveal warmth, wisp drift.
  const towerBase = useMemo(() => layout.towers.map((t) => t.scale.clone()), [layout]);
  useFrame(() => {
    const seconds = timeRef.current;
    // Cathedral breathing — matrix scale only, far static.
    const node = towersRef.current;
    if (node && !reducedMotion) {
      layout.towers.forEach((t, i) => {
        const b = towerBase[i];
        const k = t.period > 0 ? 1 + 0.015 * Math.sin((seconds * Math.PI * 2) / t.period + t.phase) : 1;
        _m4.makeScale(b.x * k, b.y * k, b.z * k).setPosition(t.position);
        node.setMatrixAt(i, _m4);
      });
      node.instanceMatrix.needsUpdate = true;
    }
    // Sky dome rides the camera; warmth lifts sky/light/fog.
    const warmth = warmthRef.current;
    const skyMesh = skyMeshRef.current;
    if (skyMesh) {
      skyMesh.position.copy(camera.position);
      (skyMesh.material as ShaderMaterial).uniforms.uWarmth.value = warmth;
    }
    const key = keyRef.current;
    if (key) key.intensity = 2.2 + 0.22 * warmth;
    if (fogObjRef.current) fogObjRef.current.color.lerpColors(FOG_NEAR, FOG_REVEAL, warmth);
    // Wisps drift back past the road edges, anchored to the rider's progress.
    const effort = effortRef.current;
    wisps.forEach((sp, i) => {
      const phase = (seeded(7300 + i) - seconds * (0.03 + 0.025 * effort)) % 1;
      const p = phase < 0 ? phase + 1 : phase;
      const u = Math.min(1, Math.max(0, progressRef.current - 0.05 + p * 0.18));
      const lat = (i % 2 ? 1 : -1) * (6 + seeded(7400 + i) * 4);
      sp.position.copy(labAnchorAt(curve, u, lat, 0.7 + seeded(7500 + i) * 2.3));
      const fade = Math.sin(p * Math.PI);
      wispMatRef.current[i].opacity = 0.5 * fade;
    });
  });

  return (
    <>
      <fog ref={fogObjRef} attach="fog" args={[FOG_NEAR, 110, 420]} />
      <mesh ref={skyMeshRef} geometry={sky.g} material={sky.m} frustumCulled={false} position={camera.position} />
      <hemisphereLight args={["#e9f5ff", "#ada0cd", 1.6]} />
      <directionalLight ref={keyRef} position={[80, 130, 220]} intensity={2.2} color="#fff3d3" />
      <instancedMesh args={[undefined, undefined, layout.sea.length]} geometry={seaGeo} ref={(n) => fillInstances(layout.sea, n)}>
        <meshLambertMaterial color="#e9e6f6" />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, layout.islands.length]} geometry={islandGeo} ref={(n) => fillInstances(layout.islands, n)}>
        <meshLambertMaterial color="#f2eef9" />
      </instancedMesh>
      {/* Near forms: instance matrices ALWAYS initialized — reduced motion
          only skips the per-frame breathing, not placement. */}
      <instancedMesh args={[undefined, undefined, layout.towers.length]} geometry={towerGeo} ref={(n) => { towersRef.current = n; fillInstances(layout.towers, n); }}>
        <meshLambertMaterial color="#fdf8f2" />
      </instancedMesh>
      {wisps.map((sp, i) => (
        <primitive key={i} object={sp} />
      ))}
    </>
  );
}

// ─── Road ──────────────────────────────────────────────────────────

/**
 * The sculpted deck: rounded lilac ribbon, mint piping carrying the
 * effort pulse, and inset cream dashes. One implementation shared by the
 * harness and the production visualizer — the caller supplies `timeRef`
 * (the clock the pulse travels on) and `effortRef` (0..1, widens the
 * pulse bands and their speed).
 */
export function CloudRoad({
  curve,
  banked = true,
  timeRef,
  effortRef,
}: {
  curve: CatmullRomCurve3;
  banked?: boolean;
  timeRef: MutableRefObject<number>;
  effortRef: MutableRefObject<number>;
}) {
  const road = useMemo(() => buildCloudRoadGeometry(curve, banked), [curve, banked]);
  const piping = useMemo(() => buildCloudPiping(curve, banked), [curve, banked]);
  const dashes = useMemo(() => cloudDashPlacements(curve, 36, banked), [curve, banked]);
  const pulseMat = useMemo(() => createPulseMaterial(), []);
  // The frame loop must not mutate a memo'd value — publish it through a
  // ref (same discipline as PropInstances' materialRef).
  const pulseRef = useRef(pulseMat);
  useEffect(() => {
    pulseRef.current = pulseMat;
  }, [pulseMat]);
  useEffect(() => () => { road.dispose(); piping.dispose(); pulseRef.current.dispose(); }, [road, piping]);

  useFrame(() => {
    pulseRef.current.uniforms.uTime.value = timeRef.current;
    pulseRef.current.uniforms.uEffort.value = effortRef.current;
  });

  return (
    <group>
      <mesh geometry={road}>
        <meshStandardMaterial vertexColors roughness={0.7} metalness={0} />
      </mesh>
      <mesh geometry={piping} material={pulseMat} />
      <instancedMesh
        args={[undefined, undefined, dashes.length]}
        ref={(n) => {
          if (n) {
            dashes.forEach((m, i) => n.setMatrixAt(i, m));
            (n as InstancedMesh).instanceMatrix.needsUpdate = true;
            (n as InstancedMesh).computeBoundingSphere();
          }
        }}
      >
        <boxGeometry args={[0.5, 0.015, 0.16]} />
        <meshStandardMaterial color="#fff0cc" roughness={0.8} />
      </instancedMesh>
    </group>
  );
}
