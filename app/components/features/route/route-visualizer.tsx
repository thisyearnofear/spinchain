"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAdaptiveQuality } from "@/app/lib/responsive";
import { useFlowCelebration } from "@/app/hooks/route/use-flow-celebration";
import { useReactiveWorld } from "@/app/hooks/route/use-reactive-world";
import { useSensoryStore } from "@/app/stores/sensory-store";
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
import type { WebglUnavailableReason } from "@/app/lib/gpu-probe";
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  Noise,
} from "@react-three/postprocessing";
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  VignetteEffect,
  type EffectComposer as PostprocessingComposer,
} from "postprocessing";
import { useMemo, useRef, useState, useEffect, useLayoutEffect, useSyncExternalStore, Suspense, type MutableRefObject } from "react";
import {
  OrbitControls,
  Stars,
  Html,
  PerspectiveCamera,
  Sparkles,
  Trail,
  useGLTF,
  Clone,
  Text,
} from "@react-three/drei";
import { LocalEnvironment } from "./local-environment";
import { getTheme, loadRemoteThemes, subscribeThemes, getThemeVersion } from "@/app/lib/themes/registry";
import type { VisualizerTheme } from "./visualizer-theme";
import { computeReactiveParams, type ReactiveParams } from "./world-reactivity";
import { useCoachingStore, selectPrBeaten } from "@/app/stores/coaching-store";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { resolveCharacterState, AVATAR_CLIP_BY_STATE } from "@/app/lib/character-state";
import type { IntervalPhase } from "@/app/lib/phase-theme";
import type { FlowStateTier } from "@/app/lib/flow-state";
import type { ContextPalette } from "@/app/lib/context-palette";
export type { VisualizerTheme } from "./visualizer-theme";

// Import Selection types
import { EQUIPMENT, WORLDS, resolveAvatar, type AvatarAsset, type EquipmentAsset } from "../../../lib/selection-library";
import { AnimatedModel } from "./animated-model";
import { ProceduralBike, useCyclistPose, BIKE_DECK_OFFSET, RIG } from "./procedural-cyclist";
import { ProgressInterpolator, dampFactor } from "@/app/lib/progress-interpolator";
import { WorldSkybox } from "./world-skybox";
import { buildRouteCurve } from "./route-curve";
import { SKIRT_EDGE_DROP, SKIRT_STEPS, buildRouteSkirtGeometry, createSkirtMaterial, roadProfile, type SkirtLight } from "./route-skirt";
import { buildPropField, getPartGeometry, type PropPartField } from "./route-silhouettes";
import {
  ALPINE_AMBIENT_COLOR,
  ALPINE_AMBIENT_GAIN,
  ALPINE_FOG_FAR,
  ALPINE_POINT_COLOR,
  ALPINE_SKIRT_ALBEDO_GAIN,
  ALPINE_SKIRT_EDGE_SHADE,
  ALPINE_SKIRT_FOG_END,
  ALPINE_SKIRT_FOG_START,
  ALPINE_SKIRT_SUN_GAIN,
  ALPINE_SUN_COLOR,
  ALPINE_SUN_DIR,
  ALPINE_SUN_INTENSITY,
} from "./alpine-atmosphere";
import { AlpineAtmosphere } from "./alpine-view";
import {
  NEON_AMBIENT_COLOR,
  NEON_AMBIENT_GAIN,
  NEON_FOG_FAR,
  NEON_HEMI_GROUND,
  NEON_HEMI_INTENSITY,
  NEON_HEMI_SKY,
  NEON_KEY_COLOR,
  NEON_KEY_DIR,
  NEON_KEY_INTENSITY,
  NEON_POINT_COLOR,
  NEON_SKIRT_EDGE_DROP,
  neonSkirtLight,
} from "./neon-atmosphere";
import { NeonAtmosphere } from "./neon-view";

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
  intensity: number;
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

function useRouteCurve(elevationProfile: number[]) {
  return useMemo(() => buildRouteCurve(elevationProfile), [elevationProfile]);
}

