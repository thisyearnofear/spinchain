"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useAdaptiveQuality, usePerformanceTier } from "@/app/lib/responsive";
import {
  CatmullRomCurve3,
  Vector3,
  Mesh,
  Shape,
  ExtrudeGeometry,
  TubeGeometry,
  Group,
  PointLight,
  MathUtils,
  Color,
  Matrix4,
  PerspectiveCamera as ThreePerspectiveCamera,
  InstancedMesh,
  Quaternion,
  Euler,
} from "three";
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  Noise,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useMemo, useRef, useState, useEffect, Suspense, type MutableRefObject } from "react";
import {
  OrbitControls,
  Environment,
  Stars,
  Float,
  Html,
  PerspectiveCamera,
  Sparkles,
  Trail,
  useGLTF,
  Clone,
} from "@react-three/drei";
import { VISUALIZER_THEMES as THEMES, type VisualizerTheme } from "./visualizer-theme";
export type { VisualizerTheme } from "./visualizer-theme";

// Import Selection types
import { AVATARS, EQUIPMENT, type AvatarAsset, type EquipmentAsset } from "../../../lib/selection-library";

// Import StoryBeat types from gpx-uploader for consistency
import type { StoryBeat as GpxStoryBeat, StoryBeatType } from "../../../routes/builder/gpx-uploader";

// Re-export for consumers
export type { StoryBeatType };
export type StoryBeat = GpxStoryBeat;

export type VisualizerMode = "preview" | "ride" | "finished";

export type RiderStats = {
  hr: number;
  power: number;
  cadence: number;
};

const START_OFFSET = 0.05;
const END_PADDING = 0.002;

function mapToCurveProgress(raw: number) {
  if (!Number.isFinite(raw)) return START_OFFSET;
  const clamped = Math.max(0, Math.min(raw, 1));
  return START_OFFSET + clamped * (1 - START_OFFSET - END_PADDING);
}

function sanitizeGeometry(geo: ExtrudeGeometry | TubeGeometry): void {
  const pos = geo.getAttribute('position');
  if (!pos) return;
  const arr = pos.array as Float32Array;
  let hasNaN = false;
  for (let i = 0; i < arr.length; i++) {
    if (!Number.isFinite(arr[i])) {
      arr[i] = 0;
      hasNaN = true;
    }
  }
  if (hasNaN) {
    pos.needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  }
}

function isFiniteVector3(vec: Vector3): boolean {
  return Number.isFinite(vec.x) && Number.isFinite(vec.y) && Number.isFinite(vec.z);
}

function Model({ url, scale = 1, rotation = [0, 0, 0], position = [0, 0, 0] }: { url: string; scale?: number; rotation?: [number, number, number]; position?: [number, number, number] }) {
  const { scene } = useGLTF(url);
  return <Clone object={scene} scale={scale} rotation={rotation} position={position} />;
}

/**
 * Generates a mock route curve based on elevation data/seeds
 */
const DEFAULT_ELEVATION_PROFILE = [120, 180, 140, 210, 260, 220, 280, 240, 300, 260, 320, 280];

function useRouteCurve(elevationProfile: number[]) {
  return useMemo(() => {
    // Sanitize: replace non-finite values, fall back to defaults if empty
    const rawProfile = elevationProfile.length > 0 ? elevationProfile : DEFAULT_ELEVATION_PROFILE;
    const profile = rawProfile.map(v => (Number.isFinite(v) ? v : 0));

    const points: Vector3[] = [];
    const radius = 50;
    const steps = 150;

    // Use i < steps (NOT i <= steps) to avoid a duplicate start/end point.
    // A closed CatmullRomCurve3 handles the loop itself; a repeated endpoint
    // produces a zero-length segment whose tangent is NaN, which propagates into
    // ExtrudeGeometry and TubeGeometry vertex positions.
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 4; // 2 full circles

      const r = radius + Math.sin(t * Math.PI * 6) * 15;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      // Wrap elevation cyclically so the closed-loop seam blends smoothly
      const u = t * profile.length;
      const elevIndex = Math.floor(u) % profile.length;
      const nextElevIndex = (elevIndex + 1) % profile.length;
      const elevAlpha = u - Math.floor(u);

      const h1 = profile[elevIndex] ?? 0;
      const h2 = profile[nextElevIndex] ?? 0;
      const height = MathUtils.lerp(h1, h2, elevAlpha);

      points.push(new Vector3(x, height / 4, z));
    }

    const curve = new CatmullRomCurve3(points, true, "centripetal");
    curve.arcLengthDivisions = 600;
    return curve;
  }, [elevationProfile]);
}

