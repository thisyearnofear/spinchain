"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAdaptiveQuality } from "@/app/lib/responsive";
import {
  CatmullRomCurve3,
  Vector3,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ExtrudeGeometry,
  TubeGeometry,
  Group,
  PointLight,
  MathUtils,
  PerspectiveCamera as ThreePerspectiveCamera,
  Points,
  BackSide,
} from "three";
import * as THREE from "three";
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
  Text,
} from "@react-three/drei";
import { VISUALIZER_THEMES as THEMES, type VisualizerTheme } from "./visualizer-theme";
import { computeReactiveParams, type ReactiveParams } from "./world-reactivity";
import type { IntervalPhase } from "@/app/lib/phase-theme";
import type { FlowStateTier } from "@/app/lib/flow-state";
import type { ContextPalette } from "@/app/lib/context-palette";
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
  for (let i = 0; i < arr.length; i++) {
    if (!Number.isFinite(arr[i])) arr[i] = 0;
  }
  pos.needsUpdate = true;
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
  reactive = null,
}: {
  curve: CatmullRomCurve3;
  theme?: VisualizerTheme;
  stats?: RiderStats;
  steps?: number;
  reactive?: ReactiveParams | null;
}) {
  const meshRef = useRef<Mesh>(null);
  const styles = THEMES[theme];

  useFrame((state) => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as MeshStandardMaterial;

    // Dynamic emissive pulsing based on cadence
    const pulse = 0.5 + Math.sin(state.clock.elapsedTime * (stats.cadence / 20)) * 0.5;
    const baseEmissive = styles.roadEmissiveIntensity || 0;

    // Boost effect when sprinting
    const sprintFactor = Math.min(1, stats.power / 600);
    let emissiveIntensity = baseEmissive + (pulse * 0.1) + (sprintFactor * 0.4);
    let emissiveColor: string = styles.roadEmissive;

    // World reactivity: road glows with phase color and effort
    if (reactive) {
      emissiveIntensity = reactive.roadGlowIntensity;
      emissiveColor = reactive.roadGlowColor;
      // Add extra pulse during sprints
      if (state.clock.elapsedTime % 0.5 < 0.25) {
        emissiveIntensity *= 1.2;
      }
    }

    material.emissiveIntensity = emissiveIntensity;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (material.emissive as any).set(emissiveColor);

    // Dynamic color shift if on rainbow theme
    if (theme === 'rainbow') {
      const hue = (state.clock.elapsedTime / 10) % 1;
      material.emissive.setHSL(hue, 1, 0.5);
    }
  });

  const geometry = useMemo(() => {
    const shape = new Shape();
    const width = theme === "rainbow" ? 4 : 2.5;
    const height = 0.5;

    // Create a trapezoid road profile
    shape.moveTo(-width, 0);
    shape.lineTo(width, 0);
    shape.lineTo(width * 0.9, height);
    shape.lineTo(-width * 0.9, height);
    shape.lineTo(-width, 0);

    const geo = new ExtrudeGeometry(shape, {
      steps,
      extrudePath: curve,
      bevelEnabled: false,
    });
    sanitizeGeometry(geo);
    return geo;
  }, [curve, theme, steps]);

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial
          color={styles.roadColor}
          emissive={styles.roadEmissive}
          emissiveIntensity={styles.roadEmissiveIntensity}
          roughness={0.2}
          metalness={0.9}
        />
      </mesh>
      <RoadMarkings curve={curve} theme={theme} steps={steps} reactive={reactive} />
    </group>
  );
}