function Road({
  curve,
  theme = "neon",
  stats = { hr: 0, power: 0, cadence: 0, intensity: 0 },
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
  const styles = getTheme(theme);
  // Per-stroke glow kick: consumes PedalSimulator's strokeSeq counter
  // via getState() (no React subscription, no re-render) so the first
  // keystroke lights the road within one frame, independent of the 10Hz
  // commit. Monotonic counter, so two strokes in the same millisecond
  // (Left + Right) each produce a kick.
  const glowKick = useRef(0);
  const lastStrokeSeq = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as MeshStandardMaterial;

    // Consume stroke impulses: one kick per new sequence value. Decay is
    // delta-based (≈100ms time constant, matching the original 0.88/frame
    // at 60fps) so the kick looks the same at 30/60/120Hz.
    const seq = useSensoryStore.getState().strokeSeq;
    if (seq !== lastStrokeSeq.current) {
      lastStrokeSeq.current = seq;
      glowKick.current = Math.min(1, glowKick.current + 0.35);
    }
    glowKick.current *= Math.exp(-delta / 0.1);

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
      // Pulse at the phase's rhythm (computePhaseTheme pulseMs), not a
      // hardcoded modulo — sprint ~400–700ms, recovery ~3–4s.
      const beat = (state.clock.elapsedTime * 1000) % reactive.pulseMs;
      if (beat < reactive.pulseMs / 2) {
        emissiveIntensity *= 1.2;
      }
    }

    // Per-stroke kick applied AFTER the reactive override — reactive
    // (non-null in ride mode) replaces emissiveIntensity wholesale, so a
    // kick added before it would never show during a ride.
    emissiveIntensity += glowKick.current * 1.2;

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
    const { halfWidth: width, height } = roadProfile(theme);

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
  const styles = getTheme(theme);

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

  // Per-stroke kick (same strokeSeq channel as Road) — markings are the
  // brighter surface, so they carry most of the visible impulse.
  const glowKick = useRef(0);
  const lastStrokeSeq = useRef(0);

  useFrame((state, delta) => {
    // Consume stroke impulses before the material updates below. Decay is
    // delta-based (≈100ms time constant) — frame-rate independent.
    const seq = useSensoryStore.getState().strokeSeq;
    if (seq !== lastStrokeSeq.current) {
      lastStrokeSeq.current = seq;
      glowKick.current = Math.min(1, glowKick.current + 0.35);
    }
    glowKick.current *= Math.exp(-delta / 0.1);

    const dashMat = dashRef.current?.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
    const edgeMat = edgeRef.current?.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;

    // Base intensities are rebuilt from scratch every frame — reactive when
    // riding, the static JSX props otherwise — so the kick below can never
    // ratchet frame over frame.
    let dashIntensity: number;
    let edgeIntensity: number;
    if (reactive) {
      dashIntensity = reactive.roadGlowIntensity * 3;
      edgeIntensity = reactive.roadGlowIntensity * 6;
      // Pulse edge glow at the phase's rhythm (computePhaseTheme pulseMs)
      const beat = (state.clock.elapsedTime * 1000) % reactive.pulseMs;
      if (beat < reactive.pulseMs / 2) {
        edgeIntensity *= 1.3;
      }
    } else {
      dashIntensity = styles.roadEmissiveIntensity * 5;
      edgeIntensity = styles.roadEmissiveIntensity * 10;
    }

    // Per-stroke kick (see Road) — assigned, never accumulated.
    if (dashMat && 'emissiveIntensity' in dashMat) {
      dashMat.emissiveIntensity = dashIntensity + glowKick.current * 2;
    }
    if (edgeMat && 'emissiveIntensity' in edgeMat) {
      edgeMat.emissiveIntensity = edgeIntensity + glowKick.current * 4;
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
  const styles = getTheme(theme);
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

const _instanceMatrix = new THREE.Matrix4();

function applyInstanceMatrices(mesh: THREE.InstancedMesh, matrices: Float32Array, count: number) {
  for (let i = 0; i < count; i++) {
    _instanceMatrix.fromArray(matrices, i * 16);
    mesh.setMatrixAt(i, _instanceMatrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.computeBoundingSphere();
}

function RouteSkirt({ curve, theme }: { curve: CatmullRomCurve3; theme: VisualizerTheme }) {
  const styles = getTheme(theme);
  const { halfWidth } = roadProfile(theme);
  // Alpine and neon keep a shallow rim so the fade is a surface you can see.
  // The other themes keep the steeper drop.
  const edgeDrop = theme === "alpine" ? 0.6 : theme === "neon" ? NEON_SKIRT_EDGE_DROP : SKIRT_EDGE_DROP;
  const geometry = useMemo(
    () => buildRouteSkirtGeometry(curve, halfWidth, SKIRT_STEPS, edgeDrop),
    [curve, halfWidth, edgeDrop],
  );
  const light = useMemo<SkirtLight | undefined>(() => {
    if (theme === "alpine") {
      return {
        albedoGain: ALPINE_SKIRT_ALBEDO_GAIN,
        edgeShade: ALPINE_SKIRT_EDGE_SHADE,
        sunGain: ALPINE_SKIRT_SUN_GAIN,
        sunDir: ALPINE_SUN_DIR,
        fogStart: ALPINE_SKIRT_FOG_START,
        fogEnd: ALPINE_SKIRT_FOG_END,
      };
    }
    if (theme === "neon") return neonSkirtLight();
    return undefined;
  }, [theme]);
  const material = useMemo(
    () => createSkirtMaterial(styles.terrainColor, styles.terrainAccent, light),
    [styles.terrainColor, styles.terrainAccent, light],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return <mesh geometry={geometry} material={material} frustumCulled />;
}

/**
 * Effort glow for the one lit part of a neon/rainbow silhouette.
 * Writes a single emissiveIntensity. No per-instance material walk.
 */
function BreathingMaterial({
  color,
  roughness,
  metalness,
  theme,
  stats,
  reactive,
}: {
  color: string;
  roughness: number;
  metalness: number;
  theme: VisualizerTheme;
  stats: RiderStats;
  reactive: ReactiveParams | null;
}) {
  const ref = useRef<MeshStandardMaterial>(null);

  useFrame((state) => {
    const mat = ref.current;
    if (!mat) return;
    const pulseBase = 1 + Math.sin(state.clock.elapsedTime * (stats.cadence / 15)) * 0.05;
    let baseIntensity = theme === "neon" ? 0.5 : 0.8;
    if (reactive) {
      baseIntensity = reactive.propEmissiveIntensity;
      const beat = (state.clock.elapsedTime * 1000) % reactive.pulseMs;
      if (beat < reactive.pulseMs / 2) baseIntensity *= 1.25;
    }
    mat.emissiveIntensity = baseIntensity + (pulseBase - 1) * 2;
  });

  return (
    <meshStandardMaterial
      ref={ref}
      color={color}
      emissive={color}
      emissiveIntensity={theme === "neon" ? 0.5 : 0.8}
      roughness={roughness}
      metalness={metalness}
    />
  );
}

function PropInstances({
  part,
  theme,
  stats,
  reactive,
}: {
  part: PropPartField;
  theme: VisualizerTheme;
  stats: RiderStats;
  reactive: ReactiveParams | null;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => getPartGeometry(part), [part]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    applyInstanceMatrices(mesh, part.matrices, part.count);
  }, [part]);

  const breathe = part.breathes && (theme === "neon" || theme === "rainbow");

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, part.count]} frustumCulled>
      {breathe ? (
        <BreathingMaterial
          color={part.color}
          roughness={part.roughness}
          metalness={part.metalness}
          theme={theme}
          stats={stats}
          reactive={reactive}
        />
      ) : (
        <meshStandardMaterial
          color={part.color}
          emissive={part.color}
          emissiveIntensity={part.emissive}
          roughness={part.roughness}
          metalness={part.metalness}
        />
      )}
    </instancedMesh>
  );
}

function PropField({
  theme = "neon",
  curve,
  stats,
  reactive = null,
}: {
  theme?: VisualizerTheme;
  curve: CatmullRomCurve3;
  stats: RiderStats;
  reactive?: ReactiveParams | null;
}) {
  const propConfig = getTheme(theme).props;
  const { halfWidth } = roadProfile(theme);
  const field = useMemo(
    () => (propConfig ? buildPropField(curve, propConfig, halfWidth) : null),
    [curve, propConfig, halfWidth],
  );

  if (!field) return null;

  return (
    <group>
      {field.parts.map((part) => (
        <PropInstances key={part.id} part={part} theme={theme} stats={stats} reactive={reactive} />
      ))}
    </group>
  );
}

function PostEffects({ theme = "neon", stats, performanceTier = "high", reactive = null }: { theme: VisualizerTheme; stats: RiderStats; performanceTier?: "high" | "medium" | "low"; reactive?: ReactiveParams | null }) {
  // Live values go through refs and are written onto the effect instances
  // in useFrame. @react-three/postprocessing recreates an effect whenever
  // its props change (args memoized on JSON.stringify(props)), and the
  // composer then tears down and recompiles its passes — driving bloom /
  // chromatic props from live power did that on every telemetry commit.
  const statsRef = useRef(stats);
  const reactiveRef = useRef(reactive);
  useEffect(() => {
    statsRef.current = stats;
    reactiveRef.current = reactive;
  }, [stats, reactive]);

  // Effect instances are found through the composer's passes (refs on the
  // wrapped effects would be JSON.stringify'd by the wrapper's memo key).
  const composerRef = useRef<PostprocessingComposer | null>(null);
  const effectsCacheRef = useRef<{
    composer: PostprocessingComposer | null;
    bloom: BloomEffect | null;
    chromatic: ChromaticAberrationEffect | null;
    vignette: VignetteEffect | null;
  }>({ composer: null, bloom: null, chromatic: null, vignette: null });

  const intensityMultiplier = performanceTier === "low" ? 0 : performanceTier === "medium" ? 0.5 : 1;
  const noiseOpacity = theme === 'neon' ? 0.03 * intensityMultiplier : 0;

  useFrame((_, delta) => {
    const composer = composerRef.current;
    if (!composer) return;
    const cache = effectsCacheRef.current;
    if (cache.composer !== composer || (!cache.bloom && !cache.chromatic)) {
      cache.composer = composer;
      cache.bloom = cache.chromatic = cache.vignette = null;
      for (const pass of composer.passes) {
        const passEffects = (pass as unknown as { effects?: unknown[] }).effects ?? [];
        for (const fx of passEffects) {
          if (fx instanceof BloomEffect) cache.bloom = fx;
          else if (fx instanceof ChromaticAberrationEffect) cache.chromatic = fx;
          else if (fx instanceof VignetteEffect) cache.vignette = fx;
        }
      }
    }
    const s = statsRef.current;
    const r = reactiveRef.current;
    const powerFactor = Math.min(1, s.power / 600);
    // Caps: the phase theme's sprint values (bloom 3.5, chroma 0.008) blew
    // the frame out to white and hid the rider from the chase camera.
    const bloomTarget = Math.min(2.2, r ? r.bloomIntensity : 0.5 + powerFactor * 2.0) * intensityMultiplier;
    const chromaTarget =
      Math.min(0.0035, r ? r.chromaticOffset : s.power > 300 ? powerFactor * 0.005 : 0) * intensityMultiplier;
    // Ease toward targets so 2–10Hz telemetry steps don't flicker the glow.
    const k = dampFactor(4, delta);
    if (cache.bloom) {
      cache.bloom.intensity += (bloomTarget - cache.bloom.intensity) * k;
    }
    if (cache.chromatic) {
      // applyProps assigns the JSX `offset={[0, 0]}` as a raw array; swap in
      // a Vector2 once so it can be mutated in place.
      let o = cache.chromatic.offset as THREE.Vector2 | number[];
      if (!(o instanceof THREE.Vector2)) {
        o = new THREE.Vector2(o?.[0] ?? 0, o?.[1] ?? 0);
        cache.chromatic.offset = o;
      }
      const next = o.x + (chromaTarget - o.x) * k;
      o.set(next, next);
    }
    if (cache.vignette && r) {
      cache.vignette.darkness += (r.vignetteDarkness - cache.vignette.darkness) * k;
    }
  });

  // Effect elements depend only on tier/theme — stable across telemetry.
  const effects = useMemo(() => {
    if (performanceTier === "low") return [];
    const e = [
      <Bloom
        key="bloom"
        intensity={0.5 * intensityMultiplier}
        luminanceThreshold={0.4}
        luminanceSmoothing={1}
        mipmapBlur
      />,
      <ChromaticAberration
        key="chromatic"
        offset={[0, 0]}
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
  }, [intensityMultiplier, noiseOpacity, performanceTier]);

  if (performanceTier === "low" || effects.length === 0) return null;

  return (
    // 4x MSAA: 8x on top of mipmap bloom was the single heaviest GPU cost on
    // the "high" tier, with no visible gain behind bloom + vignette.
    <EffectComposer ref={composerRef} multisampling={performanceTier === "high" ? 4 : 0}>
      {effects}
    </EffectComposer>
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

function RiderMarker({
  curve,
  progressRef,
  theme = "neon",
  stats = { hr: 120, power: 150, cadence: 80, intensity: 0.75 },
  avatar,
  equipment,
  showYouLabel = false,
  reactive = null,
  intervalPhase = null,
}: {
  curve: CatmullRomCurve3;
  progressRef: MutableRefObject<number>;
  theme?: VisualizerTheme;
  stats?: RiderStats;
  avatar?: AvatarAsset;
  equipment?: EquipmentAsset;
  showYouLabel?: boolean;
  reactive?: ReactiveParams | null;
  intervalPhase?: IntervalPhase | null;
}) {
  const groupRef = useRef<Group>(null);
  const rigRef = useRef<Group>(null);
  const styles = getTheme(theme);

  const haloRef = useRef<Mesh>(null);
  const lightRef = useRef<PointLight>(null);

  // Live values for useFrame without re-subscribing.
  const statsRef = useRef(stats);
  const reactiveRef = useRef(reactive);
  useEffect(() => {
    statsRef.current = stats;
    reactiveRef.current = reactive;
  }, [stats, reactive]);

  // PR celebration: prBeaten is sticky once set (app/hooks/ride/use-pr-pursuit),
  // so edge-trigger a ~4.5s celebrate window rather than pose-locking the rider.
  const prBeaten = useCoachingStore(selectPrBeaten);
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!prBeaten) return;
    setCelebrating(true);
    const timeout = setTimeout(() => setCelebrating(false), 4500);
    return () => clearTimeout(timeout);
  }, [prBeaten]);

  // Clip selection for pipeline-generated riders (Mint) — one shared
  // vocabulary for the whole product (app/lib/character-state.ts).
  const isRiding = useRideStore((s) => s.isActive);
  const characterState = resolveCharacterState({
    isRiding,
    intervalPhase,
    celebrating,
  });
  const activeClip = AVATAR_CLIP_BY_STATE[characterState];

  // A skinned (Mint) avatar with no user-picked equipment rides the
  // procedural bike with IK-driven legs. Picked equipment / static avatars
  // keep the legacy presentation.
  const rideProceduralBike = !equipment && !!avatar?.clips?.length;

  // Crank phase + wheel angle, advanced from live cadence each frame.
  const pedalPhaseRef = useRef(0);
  const wheelAngleRef = useRef(0);
  const leanRef = useRef(0);
  const cadenceRef = useRef(0);
  const poseCyclist = useCyclistPose(rigRef, pedalPhaseRef, leanRef);

  // Road deck height along the curve. Road is an ExtrudeGeometry whose
  // profile Y (0 → 0.5) runs along the curve's Frenet binormal, so the
  // upper deck face sits max(0, 0.5·binormal.y) above the centreline.
  const deckFrames = useMemo(() => curve.computeFrenetFrames(400, true), [curve]);
  const scratch = useRef({ point: new Vector3(), tangent: new Vector3(), look: new Vector3() });

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const progress = progressRef.current;
    const { point, tangent, look } = scratch.current;
    curve.getPointAt(progress, point);
    curve.getTangentAt(progress, tangent);

    // Guard against NaN positions from degenerate curves
    if (isNaN(point.x) || isNaN(point.y) || isNaN(point.z)) return;

    groupRef.current.position.copy(point);
    if (rideProceduralBike) {
      const i = Math.min(deckFrames.binormals.length - 1, Math.max(0, Math.round(progress * 400)));
      const by = deckFrames.binormals[i]?.y ?? 1;
      groupRef.current.position.y += Math.max(0, 0.5 * by) + BIKE_DECK_OFFSET;
    } else {
      // Legacy presentation (picked equipment / static avatar).
      groupRef.current.position.y += equipment?.type === "vehicle" ? 2.5 : 1.5;
    }

    // getTangentAt can return NaN independently of getPointAt near a closed
    // curve's near-zero-length segments (most likely right at ride start,
    // where progress sits close to the wrap boundary). Feeding a NaN tangent
    // into lookAt() sets a NaN rotation quaternion, which NaN-poisons this
    // group's world matrix — and <Trail> below samples that world position
    // every frame, baking the NaN into its geometry.
    if (Number.isFinite(tangent.x) && Number.isFinite(tangent.y) && Number.isFinite(tangent.z)) {
      // lookAt() takes a WORLD-space target, but curve points are in the
      // route group's space (offset [0,-10,0]). Passing the local point aimed
      // the rider at a spot ~10 units overhead and pitched it almost
      // vertical — the root of the "floating man".
      look.copy(point).add(tangent);
      groupRef.current.parent?.localToWorld(look);
      groupRef.current.lookAt(look);
    }

    // Pedal from live cadence. The keyboard simulator can report power
    // with 0 rpm between strokes; keep the legs turning while the rider is
    // clearly putting out effort so motion never freezes mid-ride.
    const s = statsRef.current;
    const liveCadence = useTelemetryStore.getState().snapshot.cadence || s.cadence || 0;
    const wantCadence = isRiding ? (liveCadence > 0 ? liveCadence : s.power > 20 ? 70 : 0) : 0;
    cadenceRef.current += (wantCadence - cadenceRef.current) * dampFactor(3, delta);
    const omega = (cadenceRef.current / 60) * Math.PI * 2;
    pedalPhaseRef.current = (pedalPhaseRef.current + omega * delta) % (Math.PI * 2);
    // ~2.6 wheel turns per crank turn (mid gear).
    wheelAngleRef.current = (wheelAngleRef.current + omega * 2.6 * delta) % (Math.PI * 2);
    // Effort tucks the rider a little lower over the bars.
    const effortLean = Math.min(0.18, Math.max(0, (s.power - 150) / 1500));
    leanRef.current += (effortLean - leanRef.current) * dampFactor(2, delta);

    // Ground halo breathes with cadence and effort.
    const r = reactiveRef.current;
    if (haloRef.current) {
      let pulse = 1 + Math.sin(state.clock.elapsedTime * (Math.max(cadenceRef.current, 30) / 15)) * 0.08;
      if (r) pulse *= Math.min(1.4, r.riderAuraScale);
      haloRef.current.scale.set(pulse, pulse, pulse);
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = r ? Math.min(0.55, r.riderAuraOpacity * 4) : 0.18 + Math.min(0.3, s.power / 1500);
    }

    if (lightRef.current) {
      lightRef.current.intensity = r ? r.riderLightIntensity : 5 + (s.hr / 40) * 5;
    }
  });

  const trailColor = reactive ? reactive.riderTrailColor : styles.riderColor;

  return (
    <group ref={groupRef}>
      {/* HoloHUD (glass stats panel + mini-map) used to ride on this group.
          It sat between the chase camera and the cyclist, and its mini-map
          point light (intensity 50) bloomed into a white blob over the
          rider. The bottom ride HUD already shows the same stats. */}

      {/* Light trail from the rear wheel. Fixed integer length + width:
          drei <Trail> sizes its buffer from length×10, so the old
          power-derived fractional length produced NaN geometry and
          "vertex buffer not big enough" errors every frame. */}
      <Trail width={1.4} length={18} color={trailColor} attenuation={(t) => t * t}>
        <mesh position={rideProceduralBike ? [0, 0.35, -1.1] : [0, 0, 0]} visible={false}>
          <boxGeometry args={[0.01, 0.01, 0.01]} />
          <meshBasicMaterial />
        </mesh>
      </Trail>

      {rideProceduralBike && avatar ? (
        <group ref={rigRef} scale={1.25}>
          <ProceduralBike
            phaseRef={pedalPhaseRef}
            wheelAngleRef={wheelAngleRef}
            frameColor={styles.lineColor}
            accentColor={styles.riderColor}
          />
          <AnimatedModel
            url={avatar.modelUrl}
            clips={avatar.clips}
            activeClip={activeClip}
            scale={RIG.characterScale}
            position={RIG.characterOffset}
            onAfterUpdate={poseCyclist}
          />
        </group>
      ) : (
        <group>
          {avatar && (
            <group position={[0, equipment?.type === "bike" ? 0.8 : 0, 0]}>
              {avatar.clips && avatar.clips.length > 0 ? (
                <AnimatedModel url={avatar.modelUrl} clips={avatar.clips} activeClip={activeClip} scale={1.5} />
              ) : (
                <Model url={avatar.modelUrl} scale={1.5} />
              )}
            </group>
          )}
          {equipment ? (
            <Model url={equipment.modelUrl} scale={equipment.type === "vehicle" ? 2 : 1.2} />
          ) : avatar ? null : (
            /* Last-resort marker when no avatar GLB resolved — Nova is the
               default, so this only fires if the character library is empty. */
            <group rotation={[Math.PI / 2, 0, 0]}>
              <mesh position={[0, 0, 0.2]}>
                <capsuleGeometry args={[0.45, 1.0, 8, 16]} />
                <meshStandardMaterial
                  color={styles.riderColor}
                  emissive={styles.riderColor}
                  emissiveIntensity={3}
                  toneMapped={false}
                />
              </mesh>
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
        </group>
      )}

      {/* Effort halo on the road under the bike (was a radius-2 sphere that
          swallowed the rider from the chase camera). */}
      <mesh ref={haloRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[1.3, 1.9, 48]} />
        <meshBasicMaterial color={styles.riderColor} transparent opacity={0.2} depthWrite={false} toneMapped={false} />
      </mesh>

      <pointLight
        ref={lightRef}
        position={[0, 2.5, 0]}
        distance={30}
        intensity={10}
        color={styles.riderColor}
      />

      {/* Label — only visible during active ride */}
      {showYouLabel && (
        <Html position={[0, 3.9, 0]} center transform sprite distanceFactor={6} zIndexRange={[5, 0]} className="pointer-events-none">
          <div className="flex flex-col items-center gap-1 pointer-events-none">
            <div className="whitespace-nowrap rounded-full bg-black/70 px-2 py-1 text-[11px] font-bold text-white border border-white/30 shadow-lg">
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
  reactive = null,
  stats = { power: 0, cadence: 0, hr: 0, intensity: 0 },
}: {
  count?: number;
  theme?: VisualizerTheme;
  reactive?: ReactiveParams | null;
  stats?: RiderStats;
}) {
  const styles = getTheme(theme);
  const [allLines] = useState<(SpeedLineData & { id: string })[]>(() =>
    Array.from({ length: 50 }).map((_, idx) => ({
      id: `speedline-${idx}`,
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
      {visibleLines.map((line) => (
        <LineInstance
          key={line.id}
          line={line}
          color={reactive ? reactive.speedLineColor : styles.lineColor}
          reactive={reactive}
          stats={stats}
        />
      ))}
    </group>
  );
}

function LineInstance({ line, color, reactive = null, stats = { power: 0, cadence: 0, hr: 0, intensity: 0 } }: {
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

    // Pulse opacity at the phase's rhythm (computePhaseTheme pulseMs)
    if (reactive) {
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      const baseOpacity = reactive.speedLineOpacity;
      const beat = (state.clock.elapsedTime * 1000) % reactive.pulseMs;
      if (beat < reactive.pulseMs / 2) {
        mat.opacity = baseOpacity * 1.3;
      } else {
        mat.opacity = baseOpacity;
      }
    } else {
      // Line count is fixed now; effort shows as visibility instead.
      (ref.current.material as THREE.MeshBasicMaterial).opacity = Math.min(0.5, stats.power / 500);
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
  const styles = getTheme(theme);
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
  const styles = getTheme(theme);

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
  const styles = getTheme(theme);
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

const CONTEXT_RESTORE_GRACE_MS = 3000;

function CanvasContextLossHandler({ onLostForGood }: { onLostForGood?: () => void }) {
  const { gl, invalidate } = useThree();
  const onLostForGoodRef = useRef(onLostForGood);
  useEffect(() => {
    onLostForGoodRef.current = onLostForGood;
  });
  useEffect(() => {
    const canvas = gl.domElement;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const onLost = (e: Event) => {
      e.preventDefault();
      clearTimeout(graceTimer);
      graceTimer = setTimeout(() => onLostForGoodRef.current?.(), CONTEXT_RESTORE_GRACE_MS);
    };
    const onRestored = () => {
      clearTimeout(graceTimer);
      invalidate();
    };
    canvas.addEventListener("webglcontextlost", onLost, false);
    canvas.addEventListener("webglcontextrestored", onRestored, false);
    return () => {
      clearTimeout(graceTimer);
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
  stats = { hr: 0, power: 0, cadence: 0, intensity: 0 },
  avatar,
  equipment,
  quality,
  userDisplayName,
  intervalPhase = null,
  flowTier = 0,
  contextPalette,
  panoUrl,
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
  panoUrl?: string;
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
  const styles = getTheme(theme);
  const smoothedLookTargetRef = useRef(new Vector3());
  const smoothedShakeRef = useRef(new Vector3());
  const _shakeTargetVec = useRef(new Vector3());

  const currentFlowEffect = useFlowCelebration(flowTier);

  // Mouse parallax — subtle camera offset based on pointer position
  const mouseParallaxRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const driftTimeRef = useRef(0);

  // Get performance tier for adaptive quality - use quality.fps as proxy if available
  const performanceTier = quality?.fps === 30 ? "low" : quality?.fps === 45 ? "medium" : "high";

  const { reactive, flowScale, flowColor, showFlowEffects } = useReactiveWorld({
    theme,
    stats,
    intervalPhase,
    progress,
    mode,
    flowTier,
  });

  // --- Progress tracking via refs (no React state updates inside useFrame) ---
  // Calling setState inside useFrame triggers a full React re-render every animation
  // frame (60fps), cascading through every child in the scene tree and causing R3F to
  // rebuild geometry whose args arrays have new references.  We use mutable refs for
  // the hot path and only push to React state at ~10fps for HTML overlay elements.
  const previewProgressRef = useRef(START_OFFSET);
  const renderProgressRef = useRef(
    mode === "preview" ? START_OFFSET : mapToCurveProgress(progress),
  );
  // Steady-speed playback of the ~1Hz store ticks (see progress-interpolator).
  const interpolatorRef = useRef<ProgressInterpolator | null>(null);
  if (interpolatorRef.current === null) {
    interpolatorRef.current = new ProgressInterpolator(progress, 0);
  }
  const reducedMotionRef = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const onChange = () => { reducedMotionRef.current = mq.matches; };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  // Scratch vectors for the chase camera — no per-frame allocations.
  const camScratch = useRef({
    up: new Vector3(),
    side: new Vector3(),
    look: new Vector3(),
    target: new Vector3(),
    back: new Vector3(),
  });
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

    // Display-only steady-speed playback between 1Hz store ticks. Store
    // progress (rideProgress) remains the single writer per coordinator
    // Rule 6; this ref is only for visuals. Rider AND camera read it, so
    // they never drift apart.
    if (mode === "preview") {
      renderProgressRef.current = rawProgress;
    } else {
      const nowMs = performance.now();
      const interp = interpolatorRef.current!;
      if (reducedMotionRef.current || progress >= 1) {
        interp.snap(progress, nowMs);
      } else {
        interp.push(progress, nowMs);
      }
      renderProgressRef.current = mapToCurveProgress(interp.sample(nowMs));
    }
    const curveProgress = renderProgressRef.current;

    // --- 4. Chase camera ---
    // Time-based damping (1 - e^(-λ·dt)) so the follow feel is identical at
    // 30/60/120Hz. λ values reproduce the old per-frame factors at 60fps.
    if (mode !== "preview") {
      const safeCurveP = Number.isFinite(curveProgress)
        ? Math.max(0, Math.min(curveProgress, 1))
        : START_OFFSET;
      const riderPos = curve.getPointAt(safeCurveP, camScratch.current.target);
      if (!Number.isFinite(riderPos.x)) return;
      riderPos.y -= 10; // match group offset [0, -10, 0]

      const rawTangent = curve.getTangentAt(safeCurveP, camScratch.current.back);
      // Same class of bug as RiderMarker: getTangentAt can be NaN near a
      // closed curve's near-zero-length segments even when getPointAt is
      // fine. Unlike RiderMarker's self-healing Trail buffer, camera.lerp()
      // toward a NaN target permanently poisons camera.position (NaN in,
      // NaN out on every subsequent lerp) — skip the frame instead.
      if (!Number.isFinite(rawTangent.x) || !Number.isFinite(rawTangent.y) || !Number.isFinite(rawTangent.z)) {
        return;
      }
      const tangent = rawTangent.normalize();
      const { up, side, look } = camScratch.current;
      if (Math.abs(tangent.y) > 0.98) up.set(1, 0, 0);
      else up.set(0, 1, 0);
      side.crossVectors(tangent, up).normalize();

      // Aim just above/ahead of the rider so the cyclist sits mid-frame,
      // clear of the bottom HUD.
      look.copy(riderPos).addScaledVector(tangent, 1.5);
      look.y += 1.2;
      // riderPos becomes the camera target: behind, slightly to the side,
      // above. Closer than before (was 14 back / 10 up) so the cyclist
      // reads as a person on a bike, not a dot.
      const targetCamPos = riderPos
        .addScaledVector(tangent, -10)
        .addScaledVector(side, 2.5);
      targetCamPos.y += 6.5;

      const follow = dampFactor(mode === "ride" ? 3.7 : 2.4, delta);
      state.camera.position.lerp(targetCamPos, follow);

      if (!isFiniteVector3(smoothedLookTargetRef.current) || smoothedLookTargetRef.current.lengthSq() === 0) {
        smoothedLookTargetRef.current.copy(look);
      } else {
        smoothedLookTargetRef.current.lerp(look, dampFactor(mode === "ride" ? 7.7 : 5, delta));
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
        const nextFov = MathUtils.lerp(cam.fov, targetFov, dampFactor(3, delta));
        if (Math.abs(nextFov - cam.fov) > 0.001) {
          cam.fov = nextFov;
          cam.updateProjectionMatrix();
        }
      }

      if (stats.power > 350) {
        const shake = Math.min(1, (stats.power - 350) / 450);
        const rawShake = (Math.random() - 0.5) * shake * 0.08;
        _shakeTargetVec.current.set(rawShake, rawShake * 0.5, 0);
        smoothedShakeRef.current.lerp(_shakeTargetVec.current, dampFactor(9.8, delta));
      } else {
        _shakeTargetVec.current.set(0, 0, 0);
        smoothedShakeRef.current.lerp(_shakeTargetVec.current, dampFactor(6.3, delta));
      }
      state.camera.position.x += smoothedShakeRef.current.x;
      state.camera.position.y += smoothedShakeRef.current.y;

      // Subtle mouse parallax — offsets camera based on pointer for depth perception
      mouseParallaxRef.current.targetX = state.pointer.x * 1.5;
      mouseParallaxRef.current.targetY = state.pointer.y * 0.8;
      const parallax = dampFactor(2.45, delta);
      mouseParallaxRef.current.x += (mouseParallaxRef.current.targetX - mouseParallaxRef.current.x) * parallax;
      mouseParallaxRef.current.y += (mouseParallaxRef.current.targetY - mouseParallaxRef.current.y) * parallax;
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

  // Adaptive particle count based on quality. Counts are FIXED per quality
  // tier: drei <Sparkles>/<SpeedLines> reallocate their buffers whenever
  // `count` changes, and deriving it from live power rebuilt them on almost
  // every telemetry commit. Effort is expressed through size/speed/opacity.
  const particleCount = quality?.particleCount || 200;
  const sparkleCount = Math.min(particleCount, 120);
  const speedLineCount = quality?.particleCount ? 30 : 0;

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 100, 100]} fov={60} rotation={[-Math.PI / 3, 0, 0]} />
      <ambientLight
        intensity={
          (reactive ? reactive.ambientIntensity : 0.5) *
          (theme === "alpine" ? ALPINE_AMBIENT_GAIN : theme === "neon" ? NEON_AMBIENT_GAIN : 1)
        }
        color={theme === "alpine" ? ALPINE_AMBIENT_COLOR : theme === "neon" ? NEON_AMBIENT_COLOR : "#ffffff"}
      />
      {theme === "alpine" && (
        <>
          <hemisphereLight args={["#e7f2ff", "#7d9a78", 0.45]} />
          <directionalLight
            position={[ALPINE_SUN_DIR.x * 80, ALPINE_SUN_DIR.y * 80, ALPINE_SUN_DIR.z * 80]}
            intensity={ALPINE_SUN_INTENSITY}
            color={ALPINE_SUN_COLOR}
          />
        </>
      )}
      {theme === "neon" && (
        <>
          <hemisphereLight args={[NEON_HEMI_SKY, NEON_HEMI_GROUND, NEON_HEMI_INTENSITY]} />
          <directionalLight
            position={[NEON_KEY_DIR.x * 80, NEON_KEY_DIR.y * 80, NEON_KEY_DIR.z * 80]}
            intensity={NEON_KEY_INTENSITY}
            color={NEON_KEY_COLOR}
          />
        </>
      )}
      <pointLight
        position={[10, 50, 10]}
        intensity={reactive ? reactive.pointLightIntensity : 1}
        color={
          reactive
            ? reactive.pointLightColor
            : theme === "mars"
              ? "#ef4444"
              : theme === "rainbow"
                ? "#ff00ff"
                : theme === "alpine"
                  ? ALPINE_POINT_COLOR
                  : theme === "neon"
                    ? NEON_POINT_COLOR
                    : "#9b7bff"
        }
        castShadow={quality?.shadows}
      />
      <fog
        attach="fog"
        args={[
          // Alpine and neon keep their own haze. Effort still closes the near
          // plane (fogDensity). A phase tint in place of that haze turns the
          // skirt's far edge into a cut.
          theme === "alpine" || theme === "neon" ? styles.fog : reactive ? reactive.fogColor : styles.fog,
          reactive ? reactive.fogDensity : 40,
          theme === "alpine" ? ALPINE_FOG_FAR : theme === "neon" ? NEON_FOG_FAR : 250,
        ]}
      />

      {/* Generated-world panorama (World Labs pipeline) — one static
          equirect texture; the mobile-safe tier. */}
      {panoUrl && <WorldSkybox url={panoUrl} />}

      <LocalEnvironment key={theme} sky={styles.skyTop} horizon={styles.horizonGlow} ground={styles.terrainColor} />

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
            // Fixed count: a tier-derived count reallocated the buffers on
            // every tier change ("vertex buffer not big enough" warnings).
            count={400}
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
        {theme === "alpine" && (
          <AlpineAtmosphere curve={curve} horizon={styles.fog} zenith={styles.skyTop} />
        )}
        {theme === "neon" && (
          <NeonAtmosphere curve={curve} horizon={styles.fog} zenith={styles.skyTop} />
        )}
        <RouteSkirt curve={curve} theme={theme} />
        <Road
          curve={curve}
          theme={theme}
          stats={stats}
          steps={performanceTier === "high" ? 600 : performanceTier === "medium" ? 250 : 100}
          reactive={reactive}
        />
        <PropField theme={theme} curve={curve} stats={stats} reactive={reactive} />
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
          intervalPhase={intervalPhase}
        />

        {/* Limit ghosts on low-end devices */}
        {ghosts.slice(0, quality?.particleCount && quality.particleCount < 200 ? 3 : 10).map((g, i) => (
          <GhostRider key={`ghost-${g.toFixed(4)}`} index={i} curve={curve} progress={mapToCurveProgress(g)} theme={theme} />
        ))}

        {storyBeats.map((beat) => (
          <BeatMarker key={`${beat.type}-${beat.progress.toFixed(3)}-${beat.label}`} beat={beat} curve={curve} riderProgress={displayProgress} />
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
  stats = { hr: 145, power: 210, cadence: 90, intensity: 1.05 },
  storyBeats = [],
  ghosts = [],
  className = "",
  avatarId,
  equipmentId,
  worldId,
  quality,
  userDisplayName,
  intervalPhase = null,
  flowTier = 0,
  contextPalette,
  paused = false,
  active = true,
  onWebglUnavailable,
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
  worldId?: string;
  quality?: "low" | "medium" | "high";
  userDisplayName?: string;
  intervalPhase?: IntervalPhase;
  flowTier?: FlowStateTier;
  contextPalette?: ContextPalette;
  /** Freeze the render loop after first frame (visual-test determinism). */
  paused?: boolean;
  /** False while this layer is hidden (2D view on top) — no frames rendered. */
  active?: boolean;
  /** WebGL failed to start, or the context was lost and never restored. */
  onWebglUnavailable?: (reason: WebglUnavailableReason) => void;
}) {
  const adaptiveQuality = useAdaptiveQuality();

  // Remote themes (Supabase visualizer_themes) — load once per session;
  // the version subscription re-renders the visualizer if new themes
  // arrive after first paint. No-op when Supabase is not configured.
  const themeVersion = useSyncExternalStore(subscribeThemes, getThemeVersion, getThemeVersion);
  useEffect(() => {
    void loadRemoteThemes();
  }, []);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps -- themeVersion re-reads the registry after remote themes load
  const styles = useMemo(() => getTheme(theme), [theme, themeVersion]);

  const avatar = useMemo(() => resolveAvatar(avatarId), [avatarId]);
  const equipment = useMemo(() => EQUIPMENT.find(e => e.id === equipmentId), [equipmentId]);
  const world = useMemo(() => WORLDS.find(w => w.id === worldId), [worldId]);

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
          gl={(defaults) => {
            try {
              return new THREE.WebGLRenderer({
                ...defaults,
                alpha: true,
                // The EffectComposer owns AA on high/medium (4x MSAA inside the
                // composer on high); native MSAA on the default framebuffer is
                // discarded on that path and only costs fill-rate. Low tier runs
                // no composer, so it keeps native AA.
                antialias: effectiveQuality.fps === 30,
                powerPreference: "high-performance",
              });
            } catch (err) {
              // The probe passed but this context didn't (blocklisted GPU,
              // context limit). Hand the ride to 2D and park R3F's configure()
              // rather than let it reject unhandled — this layer unmounts next.
              console.warn("[RouteVisualizer] WebGL unavailable, falling back to 2D:", err);
              onWebglUnavailable?.("init-failed");
              // R3F awaits this at runtime; its type only admits a Renderer.
              return new Promise<never>(() => {}) as unknown as THREE.WebGLRenderer;
            }
          }}
          dpr={effectiveQuality.pixelRatio}
          // "never" freezes the loop entirely — used by the visual harness
          // so Playwright can capture a stable frame for screenshot diffs.
          // Inactive (hidden behind 2D) also stops the loop — otherwise the
          // invisible scene keeps rendering post-processing at full rate.
          frameloop={paused || !active ? "never" : "demand"}
          performance={{ min: 0.5 }}
        >
          <CanvasContextLossHandler
            onLostForGood={onWebglUnavailable && (() => onWebglUnavailable("context-lost"))}
          />
          {mode === "ride" && !paused && active && <FrameRateLimiter fps={effectiveQuality.fps} />}
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
            panoUrl={world?.panoUrl}
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