function Road({
  curve,
  theme = "neon",
  stats = { hr: 0, power: 0, cadence: 0 },
  steps = 300,
}: {
  curve: CatmullRomCurve3;
  theme?: VisualizerTheme;
  stats?: RiderStats;
  steps?: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const styles = THEMES[theme];

  useFrame((state) => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as any;

    // Dynamic emissive pulsing based on cadence
    const pulse = 0.5 + Math.sin(state.clock.elapsedTime * (stats.cadence / 20)) * 0.5;
    const baseEmissive = styles.roadEmissiveIntensity || 0;

    // Boost effect when sprinting
    const sprintFactor = Math.min(1, stats.power / 600);
    material.emissiveIntensity = baseEmissive + (pulse * 0.1) + (sprintFactor * 0.4);

    // Dynamic color shift if on rainbow theme
    if (theme === 'rainbow') {
      const hue = (state.clock.elapsedTime / 10) % 1;
      material.emissive.setHSL(hue, 1, 0.5);
    }
  });

  const geometry = useMemo(() => {
    const roadShape = new Shape();
    const width = theme === "rainbow" ? 4 : 2.5;
    const height = 0.5;

    roadShape.moveTo(-width, 0);
    roadShape.lineTo(width, 0);
    roadShape.lineTo(width * 0.9, height);
    roadShape.lineTo(-width * 0.9, height);
    roadShape.lineTo(-width, 0);

    const roadGeo = new ExtrudeGeometry(roadShape, {
      steps,
      extrudePath: curve,
      bevelEnabled: false,
    });

    // Add Road Markings to the same geometry
    const dashShape = new Shape();
    dashShape.moveTo(-0.1, 0.51);
    dashShape.lineTo(0.1, 0.51);
    dashShape.lineTo(0.1, 0.52);
    dashShape.lineTo(-0.1, 0.52);
    dashShape.lineTo(-0.1, 0.51);

    const dashGeo = new ExtrudeGeometry(dashShape, {
      steps: Math.max(60, Math.round(steps * 0.65)),
      extrudePath: curve,
      bevelEnabled: false,
    });

    const edgeShape = new Shape();
    const edgeWidth = theme === "rainbow" ? 3.8 : 2.3;
    edgeShape.moveTo(-edgeWidth, 0.51);
    edgeShape.lineTo(-edgeWidth + 0.15, 0.51);
    edgeShape.lineTo(-edgeWidth + 0.15, 0.53);
    edgeShape.lineTo(-edgeWidth, 0.53);
    edgeShape.lineTo(-edgeWidth, 0.51);
    edgeShape.moveTo(edgeWidth - 0.15, 0.51);
    edgeShape.lineTo(edgeWidth, 0.51);
    edgeShape.lineTo(edgeWidth, 0.53);
    edgeShape.lineTo(edgeWidth - 0.15, 0.53);
    edgeShape.lineTo(edgeWidth - 0.15, 0.51);

    const edgeGeo = new ExtrudeGeometry(edgeShape, {
      steps,
      extrudePath: curve,
      bevelEnabled: false,
    });

    // Merge geometries
    const geometries = [roadGeo, dashGeo, edgeGeo];
    const colors = [];
    const roadColor = new Color(styles.roadColor);
    const lineColor = new Color(styles.lineColor);

    geometries.forEach((g, i) => {
      const color = i === 0 ? roadColor : lineColor;
      const count = g.attributes.position.count;
      for (let j = 0; j < count; j++) {
        colors.push(color.r, color.g, color.b);
      }
    });

    // Simplified merge: this is a placeholder for real BufferGeometry merging
    // In a real scenario we'd use BufferGeometryUtils.mergeGeometries
    // For now, let's keep them separate but optimize the materials.
    sanitizeGeometry(roadGeo);
    sanitizeGeometry(dashGeo);
    sanitizeGeometry(edgeGeo);

    return { roadGeo, dashGeo, edgeGeo };
  }, [curve, theme, steps, styles.roadColor, styles.lineColor]);

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry.roadGeo} receiveShadow castShadow>
        <meshStandardMaterial
          color={styles.roadColor}
          emissive={styles.roadEmissive}
          emissiveIntensity={styles.roadEmissiveIntensity}
          roughness={0.2}
          metalness={0.9}
        />
      </mesh>
      {/* Optimized RoadMarkings - rendered directly here to keep structure clean */}
      <mesh geometry={geometry.dashGeo}>
        <meshStandardMaterial
          color={styles.lineColor}
          emissive={styles.lineColor}
          emissiveIntensity={styles.roadEmissiveIntensity * 5}
          transparent
          opacity={0.8}
        />
      </mesh>
      <mesh geometry={geometry.edgeGeo}>
        <meshStandardMaterial
          color={styles.lineColor}
          emissive={styles.lineColor}
          emissiveIntensity={styles.roadEmissiveIntensity * 10}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  );
}

function FinishLine({ curve, theme = "neon" }: { curve: CatmullRomCurve3; theme?: VisualizerTheme }) {
  const styles = THEMES[theme];
  const point = useMemo(() => curve.getPointAt(0.995), [curve]);
  const tangent = useMemo(() => curve.getTangentAt(0.995), [curve]);

  const groupRef = useRef<Group>(null);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.lookAt(point.clone().add(tangent));
    }
  }, [point, tangent]);

  return (
    <group ref={groupRef} position={[point.x, point.y, point.z]}>
      {/* Arch */}
      <mesh position={[0, 4, 0]}>
        <torusGeometry args={[5, 0.3, 16, 32, Math.PI]} />
        <meshStandardMaterial color={styles.lineColor} emissive={styles.lineColor} emissiveIntensity={5} />
      </mesh>

      {/* Checkered Panel */}
      <mesh position={[0, 4, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[10, 2]} />
        <meshBasicMaterial color="white" transparent opacity={0.2} wireframe />
      </mesh>

      <Html position={[0, 8, 0]} center>
        <div className="text-white font-black px-4 py-1 rounded-sm skew-x-12 border-2 border-white animate-pulse" style={{ backgroundColor: `${styles.horizonGlow}cc`, boxShadow: `0 0 20px ${styles.horizonGlow}` }}>
          FINISH
        </div>
      </Html>

      <pointLight distance={20} intensity={20} color={styles.lineColor} />
    </group>
  );
}