function RoadMarkings({
  curve,
  theme = "neon",
  steps = 300,
  reactive = null,
}: {
  curve: CatmullRomCurve3;
  theme?: VisualizerTheme;
  steps?: number;
  reactive?: ReactiveParams | null;
}) {
  const styles = THEMES[theme];

  const { dashGeometry, edgeGeometry } = useMemo(() => {
    // Dash lines use slightly fewer steps than the road surface
    const dashSteps = Math.max(60, Math.round(steps * 0.65));

    const dashShape = new Shape();
    dashShape.moveTo(-0.1, 0.51);
    dashShape.lineTo(0.1, 0.51);
    dashShape.lineTo(0.1, 0.52);
    dashShape.lineTo(-0.1, 0.52);
    dashShape.lineTo(-0.1, 0.51);

    const dashGeo = new ExtrudeGeometry(dashShape, {
      steps: dashSteps,
      extrudePath: curve,
      bevelEnabled: false,
    });
    sanitizeGeometry(dashGeo);

    // Edge lines
    const edgeShape = new Shape();
    const width = theme === "rainbow" ? 3.8 : 2.3;

    // Left edge
    edgeShape.moveTo(-width, 0.51);
    edgeShape.lineTo(-width + 0.15, 0.51);
    edgeShape.lineTo(-width + 0.15, 0.53);
    edgeShape.lineTo(-width, 0.53);
    edgeShape.lineTo(-width, 0.51);

    // Right edge
    edgeShape.moveTo(width - 0.15, 0.51);
    edgeShape.lineTo(width, 0.51);
    edgeShape.lineTo(width, 0.53);
    edgeShape.lineTo(width - 0.15, 0.53);
    edgeShape.lineTo(width - 0.15, 0.51);

    const edgeGeo = new ExtrudeGeometry(edgeShape, {
      steps,
      extrudePath: curve,
      bevelEnabled: false,
    });
    sanitizeGeometry(edgeGeo);

    return { dashGeometry: dashGeo, edgeGeometry: edgeGeo };
  }, [curve, theme, steps]);

  const dashRef = useRef<THREE.Mesh>(null);
  const edgeRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    // Reactive line glow during high effort
    if (reactive) {
      const dashMat = dashRef.current?.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
      const edgeMat = edgeRef.current?.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
      if (dashMat && 'emissiveIntensity' in dashMat) {
        dashMat.emissiveIntensity = reactive.roadGlowIntensity * 3;
      }
      if (edgeMat && 'emissiveIntensity' in edgeMat) {
        edgeMat.emissiveIntensity = reactive.roadGlowIntensity * 6;
      }
      // Pulse edge glow during sprints
      if (state.clock.elapsedTime % 0.4 < 0.2) {
        if (edgeMat && 'emissiveIntensity' in edgeMat) {
          (edgeMat as THREE.MeshStandardMaterial).emissiveIntensity *= 1.3;
        }
      }
    }
  });

  return (
    <group>
      {/* Dashed center line */}
      <mesh ref={dashRef} geometry={dashGeometry}>
        <meshStandardMaterial
          color={styles.lineColor}
          emissive={styles.lineColor}
          emissiveIntensity={styles.roadEmissiveIntensity * 5}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Edge glowing strips */}
      <mesh ref={edgeRef} geometry={edgeGeometry}>
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

      <Html position={[0, 8, 0]} center zIndexRange={[5, 0]}>
        <div className="text-white font-black px-4 py-1 rounded-sm skew-x-12 border-2 border-white animate-pulse" style={{ backgroundColor: `${styles.horizonGlow}cc`, boxShadow: `0 0 20px ${styles.horizonGlow}` }}>
          FINISH
        </div>
      </Html>

      <pointLight distance={20} intensity={20} color={styles.lineColor} />
    </group>
  );
}