function PropManager({ theme = "neon", curve, stats }: { theme?: VisualizerTheme; curve: CatmullRomCurve3; stats: RiderStats }) {
  const themeData = THEMES[theme] || THEMES.neon;
  const propConfig = themeData.props;
  const meshRef = useRef<InstancedMesh>(null);
  const _matrix = useMemo(() => new Matrix4(), []);
  const _position = useMemo(() => new Vector3(), []);
  const _rotation = useMemo(() => new Euler(), []);
  const _scale = useMemo(() => new Vector3(), []);
  const _tangent = useMemo(() => new Vector3(), []);
  const _side = useMemo(() => new Vector3(), []);
  const _up = useMemo(() => new Vector3(0, 1, 0), []);
  const _quaternion = useMemo(() => new Quaternion(), []);

  const propPoints = useMemo(() => {
    if (!propConfig || !curve) return [];
    const points = [];
    const count = propConfig.count;
    for (let i = 0; i < count; i++) {
      const p = Math.random();
      const point = curve.getPointAt(p);
      const tangent = curve.getTangentAt(p);
      _tangent.copy(tangent);
      _side.crossVectors(_tangent, _up).normalize();

      // Alternate sides, move out from road
      const dist = 8 + Math.random() * 15;
      const offset = _side.multiplyScalar(i % 2 === 0 ? dist : -dist);

      points.push({
        position: [
          point.x + offset.x,
          point.y + offset.y + (propConfig.type === 'building' ? (propConfig.scale?.[1] ?? 1) / 2 : 0),
          point.z + offset.z
        ],
        rotation: [0, Math.random() * Math.PI, 0],
        scale: [
          (propConfig.scale?.[0] ?? 1) * (0.8 + Math.random() * 0.4),
          (propConfig.scale?.[1] ?? 1) * (0.5 + Math.random() * 1.5),
          (propConfig.scale?.[2] ?? 1) * (0.8 + Math.random() * 0.4),
        ]
      });
    }
    return points;
  }, [curve, propConfig, _up]);

  useEffect(() => {
    if (!meshRef.current || !propPoints.length) return;
    propPoints.forEach((p, i) => {
      _position.set(p.position[0], p.position[1], p.position[2]);
      _rotation.set(p.rotation[0], p.rotation[1], p.rotation[2]);
      _quaternion.setFromEuler(_rotation);
      _scale.set(p.scale[0], p.scale[1], p.scale[2]);
      _matrix.compose(_position, _quaternion, _scale);
      meshRef.current!.setMatrixAt(i, _matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.computeBoundingSphere();
  }, [propPoints, _matrix, _position, _scale]);

  useFrame((state) => {
    if (!meshRef.current) return;

    // Pulse props with the beat
    const pulse = 1 + Math.sin(state.clock.elapsedTime * (stats.cadence / 15)) * 0.05;
    if (theme === 'neon' || theme === 'rainbow') {
      const baseIntensity = theme === 'neon' ? 0.5 : 0.8;
      (meshRef.current.material as any).emissiveIntensity = baseIntensity + (pulse - 1) * 2;
    }
  });

  if (!propConfig) return null;
  
  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, propConfig.count]} frustumCulled={true}>
      {propConfig?.type === 'building' ? (
        <boxGeometry />
      ) : propConfig?.type === 'tree' ? (
        <coneGeometry args={[1, 4, 8]} />
      ) : propConfig?.type === 'rock' ? (
        <dodecahedronGeometry />
      ) : (
        <sphereGeometry />
      )}
      <meshStandardMaterial
        color={propConfig.color}
        emissive={propConfig.color}
        emissiveIntensity={theme === 'neon' ? 0.5 : 0.1}
      />
    </instancedMesh>
  );
}

function PostEffects({ theme = "neon", stats, mode, performanceTier = "high" }: { theme: VisualizerTheme; stats: RiderStats; mode: VisualizerMode; performanceTier?: "high" | "medium" | "low" }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  const powerFactor = Math.min(1, stats.power / 600);
  const intensityMultiplier = performanceTier === "medium" ? 0.5 : 1;
  const bloomIntensity = (0.5 + powerFactor * 2.0) * intensityMultiplier;
  const chromaticOffset = stats.power > 300 ? powerFactor * 0.005 * intensityMultiplier : 0;
  const noiseOpacity = theme === 'neon' ? 0.03 * intensityMultiplier : 0;

  const effects = useMemo(() => {
    const e = [
      <Bloom
        key="bloom"
        intensity={bloomIntensity}
        luminanceThreshold={0.4}
        luminanceSmoothing={1}
        mipmapBlur
      />,
      <ChromaticAberration
        key="chromatic"
        offset={[chromaticOffset, chromaticOffset]}
        blendFunction={BlendFunction.NORMAL}
      />,
      <Noise
        key="noise"
        opacity={noiseOpacity}
        blendFunction={BlendFunction.OVERLAY}
      />,
    ];
    if (performanceTier !== "medium") {
      e.push(<Vignette key="vignette" eskil={false} offset={0.15} darkness={0.8} />);
    }
    return e;
  }, [bloomIntensity, chromaticOffset, noiseOpacity, performanceTier]);

  if (performanceTier === "low" || !ready) {
    return null;
  }

  return (
    <EffectComposer multisampling={performanceTier === "high" ? 4 : 0}>
      <>
        {effects}
        {performanceTier === "medium" && (
          <Vignette key="vignette-medium" eskil={false} offset={0.3} darkness={0.5} />
        )}
      </>
    </EffectComposer>
  );
}

function HoloMap({ curve, progress, theme }: { curve: CatmullRomCurve3, progress: number, theme: VisualizerTheme }) {
  const styles = THEMES[theme];
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(progress, 1)) : 0;
  const dotPosition = useMemo(() => {
    const point = curve.getPointAt(safeProgress);
    return isFiniteVector3(point) ? point : new Vector3(0, 0, 0);
  }, [curve, safeProgress]);

  const tubeGeo = useMemo(() => {
    const geo = new TubeGeometry(curve, 32, 2.5, 8, true);
    sanitizeGeometry(geo);
    return geo;
  }, [curve]);

  return (
    <group position={[0, 1.2, 1.5]} rotation={[-Math.PI / 4, 0, 0]} scale={0.012}>
      {/* Tactical Border for Map */}
      <mesh position={[0, 0, -6]}>
        <planeGeometry args={[160, 160]} />
        <meshBasicMaterial color={styles.lineColor} wireframe transparent opacity={0.1} />
      </mesh>

      {/* Mini Route Path - Glowing Neon */}
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial
          color={styles.lineColor}
          emissive={styles.lineColor}
          emissiveIntensity={10}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Rider Position Dot - High Intensity Flare */}
      <mesh position={dotPosition}>
        <sphereGeometry args={[10, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
        <pointLight intensity={50} color={styles.lineColor} distance={100} />
      </mesh>

      {/* Background Plate - Deep Glass */}
      <mesh position={[0, 0, -5]}>
        <planeGeometry args={[150, 150]} />
        <meshBasicMaterial color={styles.lineColor} transparent opacity={0.05} side={2} />
      </mesh>
    </group>
  );
}

function BeatFlare({ progress, beatProgress, color }: { progress: number, beatProgress: number, color: string }) {
  const distance = Math.abs(progress - beatProgress);
  const isActive = distance < 0.03;
  const intensity = isActive ? (0.03 - distance) * 1000 : 0;

  if (!isActive) return null;

  return (
    <group>
      <mesh position={[0, 50, 0]}>
        <cylinderGeometry args={[0.2, 2, 100, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} />
      </mesh>
      <pointLight position={[0, 5, 0]} intensity={intensity / 10} color={color} distance={40} />
    </group>
  );
}

function HoloHUD({
  stats,
  theme,
  curve,
  progressRef,
}: {
  stats: RiderStats;
  theme: VisualizerTheme;
  curve: CatmullRomCurve3;
  // Accept a ref so position updates from Scene's useFrame are always fresh
  // even when Scene hasn't triggered a React re-render.
  progressRef: MutableRefObject<number>;
}) {
  const styles = THEMES[theme];
  const groupRef = useRef<Group>(null);
  // Local throttled state for the HTML progress bar (~10fps is plenty for text)
  const [displayProgress, setDisplayProgress] = useState(progressRef.current);
  const hudFrameRef = useRef(0);

  useFrame((state) => {
    if (!groupRef.current) return;
    const breathe = Math.sin(state.clock.elapsedTime * 2.5) * 0.08;
    groupRef.current.position.y = 1.9 + breathe;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.08;
    // Throttle progress text update independently of parent render cycle
    hudFrameRef.current++;
    if (hudFrameRef.current % 6 === 0) {
      setDisplayProgress(progressRef.current);
    }
  });

  return (
    <group ref={groupRef} position={[0, 1.9, -1.8]}>
      {/* Background Vision Pro Glass Panel */}
      <mesh rotation={[0, 0, 0]}>
        <planeGeometry args={[2.4, 1.6]} />
        <meshBasicMaterial
          color={styles.lineColor}
          transparent
          opacity={0.08}
          side={2}
        />
      </mesh>

      {/* Diegetic Outer Glow */}
      <mesh rotation={[0, 0, 0]} position={[0, 0, -0.01]}>
        <planeGeometry args={[2.5, 1.7]} />
        <meshBasicMaterial color={styles.lineColor} transparent opacity={0.05} />
      </mesh>

      {/* Mini-Map Integration */}
      <HoloMap curve={curve} progress={displayProgress} theme={theme} />

      <Html transform distanceFactor={5.5} position={[0, 0.2, 0.02]} scale={0.1} portal={undefined}>
        <div className="flex flex-col items-center justify-center p-6 min-w-[380px] select-none pointer-events-none bg-black/40 backdrop-blur-3xl rounded-3xl border border-white/10">
          <div className="flex items-center gap-10 mb-6">
            <div className="text-center">
              <div className="text-[14px] font-black uppercase tracking-[0.4em] text-white/40 mb-1">Power</div>
              <div className="text-[72px] font-black leading-none text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">{stats.power}<span className="text-[24px] ml-1 opacity-40 font-bold">W</span></div>
            </div>
            <div className="w-[2px] h-16 bg-white/10 rounded-full" />
            <div className="text-center">
              <div className="text-[14px] font-black uppercase tracking-[0.4em] text-white/40 mb-1">Cadence</div>
              <div className="text-[72px] font-black leading-none text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">{stats.cadence}<span className="text-[24px] ml-1 opacity-40 font-bold">RPM</span></div>
            </div>
          </div>

          <div className="flex items-center justify-between w-full border-t border-white/5 pt-5">
            <div className="flex flex-col items-start gap-1">
              <span className="text-[10px] uppercase text-white/40 font-black tracking-[0.3em]">Neural Progress</span>
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-32 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-white/40 rounded-full" style={{ width: `${displayProgress * 100}%` }} />
                </div>
                <span className="text-[20px] text-white font-black">{(displayProgress * 100).toFixed(1)}%</span>
              </div>
            </div>
            {stats.hr > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 backdrop-blur-xl">
                <span className="text-[14px] font-black text-rose-400 uppercase tracking-tighter">♥ {stats.hr} BPM</span>
              </div>
            )}
          </div>

          <div className="mt-4 text-[8px] font-mono text-white/20 uppercase tracking-[0.5em] w-full text-center">
             System Node: Active-0xSui
          </div>
        </div>
      </Html>
    </group>
  );
}