function PropManager({ theme = "neon", curve, stats, reactive = null }: { theme?: VisualizerTheme; curve: CatmullRomCurve3; stats: RiderStats; reactive?: ReactiveParams | null }) {
  const themeData = THEMES[theme];
  const propConfig = themeData.props;
  const meshGroupRef = useRef<Group>(null);

  useFrame((state) => {
    if (!meshGroupRef.current) return;

    const pulseBase = 1 + Math.sin(state.clock.elapsedTime * (stats.cadence / 15)) * 0.05;
    meshGroupRef.current.children.forEach((child) => {
      const mesh = child as Mesh;
      if (mesh.material) {
        const mat = mesh.material as MeshStandardMaterial;
        if (theme === 'neon' || theme === 'rainbow') {
          let baseIntensity = theme === 'neon' ? 0.5 : 0.8;
          // World reactivity: props pulse harder during sprints
          if (reactive) {
            baseIntensity = reactive.propEmissiveIntensity;
            // Extra pulse during sprints
            if (state.clock.elapsedTime % 0.5 < 0.25) {
              baseIntensity *= 1.25;
            }
          }
          mat.emissiveIntensity = baseIntensity + (pulseBase - 1) * 2;
        }
      }
    });
  });
  // Deterministic random using index as seed (avoids Math.random during render)
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
  };

  const propPoints = useMemo(() => {
    if (!propConfig) return [];
    const points = [];
    for (let i = 0; i < propConfig.count; i++) {
      const p = seededRandom(i);
      const point = curve.getPointAt(p);
      const tangent = curve.getTangentAt(p);
      const side = new Vector3().crossVectors(tangent, new Vector3(0, 1, 0)).normalize();

      // Alternate sides, move out from road
      const dist = 8 + seededRandom(i + 1000) * 15;
      const offset = side.multiplyScalar(i % 2 === 0 ? dist : -dist);

      points.push({
        position: [point.x + offset.x, point.y + offset.y + (propConfig.type === 'building' ? propConfig.scale[1] / 2 : 0), point.z + offset.z] as [number, number, number],
        rotation: [0, seededRandom(i + 2000) * Math.PI, 0] as [number, number, number],
        scale: [
          propConfig.scale[0] * (0.8 + seededRandom(i + 3000) * 0.4),
          propConfig.scale[1] * (0.5 + seededRandom(i + 4000) * 1.5),
          propConfig.scale[2] * (0.8 + seededRandom(i + 5000) * 0.4),
        ] as [number, number, number],
      });
    }
    return points;
  }, [curve, propConfig]);

  if (!propConfig) return null;

  return (
    <group ref={meshGroupRef}>
      {propPoints.map((p, i) => (
        <mesh key={i} position={p.position} rotation={p.rotation} scale={p.scale}>
          {propConfig.type === 'building' ? (
            <boxGeometry />
          ) : propConfig.type === 'tree' ? (
            <coneGeometry args={[1, 4, 8]} />
          ) : propConfig.type === 'rock' ? (
            <dodecahedronGeometry />
          ) : (
            <sphereGeometry />
          )}
          <meshStandardMaterial
            color={propConfig.color}
            emissive={propConfig.color}
            emissiveIntensity={theme === 'neon' ? 0.5 : 0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

function PostEffects({ theme = "neon", stats, performanceTier = "high", reactive = null }: { theme: VisualizerTheme; stats: RiderStats; performanceTier?: "high" | "medium" | "low"; reactive?: ReactiveParams | null }) {
  // Note: styles reserved for future theming of post-effects

  const powerFactor = Math.min(1, stats.power / 600);
  const intensityMultiplier = performanceTier === "low" ? 0 : performanceTier === "medium" ? 0.5 : 1;
  let bloomIntensity = (0.5 + powerFactor * 2.0) * intensityMultiplier;
  let chromaticOffset = stats.power > 300 ? powerFactor * 0.005 * intensityMultiplier : 0;
  const noiseOpacity = theme === 'neon' ? 0.03 * intensityMultiplier : 0;

  // World reactivity: bloom intensifies during sprints
  if (reactive) {
    bloomIntensity = reactive.bloomIntensity * intensityMultiplier;
    chromaticOffset = reactive.chromaticOffset * intensityMultiplier;
  }

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const effects = useMemo(() => {
    if (performanceTier === "low") return [];
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
      const vignetteDarkness = reactive ? reactive.vignetteDarkness : 0.8;
      e.push(<Vignette key="vignette" eskil={false} offset={0.15} darkness={vignetteDarkness} />);
    }
    return e;
  }, [bloomIntensity, chromaticOffset, noiseOpacity, performanceTier, reactive?.vignetteDarkness]);

  if (performanceTier === "low" || effects.length === 0) return null;

  return (
    <EffectComposer multisampling={performanceTier === "high" ? 8 : 0}>
      {effects}
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
    const geo = new TubeGeometry(curve, 64, 2.5, 8, true);
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
  const [displayProgress, setDisplayProgress] = useState(0);

  // Throttle progress text via interval, not useFrame (r3f-no-state-in-use-frame).
  useEffect(() => {
    setDisplayProgress(progressRef.current);
    const id = setInterval(() => setDisplayProgress(progressRef.current), 100);
    return () => clearInterval(id);
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const breathe = Math.sin(state.clock.elapsedTime * 2.5) * 0.08;
    groupRef.current.position.y = 1.9 + breathe;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.08;
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

      <Html transform distanceFactor={5.5} position={[0, 0.2, 0.02]} scale={0.1} zIndexRange={[5, 0]}>
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
  reactive = null,
}: {
  curve: CatmullRomCurve3;
  progressRef: MutableRefObject<number>;
  theme?: VisualizerTheme;
  stats?: RiderStats;
  avatar?: AvatarAsset;
  equipment?: EquipmentAsset;
  showYouLabel?: boolean;
  reactive?: ReactiveParams | null;
}) {
  const groupRef = useRef<Group>(null);
  const styles = THEMES[theme];

  const auraRef = useRef<Mesh>(null);
  const lightRef = useRef<PointLight>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    const progress = progressRef.current;
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress);

    // Guard against NaN positions from degenerate curves
    if (isNaN(point.x) || isNaN(point.y) || isNaN(point.z)) return;

    // Update position
    groupRef.current.position.copy(point);
    // Lift slightly above road
    groupRef.current.position.y += equipment?.type === "vehicle" ? 2.5 : 1.5;

    // getTangentAt can return NaN independently of getPointAt near a closed
    // curve's near-zero-length segments (most likely right at ride start,
    // where progress sits close to the wrap boundary). Feeding a NaN tangent
    // into lookAt() sets a NaN rotation quaternion, which NaN-poisons this
    // group's world matrix — and <Trail> below samples that world position
    // every frame, baking the NaN into its geometry (visible as a burst of
    // THREE.BufferGeometry NaN warnings that self-heals once progress moves
    // off the degenerate value).
    if (Number.isFinite(tangent.x) && Number.isFinite(tangent.y) && Number.isFinite(tangent.z)) {
      const lookAt = point.clone().add(tangent);
      groupRef.current.lookAt(lookAt);
    }

    // Reactive pulsing
    if (auraRef.current) {
      let pulse = 1 + Math.sin(state.clock.elapsedTime * (stats.cadence / 15)) * 0.2;
      // World reactivity: aura scales with effort + phase
      if (reactive) {
        pulse *= reactive.riderAuraScale;
      }
      auraRef.current.scale.set(pulse, pulse, pulse);
    }

    if (lightRef.current) {
      let lightIntensity = 5 + (stats.hr / 40) * 5;
      if (reactive) {
        lightIntensity = reactive.riderLightIntensity;
      }
      lightRef.current.intensity = lightIntensity;
    }
  });

  // Power-reactive trail length
  const trailLength = Math.min(30, 5 + stats.power / 15);
  const trailColor = reactive ? reactive.riderTrailColor : styles.riderColor;

  return (
    <group ref={groupRef}>
      {/* Immerive 3D HUD that follows the rider */}
      {showYouLabel && <HoloHUD stats={stats} theme={theme} curve={curve} progressRef={progressRef} />}

      <Trail
        width={2 + stats.power / 200}
        length={trailLength}
        color={trailColor}
        attenuation={(t) => t * t}
      >
        <Float speed={5} rotationIntensity={0.2} floatIntensity={0.5}>
          {/* Avatar and Equipment Models */}
          {avatar && (
            <group position={[0, equipment?.type === "bike" ? 0.8 : 0, 0]}>
              <Model url={avatar.modelUrl} scale={1.5} rotation={[0, Math.PI, 0]} />
            </group>
          )}

          {equipment ? (
            <Model url={equipment.modelUrl} scale={equipment.type === "vehicle" ? 2 : 1.2} />
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
              opacity={reactive ? reactive.riderAuraOpacity : 0.05 + stats.power / 2000}
            />
          </mesh>

          <pointLight
            ref={lightRef}
            distance={30}
            intensity={10}
            color={styles.riderColor}
          />
        </Float>
      </Trail>

      {/* Label — only visible during active ride */}
      {showYouLabel && (
        <Html position={[0, 4.5, 0]} center transform sprite distanceFactor={12} zIndexRange={[5, 0]} className="pointer-events-none">
          <div className="flex flex-col items-center gap-1 pointer-events-none">
            <div className="whitespace-nowrap rounded-full bg-black/70 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-md border border-white/30 shadow-lg">
              <span className="mr-1" aria-hidden>🚴</span>YOU
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
  reactive = null,
  stats = { power: 0, cadence: 0, hr: 0 },
}: {
  count?: number;
  theme?: VisualizerTheme;
  reactive?: ReactiveParams | null;
  stats?: RiderStats;
}) {
  const styles = THEMES[theme];
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

  const visibleLines = allLines.slice(0, Math.min(count, 50));

  return (
    <group>
      {visibleLines.map((line, i) => (
        <LineInstance
          key={i}
          line={line}
          color={reactive ? reactive.speedLineColor : styles.lineColor}
          reactive={reactive}
          stats={stats}
        />
      ))}
    </group>
  );
}

function LineInstance({ line, color, reactive = null, stats = { power: 0, cadence: 0, hr: 0 } }: {
  line: SpeedLineData;
  color: string;
  reactive?: ReactiveParams | null;
  stats?: RiderStats;
}) {
  const ref = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (!ref.current) return;
    let speed = line.speed * 200;
    // World reactivity: speed lines rush past during high effort
    if (reactive) {
      speed *= reactive.speedLineSpeed;
    } else {
      // Baseline cadence reactivity
      speed *= 1 + (stats.cadence / 120) * 0.5;
    }
    ref.current.position.z += speed * delta;
    if (ref.current.position.z > 50) ref.current.position.z = -150;

    // Pulse opacity during sprints
    if (reactive) {
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      const baseOpacity = reactive.speedLineOpacity;
      if (state.clock.elapsedTime % 0.3 < 0.15) {
        mat.opacity = baseOpacity * 1.3;
      } else {
        mat.opacity = baseOpacity;
      }
    }
  });

  return (
    <mesh ref={ref} position={line.position} rotation={[0, 0, 0]}>
      <boxGeometry args={[0.05, 0.05, 12 * line.scale]} />
      <meshBasicMaterial color={color} transparent opacity={reactive ? reactive.speedLineOpacity : 0.5} />
    </mesh>
  );
}

function FloatingParticles({ theme = "neon", stats, reactive = null }: { theme?: VisualizerTheme; stats: RiderStats; reactive?: ReactiveParams | null }) {
  const styles = THEMES[theme];
  const starsRef = useRef<Points>(null);

  useFrame(() => {
    if (!starsRef.current) return;
    let speed = 0.5 + (stats.power / 200);
    // World reactivity: stars rotate faster during sprints
    if (reactive) {
      speed = reactive.starsRotationSpeed;
    }
    starsRef.current.rotation.y += 0.0001 * speed;
    starsRef.current.rotation.z += 0.0002 * speed;
  });

  if (!styles.stars) return null;

  return (
    <Stars
      ref={starsRef}
      radius={120}
      depth={50}
      count={4000}
      factor={6}
      saturation={theme === 'rainbow' ? 1 : 0}
      fade
      speed={reactive ? reactive.sparkleSpeed : 1}
    />
  );
}

function BeatMarker({
  beat,
  curve,
  riderProgress,
}: {
  beat: StoryBeat;
  curve: CatmullRomCurve3;
  riderProgress: number;
}) {
  const point = useMemo(() => {
    if (!Number.isFinite(beat.progress)) return new Vector3(0, 0, 0);
    const p = curve.getPointAt(Math.max(0, Math.min(1, beat.progress)));
    return isFiniteVector3(p) ? p : new Vector3(0, 0, 0);
  }, [curve, beat.progress]);

  // Proximity logic for animation
  const distance = Math.abs(riderProgress - beat.progress);
  const isApproaching = distance < 0.05 && riderProgress < beat.progress;
  const scale = isApproaching ? 1 + (0.05 - distance) * 10 : 1;
  const glow = isApproaching ? (0.05 - distance) * 20 : 0;

  const color =
    beat.type === "sprint"
      ? "#ff4d4d"
      : beat.type === "climb"
        ? "#fbbf24"
        : "#6d7cff";

  return (
    <group position={[point.x, point.y + 3, point.z]} scale={scale}>
      <Html center transform sprite distanceFactor={15} zIndexRange={[5, 0]}>
        <div className="flex flex-col items-center gap-1 group">
          <div
            className={`px-2 py-0.5 rounded-full text-[8px] font-bold text-white whitespace-nowrap border backdrop-blur-sm transition-all shadow-[0_0_10px_rgba(255,255,255,0.3)]`}
            style={{
              backgroundColor: `${color}80`,
              borderColor: color,
              boxShadow: isApproaching ? `0 0 ${glow}px ${color}` : 'none'
            }}
          >
            {beat.label}
          </div>
          <div className="w-0.5 h-4 bg-gradient-to-b from-white/50 to-transparent" />
        </div>
      </Html>
      <mesh position={[0, -3, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.1, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2 + glow}
        />
      </mesh>
      <BeatFlare progress={riderProgress} beatProgress={beat.progress} color={color} />
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

  useFrame(() => {
    if (!groupRef.current) return;
    const point = curve.getPointAt(progress);
    // Guard: degenerate curve positions produce NaN; skip the frame rather than
    // propagating garbage coordinates to child geometries.
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) return;
    const tangent = curve.getTangentAt(progress);
    groupRef.current.position.copy(point);
    groupRef.current.position.y += 1.2;
    const lookAt = point.clone().add(tangent);
    groupRef.current.lookAt(lookAt);
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
      <Html position={[0, 2, 0]} center transform sprite distanceFactor={10} zIndexRange={[5, 0]}>
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
      <Text
        fontSize={2}
        color={styles.lineColor}
        maxWidth={20}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
      >
        {`WELCOME ${name?.toUpperCase() || 'CHAMP'}\nTO ${styles.worldLabel.toUpperCase()}`}
      </Text>
      <pointLight intensity={10} color={styles.lineColor} distance={20} />
    </group>
  );
}

/**
 * Caps the render loop to a target fps instead of the display's native
 * refresh rate. Pairs with <Canvas frameloop="demand"> — R3F only renders
 * (and runs useFrame callbacks) when invalidate() is called, so this drives
 * that call on its own rAF loop, downsampled to the target interval. Without
 * this, "always" frameloop renders at native refresh rate (e.g. 120Hz on
 * newer devices) for the whole ride regardless of the computed quality tier.
 */
function FrameRateLimiter({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    let rafId: number;
    let lastMs = 0;
    const intervalMs = 1000 / fps;

    const loop = (nowMs: number) => {
      if (nowMs - lastMs >= intervalMs) {
        lastMs = nowMs;
        invalidate();
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  }, [fps, invalidate]);

  return null;
}

function CanvasContextLossHandler() {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => e.preventDefault();
    const onRestored = () => invalidate();
    canvas.addEventListener("webglcontextlost", onLost, false);
    canvas.addEventListener("webglcontextrestored", onRestored, false);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost, false);
      canvas.removeEventListener("webglcontextrestored", onRestored, false);
    };
  }, [gl, invalidate]);
  return null;
}

// ─── Flow Celebration ───────────────────────────────────────────────
// Triggers celebration particles when flow tier increases

interface FlowCelebrationProps {
  effect: { tier: number; startedAt: number } | null;
}

function FlowCelebration({ effect }: FlowCelebrationProps) {
  const groupRef = useRef<Group>(null);
  const startedAtRef = useRef<number | null>(null);

  useFrame((state) => {
    if (!effect || !groupRef.current) return;

    // Reset when a new celebration begins
    if (startedAtRef.current === null) {
      startedAtRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startedAtRef.current;
    if (elapsed > 3) {
      startedAtRef.current = null;
      return;
    }

    // Fade out celebration particles over 3 seconds
    const progress = elapsed / 3;
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.8 * (1 - progress));
      mesh.scale.multiplyScalar(1.02);
    });
  });

  // eslint-disable-next-line react-hooks/refs
  if (!effect || startedAtRef.current === null) return null;

  return (
    <group ref={groupRef}>
      {/* Celebration burst particles */}
      {Array.from({ length: 20 + effect.tier * 10 }).map((_, i) => {
        const angle = (i / (20 + effect.tier * 10)) * Math.PI * 2;
        const radius = 2 + effect.tier * 0.5;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              Math.sin(angle) * radius + 3,
              0,
            ]}
          >
            <sphereGeometry args={[0.1, 8, 8]}
            />
            <meshBasicMaterial color={"#f59e0b"} transparent opacity={0.8} />
          </mesh>
        );
      })}
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
  intervalPhase = null,
  flowTier = 0,
  contextPalette,
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
  intervalPhase?: IntervalPhase;
  flowTier?: FlowStateTier;
  contextPalette?: ContextPalette;
}) {
  const curve = useRouteCurve(elevationProfile);
  const styles = THEMES[theme];
  const lastBeatRef = useRef<number>(-1);
  const smoothedLookTargetRef = useRef(new Vector3());
  const smoothedShakeRef = useRef(new Vector3());
  const _shakeTargetVec = useRef(new Vector3());

  // ─── Flow Tier Tracking ────────────────────────────────────────
  const previousFlowTierRef = useRef<FlowStateTier | null>(null);
  const [currentFlowEffect, setCurrentFlowEffect] = useState<{
    tier: number;
    startedAt: number;
  } | null>(null);

  // Detect flow tier changes
  useEffect(() => {
    if (flowTier && flowTier > (previousFlowTierRef.current ?? 0)) {
      // Flow tier increased — trigger celebration
      const celebration = {
        tier: flowTier,
        startedAt: performance.now(),
      };
      setCurrentFlowEffect(celebration);
      // Auto-clear after 3 seconds — track timeout for cleanup
      const t = setTimeout(() => {
        setCurrentFlowEffect((prev) => (prev && prev.startedAt < performance.now() - 3000 ? null : prev));
      }, 3000);
      previousFlowTierRef.current = flowTier ?? 0;
      return () => clearTimeout(t);
    }
    previousFlowTierRef.current = flowTier ?? 0;
  }, [flowTier]);

  // Mouse parallax — subtle camera offset based on pointer position
  const mouseParallaxRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const driftTimeRef = useRef(0);

  // Get performance tier for adaptive quality - use quality.fps as proxy if available
  const performanceTier = quality?.fps === 30 ? "low" : quality?.fps === 45 ? "medium" : "high";

  // ─── Flow State Visual Scaling ─────────────────────────────────
  // Flow tier scales all reactive parameters proportionally.
  // Tier 0 = baseline, Tier 4 = 2.2x visual intensity
  const FLOW_SCALING = [1, 1.2, 1.5, 1.8, 2.2];
  const flowScale = FLOW_SCALING[flowTier] ?? 1;

  // ─── Flow Color Palette ────────────────────────────────────────
  // Each flow tier has a distinct color that tints the entire world
  const FLOW_COLORS = [
    null, // Tier 0: no flow color
    "#34d399", // Tier 1: Focused (green)
    "#f59e0b", // Tier 2: Flow (amber)
    "#f97316", // Tier 3: Super Flow (orange)
    "#ef4444", // Tier 4: Mastery (red)
  ];
  const flowColor = FLOW_COLORS[flowTier] ?? null;
  const showFlowEffects = flowTier >= 1;

  // --- Compute reactive world parameters from effort + phase + flow ---
  const reactive = useMemo(() => {
    if (mode !== "ride") return null;
    const base = computeReactiveParams(theme, stats, intervalPhase, progress);
    // Apply flow state scaling
    return {
      ...base,
      bloomIntensity: base.bloomIntensity * flowScale,
      chromaticOffset: base.chromaticOffset * flowScale,
      vignetteDarkness: Math.min(1, base.vignetteDarkness + flowTier * 0.05),
      fogDensity: Math.max(15, base.fogDensity - flowTier * 5),
      starsRotationSpeed: base.starsRotationSpeed * flowScale,
      sparklesSpeed: base.sparkleSpeed * flowScale,
      sparkleOpacity: Math.min(0.8, base.sparkleOpacity + flowTier * 0.05),
      roadGlowIntensity: base.roadGlowIntensity * flowScale,
      riderAuraScale: base.riderAuraScale * (1 + flowTier * 0.15),
      riderLightIntensity: base.riderLightIntensity * flowScale,
    };
  }, [theme, stats, intervalPhase, progress, mode, flowTier, flowScale]);

  // --- Progress tracking via refs (no React state updates inside useFrame) ---
  // Calling setState inside useFrame triggers a full React re-render every animation
  // frame (60fps), cascading through every child in the scene tree and causing R3F to
  // rebuild geometry whose args arrays have new references.  We use mutable refs for
  // the hot path and only push to React state at ~10fps for HTML overlay elements.
  const previewProgressRef = useRef(START_OFFSET);
  const renderProgressRef = useRef(
    mode === "preview" ? START_OFFSET : mapToCurveProgress(progress),
  );
  // displayProgress drives HTML overlays (BeatMarker labels, ghost positions).
  // Throttled to ~10fps via interval to avoid setState in useFrame (r3f-no-state-in-use-frame).
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    setDisplayProgress(renderProgressRef.current);
    const id = setInterval(() => setDisplayProgress(renderProgressRef.current), 100);
    return () => clearInterval(id);
  }, []);

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

    // --- 2. Beat tracking (no state needed) ---
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
      const riderPos = curve.getPointAt(safeCurveP);
      if (!Number.isFinite(riderPos.x)) return;
      riderPos.y -= 10; // match group offset [0, -10, 0]

      const rawTangent = curve.getTangentAt(safeCurveP);
      // Same class of bug as RiderMarker: getTangentAt can be NaN near a
      // closed curve's near-zero-length segments even when getPointAt is
      // fine. Unlike RiderMarker's self-healing Trail buffer, camera.lerp()
      // toward a NaN target permanently poisons camera.position (NaN in,
      // NaN out on every subsequent lerp) — skip the frame instead.
      if (!Number.isFinite(rawTangent.x) || !Number.isFinite(rawTangent.y) || !Number.isFinite(rawTangent.z)) {
        return;
      }
      const tangent = rawTangent.normalize();
      const up = Math.abs(tangent.y) > 0.98 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
      const side = new Vector3().crossVectors(tangent, up).normalize();

      const lookTarget = riderPos.clone().add(new Vector3(0, 3, 0));
      const targetCamPos = riderPos
        .clone()
        .add(tangent.clone().multiplyScalar(-14))
        .add(side.multiplyScalar(3))
        .add(new Vector3(0, 10, 0));

      const lerpSpeed = mode === "ride" ? 0.06 : 0.04;
      state.camera.position.lerp(targetCamPos, lerpSpeed);

      if (!isFiniteVector3(smoothedLookTargetRef.current) || smoothedLookTargetRef.current.lengthSq() === 0) {
        smoothedLookTargetRef.current.copy(lookTarget);
      } else {
        smoothedLookTargetRef.current.lerp(lookTarget, lerpSpeed * 2);
      }
      state.camera.lookAt(smoothedLookTargetRef.current);

      const cam = state.camera as ThreePerspectiveCamera;
      if (cam.fov !== undefined) {
        let targetFov = 60;
        if (reactive) {
          targetFov = reactive.fovTarget;
        } else {
          targetFov = 60 + Math.min(25, (stats.power / 400) * 20);
        }
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

      // Subtle mouse parallax — offsets camera based on pointer for depth perception
      mouseParallaxRef.current.targetX = state.pointer.x * 1.5;
      mouseParallaxRef.current.targetY = state.pointer.y * 0.8;
      mouseParallaxRef.current.x += (mouseParallaxRef.current.targetX - mouseParallaxRef.current.x) * 0.04;
      mouseParallaxRef.current.y += (mouseParallaxRef.current.targetY - mouseParallaxRef.current.y) * 0.04;
      state.camera.position.x += mouseParallaxRef.current.x;
      state.camera.position.y += mouseParallaxRef.current.y;
    }

    // --- 5. Gentle drift for preview mode (sine-wave camera offset) ---
    if (mode === "preview") {
      driftTimeRef.current += delta;
      const driftX = Math.sin(driftTimeRef.current * 0.3) * 0.6;
      const driftY = Math.cos(driftTimeRef.current * 0.2) * 0.3;
      state.camera.position.x += driftX;
      state.camera.position.y += driftY;
    }
  });

  // Adaptive particle count based on quality
  const particleCount = quality?.particleCount || 200;
  const sparkleCount = Math.min(particleCount, 30 + Math.floor(stats.power / 4));
  const speedLineCount = quality?.particleCount ? Math.min(50, Math.floor(stats.power / 5)) : 0;

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 100, 100]} fov={60} rotation={[-Math.PI / 3, 0, 0]} />
      <ambientLight intensity={reactive ? reactive.ambientIntensity : 0.5} />
      <pointLight
        position={[10, 50, 10]}
        intensity={reactive ? reactive.pointLightIntensity : 1}
        color={reactive ? reactive.pointLightColor : (theme === "mars" ? "#ef4444" : theme === "rainbow" ? "#ff00ff" : "#9b7bff")}
        castShadow={quality?.shadows}
      />
      <fog attach="fog" args={[reactive ? reactive.fogColor : styles.fog, reactive ? reactive.fogDensity : 40, 250]} />

      <Environment preset={styles.envPreset} />

      {/* Dynamic atmospheric effects - disabled on low tier for performance */}
      <PostEffects theme={theme} stats={stats} performanceTier={performanceTier} reactive={reactive} />

      {/* Conditionally render expensive effects */}
      {particleCount > 100 && <FloatingParticles theme={theme} stats={stats} reactive={reactive} />}

      {mode === "ride" && speedLineCount > 0 && (
        <SpeedLines count={speedLineCount} theme={theme} reactive={reactive} stats={stats} />
      )}

      {sparkleCount > 0 && (
        <Sparkles
          count={sparkleCount}
          scale={100}
          size={Math.min(4, 1.5 + stats.power / 150)}
          speed={reactive ? reactive.sparkleSpeed : 0.3 + (stats.cadence / 200)}
          color={reactive ? reactive.sparkleColor : styles.particleColor}
          opacity={reactive ? reactive.sparkleOpacity : Math.min(0.5, 0.1 + stats.power / 500)}
        />
      )}

      {/* ─── Flow State Effects ───────────────────────────────────── */}
      {showFlowEffects && mode === "ride" && (
        <>
          {/* Flow-colored ambient overlay */}
          <mesh>
            <sphereGeometry args={[150, 32, 32]} />
            <meshBasicMaterial
              color={flowColor ?? undefined}
              transparent
              opacity={0.03 + flowTier * 0.02}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>

          {/* Flow golden particles — scale with tier */}
          <Sparkles
            count={flowTier * 200}
            scale={80}
            size={Math.min(3, 1 + flowTier * 0.3)}
            speed={0.5 + flowTier * 0.3}
            color={flowColor ?? "#f59e0b"}
            opacity={Math.min(0.7, 0.1 + flowTier * 0.1)}
          />

          {/* Flow milestone celebration — burst particles on tier changes */}
          <FlowCelebration effect={currentFlowEffect} />
        </>
      )}

      <group position={[0, -10, 0]}>
        {/* Adaptive road geometry resolution: high=600, medium=250, low=100 */}
        <Road
          curve={curve}
          theme={theme}
          stats={stats}
          steps={performanceTier === "high" ? 600 : performanceTier === "medium" ? 250 : 100}
          reactive={reactive}
        />
        <PropManager theme={theme} curve={curve} stats={stats} reactive={reactive} />
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
          reactive={reactive}
        />

        {/* Limit ghosts on low-end devices */}
        {ghosts.slice(0, quality?.particleCount && quality.particleCount < 200 ? 3 : 10).map((g, i) => (
          <GhostRider key={i} index={i} curve={curve} progress={mapToCurveProgress(g)} theme={theme} />
        ))}

        {storyBeats.map((beat, i) => (
          <BeatMarker key={i} beat={beat} curve={curve} riderProgress={displayProgress} />
        ))}

        {styles.grid && (
          <gridHelper
            args={[
              300,
              30,
              reactive ? reactive.gridColor : (theme === "rainbow" ? "#ff00ff" : "#2a1d5a"),
              "#121a2d",
            ]}
            position={[0, -2, 0]}
            material-transparent
            material-opacity={reactive ? reactive.gridOpacity : 1}
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
  avatarId,
  equipmentId,
  quality,
  userDisplayName,
  intervalPhase = null,
  flowTier = 0,
  contextPalette,
}: {
  elevationProfile?: number[];
  theme?: VisualizerTheme;
  progress?: number;
  mode?: VisualizerMode;
  stats?: RiderStats;
  storyBeats?: StoryBeat[];
  ghosts?: number[];
  className?: string;
  avatarId?: string;
  equipmentId?: string;
  quality?: "low" | "medium" | "high";
  userDisplayName?: string;
  intervalPhase?: IntervalPhase;
  flowTier?: FlowStateTier;
  contextPalette?: ContextPalette;
}) {
  const adaptiveQuality = useAdaptiveQuality();

  // Determine effective quality settings
  const effectiveQuality = useMemo(() => {
    if (quality) {
      // Manual override
      return {
        pixelRatio: quality === "high" ? Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2) : 1,
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

  // Compute reactive sky gradient for world reactivity
  const reactiveParams = useMemo(() => {
    if (mode !== "ride" || !intervalPhase) return null;
    return computeReactiveParams(theme, stats, intervalPhase, progress);
  }, [theme, stats, intervalPhase, progress, mode]);

  const skyTopStyle = reactiveParams ? reactiveParams.skyTopColor : styles.skyTop;
  const skyBottomStyle = reactiveParams ? reactiveParams.skyBottomColor : styles.skyBottom;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl ${className}`}
      style={{
        background: `linear-gradient(to bottom, ${skyTopStyle}, ${skyBottomStyle})`,
      }}
    >
      {/* Horizon glow layer behind canvas — reactive with phase */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: reactiveParams
            ? `radial-gradient(ellipse at 50% 80%, ${reactiveParams.fogColor}66 0%, transparent 50%)`
            : `radial-gradient(ellipse at 50% 80%, ${styles.horizonGlow}44 0%, transparent 50%)`,
        }}
      />

      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-white/60 text-sm">Loading 3D route...</div>
        </div>
      }>
        <Canvas
          gl={{ alpha: true }}
          dpr={effectiveQuality.pixelRatio}
          frameloop="demand"
          performance={{ min: 0.5 }}
        >
          <CanvasContextLossHandler />
          {mode === "ride" && <FrameRateLimiter fps={effectiveQuality.fps} />}
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
            intervalPhase={intervalPhase}
            flowTier={flowTier}
            contextPalette={contextPalette}
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