function RiderMarker({
  curve,
  progressRef,
  theme = "neon",
  stats = { hr: 120, power: 150, cadence: 80 },
  avatar,
  equipment,
  showYouLabel = false,
}: {
  curve: CatmullRomCurve3;
  // Ref instead of plain number so useFrame always reads the latest value without
  // requiring a React re-render from the parent each frame.
  progressRef: MutableRefObject<number>;
  theme?: VisualizerTheme;
  stats?: RiderStats;
  avatar?: AvatarAsset;
  equipment?: EquipmentAsset;
  showYouLabel?: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const styles = THEMES[theme];

  const auraRef = useRef<Mesh>(null);
  const lightRef = useRef<PointLight>(null);
  
  const _lookAt = useMemo(() => new Vector3(), []);

  useFrame((state) => {
    if (!groupRef.current) return;

    const progress = progressRef.current;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress);

    // Guard against NaN positions from degenerate curves
    if (!isFiniteVector3(point) || !isFiniteVector3(tangent)) return;

    // Update position
    groupRef.current.position.copy(point);
    // Lift slightly above road
    groupRef.current.position.y += equipment?.type === "vehicle" ? 2.5 : 1.5;

    // Update rotation to face forward
    _lookAt.copy(point).add(tangent);
    groupRef.current.lookAt(_lookAt);

    // Reactive pulsing
    if (auraRef.current) {
      // Pulse scale based on cadence
      const pulse =
        1 + Math.sin(state.clock.elapsedTime * (stats.cadence / 15)) * 0.2;
      auraRef.current.scale.set(pulse, pulse, pulse);
    }

    if (lightRef.current) {
      // Intensity based on heart rate
      lightRef.current.intensity = 5 + (stats.hr / 40) * 5;
    }
  });

  const powerBucket = stats.power > 400 ? 2 : stats.power > 200 ? 1 : 0;
  const trailLength = powerBucket === 2 ? 25 : powerBucket === 1 ? 15 : 10;

  return (
    <group ref={groupRef}>
      {/* Immerive 3D HUD that follows the rider */}
      {showYouLabel && <HoloHUD stats={stats} theme={theme} curve={curve} progressRef={progressRef} />}

      <Trail
        width={2 + stats.power / 200}
        length={trailLength}
        color={styles.riderColor}
        attenuation={(t) => t * t}
      >
        {/* Avatar and Equipment Models */}
        {avatar && (
          <group position={[0, equipment?.type === "bike" ? 0.8 : 0, 0]}>
            <Model url={avatar.modelUrl} scale={1.5} rotation={[0, Math.PI, 0]} />
          </group>
        )}

        {equipment ? (
          <Model url={equipment.modelUrl} scale={equipment?.type === "vehicle" ? 2 : 1.2} />
        ) : (
          /* Stylized cyclist fallback */
          <group rotation={[Math.PI / 2, 0, 0]}>
            {/* Body */}
            <mesh position={[0, 0, 0.2]}>
              <capsuleGeometry args={[0.45, 1.0, 8, 16]} />
              <meshStandardMaterial
                color={styles.riderColor}
                emissive={styles.riderColor}
                emissiveIntensity={3}
                toneMapped={false}
              />
            </mesh>
            {/* Head */}
            <mesh position={[0, 0, 1.2]}>
              <sphereGeometry args={[0.35, 16, 16]} />
              <meshStandardMaterial
                color={styles.riderColor}
                emissive={styles.riderColor}
                emissiveIntensity={3}
                toneMapped={false}
              />
            </mesh>
          </group>
        )}

        {/* Pulsing Aura */}
        <mesh ref={auraRef} rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[2, 32, 32]} />
          <meshBasicMaterial
            color={styles.riderColor}
            transparent
            opacity={0.05 + stats.power / 2000}
          />
        </mesh>

        <pointLight
          ref={lightRef}
          distance={30}
          intensity={10}
          color={styles.riderColor}
        />
      </Trail>

      {/* Label — only visible during active ride */}
      {showYouLabel && (
        <Html position={[0, 4.5, 0]} center transform sprite distanceFactor={12} zIndexRange={[5, 0]} className="pointer-events-none" portal={undefined}>
          <div className="flex flex-col items-center gap-1 pointer-events-none">
            <div className="whitespace-nowrap rounded-full bg-black/70 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-md border border-white/30 shadow-lg">
              YOU
            </div>
            <div className="h-3 w-px bg-gradient-to-b from-white/60 to-transparent" />
          </div>
        </Html>
      )}
    </group>
  );
}

type SpeedLineData = {
  position: [number, number, number];
  speed: number;
  scale: number;
};

function SpeedLines({
  count = 20,
  theme = "neon",
}: {
  count?: number;
  theme?: VisualizerTheme;
}) {
  const styles = THEMES[theme];
  const meshRef = useRef<InstancedMesh>(null);
  const _matrix = useMemo(() => new Matrix4(), []);
  const _position = useMemo(() => new Vector3(), []);
  const _rotation = useMemo(() => new Euler(), []);
  const _scale = useMemo(() => new Vector3(), []);
  const _quaternion = useMemo(() => new Quaternion(), []);

  const [allLines] = useState<SpeedLineData[]>(() =>
    Array.from({ length: 50 }).map(() => ({
      position: [
        (Math.random() - 0.5) * 40,
        Math.random() * 20,
        (Math.random() - 0.5) * 100,
      ] as [number, number, number],
      speed: 0.5 + Math.random() * 2,
      scale: 0.1 + Math.random() * 0.5,
    })),
  );

  const visibleCount = Math.min(count, 50);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    for (let i = 0; i < visibleCount; i++) {
      const line = allLines[i];
      line.position[2] += line.speed * 200 * delta;
      if (line.position[2] > 50) line.position[2] = -150;

      _position.set(line.position[0], line.position[1], line.position[2]);
      _scale.set(1, 1, line.scale);
      _matrix.compose(_position, _quaternion, _scale);
      meshRef.current.setMatrixAt(i, _matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, 50]}>
      <boxGeometry args={[0.05, 0.05, 12]} />
      <meshBasicMaterial color={styles.lineColor} transparent opacity={0.5} />
    </instancedMesh>
  );
}

function FloatingParticles({ theme = "neon", stats, performanceTier = "high" }: { theme?: VisualizerTheme; stats: RiderStats; performanceTier?: string }) {
  const styles = THEMES[theme];
  const starsRef = useRef<any>(null);

  useFrame((state) => {
    if (!starsRef.current) return;
    // Stars move faster when rider is pushing more power
    const speed = 0.5 + (stats.power / 200);
    starsRef.current.rotation.y += 0.0001 * speed;
    starsRef.current.rotation.z += 0.0002 * speed;
  });

  if (!styles.stars) return null;

  const count = performanceTier === "high" ? 2000 : performanceTier === "medium" ? 1000 : 500;

  return (
    <Stars
      ref={starsRef}
      radius={120}
      depth={50}
      count={count}
      factor={4}
      saturation={theme === 'rainbow' ? 1 : 0}
      fade
      speed={0.5}
    />
  );
}

function BeatMarker({
  beat,
  curve,
  riderProgress,
  meshRef,
  index,
}: {
  beat: StoryBeat;
  curve: CatmullRomCurve3;
  riderProgress: number;
  meshRef: MutableRefObject<InstancedMesh | null>;
  index: number;
}) {
  const point = useMemo(() => {
    if (!Number.isFinite(beat.progress)) return new Vector3();
    const p = curve.getPointAt(Math.max(0, Math.min(1, beat.progress)));
    return isFiniteVector3(p) ? p.clone() : new Vector3();
  }, [curve, beat.progress]);

  const _matrix = useMemo(() => new Matrix4(), []);
  const _scaleVec = useMemo(() => new Vector3(1, 1, 1), []);
  const _quaternion = useMemo(() => new Quaternion(), []);
  const prevScaleRef = useRef(0);

  useFrame(() => {
    if (!meshRef.current || !isFiniteVector3(point)) return;

    const distance = Math.abs(riderProgress - beat.progress);
    const isApproaching = distance < 0.05 && riderProgress < beat.progress;
    const scale = isApproaching ? 1 + (0.05 - distance) * 10 : 1;

    // Only update if scale changed meaningfully to save GPU upload
    if (Math.abs(scale - prevScaleRef.current) < 0.001) return;
    prevScaleRef.current = scale;

    _scaleVec.set(scale, scale, scale);
    _matrix.compose(point, _quaternion, _scaleVec);
    meshRef.current.setMatrixAt(index, _matrix);
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const color =
    beat?.type === "sprint"
      ? "#ff4d4d"
      : beat?.type === "climb"
        ? "#fbbf24"
        : "#6d7cff";

  return (
    <group>
      <Html position={[point.x, point.y + 3, point.z]} center transform sprite distanceFactor={15} portal={undefined}>
        <div className="flex flex-col items-center gap-1 group">
          <div
            className="px-2 py-0.5 rounded-full text-[8px] font-bold text-white whitespace-nowrap border backdrop-blur-sm transition-all shadow-[0_0_10px_rgba(255,255,255,0.3)]"
            style={{ backgroundColor: `${color}80`, borderColor: color }}
          >
            {beat.label}
          </div>
          <div className="w-0.5 h-4 bg-gradient-to-b from-white/50 to-transparent" />
        </div>
      </Html>
      <BeatFlare progress={riderProgress} beatProgress={beat.progress} color={color} />
    </group>
  );
}

function BeatMarkers({ curve, storyBeats, riderProgress }: { curve: CatmullRomCurve3; storyBeats: StoryBeat[]; riderProgress: number }) {
  const meshRef = useRef<InstancedMesh>(null);
  const validBeats = storyBeats.filter((beat): beat is StoryBeat => beat != null);

  return (
    <group>
      <instancedMesh ref={meshRef} args={[null as any, null as any, validBeats.length]} frustumCulled={true}>
        <cylinderGeometry args={[0.5, 0.5, 0.1, 16]} />
        <meshStandardMaterial color="#6d7cff" emissive="#6d7cff" emissiveIntensity={2} />
      </instancedMesh>
      {validBeats.map((beat, i) => (
        <BeatMarker key={i} index={i} meshRef={meshRef} beat={beat} curve={curve} riderProgress={riderProgress} />
      ))}
    </group>
  );
}

function GhostRider({
  curve,
  progress,
  index,
  theme = "neon",
}: {
  curve: CatmullRomCurve3;
  progress: number;
  index: number;
  theme?: VisualizerTheme;
}) {
  const groupRef = useRef<Group>(null);
  const styles = THEMES[theme];
  const _lookAt = useMemo(() => new Vector3(), []);
  const _point = useMemo(() => new Vector3(), []);
  const _tangent = useMemo(() => new Vector3(), []);

  useFrame(() => {
    if (!groupRef.current) return;
    curve.getPointAt(progress, _point);
    curve.getTangentAt(progress, _tangent);
    if (!isFiniteVector3(_point) || !isFiniteVector3(_tangent)) return;
    groupRef.current.position.copy(_point);
    groupRef.current.position.y += 1.2;
    _lookAt.copy(_point).add(_tangent);
    groupRef.current.lookAt(_lookAt);
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.5, 1.2, 8]} />
        <meshStandardMaterial
          color={styles.riderColor}
          transparent
          opacity={0.3}
          metalness={1}
        />
      </mesh>
      <Html position={[0, 2, 0]} center transform sprite distanceFactor={10} portal={undefined}>
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded px-1.5 py-0.5 text-[8px] font-mono text-white/60">
          #{index + 2}
        </div>
      </Html>
    </group>
  );
}

function WelcomeSign({ theme, name, curve }: { theme: VisualizerTheme; name?: string; curve: CatmullRomCurve3 }) {
  const styles = THEMES[theme];
  const point = useMemo(() => curve.getPointAt(0.01), [curve]);
  const tangent = useMemo(() => curve.getTangentAt(0.01), [curve]);

  const groupRef = useRef<Group>(null);
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.lookAt(point.clone().add(tangent));
    }
  }, [point, tangent]);

  return (
    <group ref={groupRef} position={[point.x, point.y + 6, point.z]}>
      <Html center transform distanceFactor={8} portal={undefined}>
        <div
          className="text-center font-black whitespace-nowrap pointer-events-none select-none"
          style={{
            color: styles.lineColor,
            textShadow: `0 0 20px ${styles.lineColor}`,
            fontSize: '22px',
            lineHeight: '1.4',
          }}
        >
          WELCOME {name?.toUpperCase() ?? 'CHAMP'}
          <br />
          TO {styles.worldLabel.toUpperCase()}
        </div>
      </Html>
      <pointLight intensity={10} color={styles.lineColor} distance={20} />
    </group>
  );
}

function Scene({
  elevationProfile,
  theme = "neon",
  progress = 0,
  mode = "preview",
  storyBeats = [],
  ghosts = [],
  stats = { hr: 0, power: 0, cadence: 0 },
  avatar,
  equipment,
  quality,
  userDisplayName,
}: {
  elevationProfile: number[];
  theme?: VisualizerTheme;
  progress?: number;
  mode?: VisualizerMode;
  storyBeats?: StoryBeat[];
  ghosts?: number[];
  stats?: RiderStats;
  avatar?: AvatarAsset;
  equipment?: EquipmentAsset;
  quality?: {
    pixelRatio: number;
    shadows: boolean;
    antialiasing: boolean;
    particleCount: number;
    fps: number;
  };
  userDisplayName?: string;
}) {
  const curve = useRouteCurve(elevationProfile);
  const styles = THEMES[theme];
  const lastBeatRef = useRef<number>(-1);
  const smoothedLookTargetRef = useRef(new Vector3());
  const smoothedShakeRef = useRef(new Vector3());
  const _shakeTargetVec = useRef(new Vector3());
  const _riderPos = useMemo(() => new Vector3(), []);
  const _tangent = useMemo(() => new Vector3(), []);
  const _up = useMemo(() => new Vector3(), []);
  const _side = useMemo(() => new Vector3(), []);
  const _lookTarget = useMemo(() => new Vector3(), []);
  const _targetCamPos = useMemo(() => new Vector3(), []);
  const _tempVec = useMemo(() => new Vector3(), []);

  // Get performance tier for adaptive quality - use quality.fps as proxy if available
  const performanceTier = quality?.fps === 30 ? "low" : quality?.fps === 45 ? "medium" : "high";

  // --- Progress tracking via refs (no React state updates inside useFrame) ---
  // Calling setState inside useFrame triggers a full React re-render every animation
  // frame (60fps), cascading through every child in the scene tree and causing R3F to
  // rebuild geometry whose args arrays have new references.  We use mutable refs for
  // the hot path and only push to React state at ~10fps for HTML overlay elements.
  const previewProgressRef = useRef(START_OFFSET);
  const renderProgressRef = useRef(
    mode === "preview" ? START_OFFSET : mapToCurveProgress(progress),
  );
  const frameCountRef = useRef(0);
  // displayProgress drives HTML overlays (BeatMarker labels, ghost positions).
  // Throttled to ~10fps — smooth enough for text/UI, avoids constant re-renders.
  const [displayProgress, setDisplayProgress] = useState(renderProgressRef.current);

  useFrame((state, delta) => {
    // --- 1. Compute raw progress ---
    let rawProgress: number;
    if (mode === "preview") {
      previewProgressRef.current = (previewProgressRef.current + delta * 0.05) % 1;
      rawProgress = previewProgressRef.current;
    } else {
      rawProgress = progress;
    }

    const curveProgress = mode === "preview" ? rawProgress : mapToCurveProgress(rawProgress);
    renderProgressRef.current = curveProgress;

    // --- 2. Throttle React state to ~10fps for HTML overlay elements ---
    frameCountRef.current++;
    if (frameCountRef.current % 6 === 0) {
      setDisplayProgress(curveProgress);
    }

    // --- 3. Beat tracking (no state needed) ---
    storyBeats.forEach((beat, index) => {
      if (
        rawProgress >= beat.progress &&
        lastBeatRef.current < index &&
        Math.abs(rawProgress - beat.progress) < 0.02
      ) {
        lastBeatRef.current = index;
      }
    });
    if (rawProgress < 0.01) lastBeatRef.current = -1;

    // --- 4. Chase camera ---
    if (mode !== "preview") {
      const safeCurveP = Number.isFinite(curveProgress)
        ? Math.max(0, Math.min(curveProgress, 1))
        : START_OFFSET;
      _riderPos.copy(curve.getPointAt(safeCurveP));
      if (!Number.isFinite(_riderPos.x)) return;
      _riderPos.y -= 10; // match group offset [0, -10, 0]

      _tangent.copy(curve.getTangentAt(safeCurveP)).normalize();
      if (Math.abs(_tangent.y) > 0.98) {
        _up.set(1, 0, 0);
      } else {
        _up.set(0, 1, 0);
      }
      _side.crossVectors(_tangent, _up).normalize();

      _lookTarget.copy(_riderPos).add(_tempVec.set(0, 3, 0));
      
      _targetCamPos.copy(_riderPos)
        .add(_tempVec.copy(_tangent).multiplyScalar(-14))
        .add(_tempVec.copy(_side).multiplyScalar(3))
        .add(_tempVec.set(0, 10, 0));

      const lerpSpeed = mode === "ride" ? 0.06 : 0.04;
      state.camera.position.lerp(_targetCamPos, lerpSpeed);

      if (!isFiniteVector3(smoothedLookTargetRef.current) || smoothedLookTargetRef.current.lengthSq() === 0) {
        smoothedLookTargetRef.current.copy(_lookTarget);
      } else {
        smoothedLookTargetRef.current.lerp(_lookTarget, lerpSpeed * 2);
      }
      state.camera.lookAt(smoothedLookTargetRef.current);

      const cam = state.camera as ThreePerspectiveCamera;
      if (cam.fov !== undefined) {
        const baseFov = 60;
        const targetFov = baseFov + Math.min(25, (stats.power / 400) * 20);
        cam.fov = MathUtils.lerp(cam.fov, targetFov, 0.05);
        cam.updateProjectionMatrix();
      }

      if (stats.power > 350) {
        const shake = Math.min(1, (stats.power - 350) / 450);
        const rawShake = (Math.random() - 0.5) * shake * 0.08;
        _shakeTargetVec.current.set(rawShake, rawShake * 0.5, 0);
        smoothedShakeRef.current.lerp(_shakeTargetVec.current, 0.15);
      } else {
        _shakeTargetVec.current.set(0, 0, 0);
        smoothedShakeRef.current.lerp(_shakeTargetVec.current, 0.1);
      }
      state.camera.position.x += smoothedShakeRef.current.x;
      state.camera.position.y += smoothedShakeRef.current.y;
    }
  });

  // Adaptive particle count based on quality
  const particleCount = quality?.particleCount || 100;
  const sparkleCount = Math.min(particleCount, 20 + Math.floor(stats.power / 6));
  const speedLineCount = quality?.particleCount ? Math.min(30, Math.floor(stats.power / 8)) : 0;

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 100, 100]} fov={60} rotation={[-Math.PI / 3, 0, 0]} />
      <ambientLight intensity={0.5} />
      <pointLight
        position={[10, 50, 10]}
        intensity={1}
        color={theme === "mars" ? "#ef4444" : theme === "rainbow" ? "#ff00ff" : "#9b7bff"}
        castShadow={quality?.shadows}
      />
      <fog attach="fog" args={[styles.fog, 40, 250]} />

      <Environment preset={styles.envPreset} />

      {/* Dynamic atmospheric effects - disabled on low tier for performance */}
      <PostEffects theme={theme} stats={stats} mode={mode} performanceTier={performanceTier} />

      {/* Conditionally render expensive effects */}
      {particleCount > 100 && <FloatingParticles theme={theme} stats={stats} performanceTier={performanceTier} />}

      {mode === "ride" && speedLineCount > 0 && (
        <SpeedLines count={speedLineCount} theme={theme} />
      )}

      {sparkleCount > 0 && (
        <Sparkles
          count={sparkleCount}
          scale={100}
          size={Math.min(4, 1.5 + stats.power / 150)}
          speed={0.3 + (stats.cadence / 200)}
          color={styles.particleColor}
          opacity={Math.min(0.5, 0.1 + stats.power / 500)}
        />
      )}

      <group position={[0, -10, 0]}>
        {/* Adaptive road geometry resolution: high=150, medium=100, low=60 */}
        <Road
          curve={curve}
          theme={theme}
          stats={stats}
          steps={performanceTier === "high" ? 150 : performanceTier === "medium" ? 100 : 60}
        />
        <PropManager theme={theme} curve={curve} stats={stats} />
        <FinishLine curve={curve} theme={theme} />
        <WelcomeSign theme={theme} name={userDisplayName} curve={curve} />

        <RiderMarker
          curve={curve}
          progressRef={renderProgressRef}
          theme={theme}
          stats={stats}
          avatar={avatar}
          equipment={equipment}
          showYouLabel={mode === "ride"}
        />

        {storyBeats.length > 0 && (
          <BeatMarkers curve={curve} storyBeats={storyBeats} riderProgress={displayProgress} />
        )}

        {/* Limit ghosts on low-end devices */}
        {ghosts.slice(0, quality?.particleCount && quality.particleCount < 200 ? 3 : 10).map((g, i) => (
          <GhostRider key={i} index={i} curve={curve} progress={mapToCurveProgress(g)} theme={theme} />
        ))}

        {styles.grid && (
          <gridHelper
            args={[300, 30, theme === "rainbow" ? "#ff00ff" : "#2a1d5a", "#121a2d"]}
            position={[0, -2, 0]}
          />
        )}
      </group>

      {/* OrbitControls only in preview; during a ride the camera follows the rider */}
      {mode === "preview" && (
        <OrbitControls
          autoRotate
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI / 2}
          minDistance={20}
          maxDistance={150}
          enablePan={false}
          enableDamping={quality?.particleCount ? quality.particleCount > 200 : true}
        />
      )}
    </>
  );
}

export default function RouteVisualizer({
  elevationProfile = [
    120, 180, 140, 210, 260, 220, 280, 240, 300, 260, 320, 280,
  ],
  theme = "neon",
  progress = 0, // 0 to 1
  mode = "preview",
  stats = { hr: 145, power: 210, cadence: 90 },
  storyBeats = [],
  ghosts = [],
  className = "",
  onStatsUpdate,
  avatarId,
  equipmentId,
  quality,
  userDisplayName,
}: {
  elevationProfile?: number[];
  theme?: VisualizerTheme;
  progress?: number;
  mode?: VisualizerMode;
  stats?: RiderStats;
  storyBeats?: StoryBeat[];
  ghosts?: number[];
  className?: string;
  onStatsUpdate?: (stats: RiderStats) => void;
  avatarId?: string;
  equipmentId?: string;
  quality?: "low" | "medium" | "high";
  userDisplayName?: string;
}) {
  const adaptiveQuality = useAdaptiveQuality();
  const performanceTier = usePerformanceTier();

  // Determine effective quality settings
  const effectiveQuality = useMemo(() => {
    if (quality) {
      // Manual override
      return {
        pixelRatio: quality === "high" ? Math.min(window.devicePixelRatio, 2) : 1,
        shadows: quality === "high",
        antialiasing: quality !== "low",
        particleCount: quality === "high" ? 500 : quality === "medium" ? 200 : 100,
        fps: quality === "high" ? 60 : quality === "medium" ? 45 : 30,
      };
    }
    // Use adaptive quality
    return adaptiveQuality;
  }, [quality, adaptiveQuality]);

  const styles = THEMES[theme];

  const avatar = useMemo(() => AVATARS.find(a => a.id === avatarId), [avatarId]);
  const equipment = useMemo(() => EQUIPMENT.find(e => e.id === equipmentId), [equipmentId]);

  // Simulation loop for stats if progress is live
  useEffect(() => {
    if (performanceTier === "low") return; // Skip on low-end devices
    if (mode === "ride" && onStatsUpdate) {
      const interval = setInterval(() => {
        // Subtle randomization around the current stats
        const newStats = {
          hr: Math.round(stats.hr + (Math.random() - 0.5) * 4),
          power: Math.round(stats.power + (Math.random() - 0.5) * 10),
          cadence: Math.round(stats.cadence + (Math.random() - 0.5) * 2),
        };
        onStatsUpdate(newStats);
      }, 2000); // 2 seconds update for Sui telemetry
      return () => clearInterval(interval);
    }
  }, [mode, stats, onStatsUpdate, performanceTier]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl ${className}`}
      style={{
        background: `linear-gradient(to bottom, ${styles.skyTop}, ${styles.skyBottom})`,
      }}
    >
      {/* Horizon glow layer behind canvas */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 80%, ${styles.horizonGlow}44 0%, transparent 50%)`,
        }}
      />

      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-white/60 text-sm">Loading 3D route...</div>
        </div>
      }>
        <Canvas
          gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
          dpr={effectiveQuality.pixelRatio}
          frameloop={mode === "ride" ? "always" : "demand"}
          performance={{ min: 0.5 }}
        >
          <Scene
            elevationProfile={elevationProfile}
            theme={theme}
            progress={progress}
            mode={mode}
            storyBeats={storyBeats}
            ghosts={ghosts}
            stats={stats}
            avatar={avatar}
            equipment={equipment}
            quality={effectiveQuality}
            userDisplayName={userDisplayName}
          />
        </Canvas>
      </Suspense>

      {/* Overlay UI — only show in preview mode to avoid duplicating the ride HUD */}
      {mode === "preview" && (
        <div className="absolute bottom-4 left-4 z-10 flex gap-2">
          <div className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/70 backdrop-blur border border-white/10">
            Interactive Preview
          </div>
          <div className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-300 backdrop-blur border border-indigo-500/20">
            WebGL
          </div>
        </div>
      )}
    </div>
  );
}
