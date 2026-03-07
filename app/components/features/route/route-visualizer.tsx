"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useAdaptiveQuality, usePerformanceTier } from "@/app/lib/responsive";
import {
  CatmullRomCurve3,
  Vector3,
  Mesh,
  Shape,
  ExtrudeGeometry,
  Group,
  PointLight,
} from "three";
import { useMemo, useRef, useState, useEffect, Suspense } from "react";
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

export type RiderStats = {
  hr: number;
  power: number;
  cadence: number;
};

function Model({ url, scale = 1, rotation = [0, 0, 0], position = [0, 0, 0] }: { url: string; scale?: number; rotation?: [number, number, number]; position?: [number, number, number] }) {
  const { scene } = useGLTF(url);
  return <Clone object={scene} scale={scale} rotation={rotation} position={position} />;
}

/**
 * Generates a mock route curve based on elevation data/seeds
 */
function useRouteCurve(elevationProfile: number[]) {
  return useMemo(() => {
    // Generate points in a loop or winding path
    const points: Vector3[] = [];
    const radius = 50;
    const steps = 150; // Increased resolution

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 4; // 2 full circles

      // Winding radius with some variation
      const r = radius + Math.sin(t * Math.PI * 6) * 15;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      // Map elevation to Y, smoothed
      const elevIndex = Math.floor(t * (elevationProfile.length - 1));
      const nextElevIndex = Math.min(
        elevIndex + 1,
        elevationProfile.length - 1,
      );
      const elevAlpha = (t * (elevationProfile.length - 1)) % 1;

      const h1 = elevationProfile[elevIndex] || 0;
      const h2 = elevationProfile[nextElevIndex] || 0;
      const height = h1 + (h2 - h1) * elevAlpha;

      points.push(new Vector3(x, height / 4, z));
    }

    return new CatmullRomCurve3(points, true); // Closed loop for this visualizer
  }, [elevationProfile]);
}

function Road({
  curve,
  theme = "neon",
}: {
  curve: CatmullRomCurve3;
  theme?: VisualizerTheme;
}) {
  const meshRef = useRef<Mesh>(null);
  const styles = THEMES[theme];

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

    return new ExtrudeGeometry(shape, {
      steps: 600,
      extrudePath: curve,
      bevelEnabled: false,
    });
  }, [curve, theme]);

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
      {(theme === "neon" || theme === "rainbow") && (
        <mesh geometry={geometry}>
          <meshBasicMaterial
            color={styles.lineColor}
            wireframe
            transparent
            opacity={0.1}
          />
        </mesh>
      )}
    </group>
  );
}

function RiderMarker({
  curve,
  progress,
  theme = "neon",
  stats = { hr: 120, power: 150, cadence: 80 },
  avatar,
  equipment,
}: {
  curve: CatmullRomCurve3;
  progress: number;
  theme?: VisualizerTheme;
  stats?: RiderStats;
  avatar?: AvatarAsset;
  equipment?: EquipmentAsset;
}) {
  const groupRef = useRef<Group>(null);
  const styles = THEMES[theme];

  const auraRef = useRef<Mesh>(null);
  const lightRef = useRef<PointLight>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    // Get position on curve
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(progress);

    // Update position
    groupRef.current.position.copy(point);
    // Lift slightly above road
    groupRef.current.position.y += equipment?.type === "vehicle" ? 2.5 : 1.5;

    // Update rotation to face forward
    const lookAt = point.clone().add(tangent);
    groupRef.current.lookAt(lookAt);

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

  return (
    <group ref={groupRef}>
      <Trail
        width={2}
        length={15}
        color={styles.riderColor}
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
              opacity={0.05}
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

      {/* Label */}
      <Html position={[0, 4, 0]} center transform sprite distanceFactor={20}>
        <div className="flex flex-col items-center gap-1">
          <div className="whitespace-nowrap rounded-full bg-black/80 px-3 py-1 text-[12px] font-black text-white backdrop-blur-md border border-white/30 shadow-2xl">
            YOU
          </div>
          <div className="h-4 w-px bg-gradient-to-b from-white to-transparent" />
        </div>
      </Html>
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
        <LineInstance key={i} line={line} color={styles.lineColor} />
      ))}
    </group>
  );
}

function LineInstance({ line, color }: { line: SpeedLineData; color: string }) {
  const ref = useRef<Mesh>(null);
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.position.z += line.speed * 200 * delta;
    if (ref.current.position.z > 50) ref.current.position.z = -150;
  });

  return (
    <mesh ref={ref} position={line.position} rotation={[0, 0, 0]}>
      <boxGeometry args={[0.05, 0.05, 10 * line.scale]} />
      <meshBasicMaterial color={color} transparent opacity={0.3} />
    </mesh>
  );
}

function FloatingParticles({ theme = "neon" }: { theme?: VisualizerTheme }) {
  const styles = THEMES[theme];

  // Simplified ambient particles using Drei's Stars for now as it's more performant than custom loop without InstancedMesh setup
  if (!styles.stars) return null;

  return (
    <Stars
      radius={120}
      depth={50}
      count={3000}
      factor={4}
      saturation={0}
      fade
      speed={1}
    />
  );
}

function BeatMarker({
  beat,
  curve,
}: {
  beat: StoryBeat;
  curve: CatmullRomCurve3;
}) {
  const point = useMemo(
    () => curve.getPointAt(beat.progress),
    [curve, beat.progress],
  );
  const color =
    beat.type === "sprint"
      ? "#ff4d4d"
      : beat.type === "climb"
        ? "#fbbf24"
        : "#6d7cff";

  return (
    <group position={[point.x, point.y + 3, point.z]}>
      <Html center transform sprite distanceFactor={15}>
        <div className="flex flex-col items-center gap-1 group">
          <div
            className={`px-2 py-0.5 rounded-full text-[8px] font-bold text-white whitespace-nowrap border backdrop-blur-sm transition-all group-hover:scale-110`}
            style={{ backgroundColor: `${color}80`, borderColor: color }}
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
          emissiveIntensity={2}
        />
      </mesh>
    </group>
  );
}

function GhostRider({
  curve,
  progress,
  theme = "neon",
}: {
  curve: CatmullRomCurve3;
  progress: number;
  theme?: VisualizerTheme;
}) {
  const groupRef = useRef<Group>(null);
  const styles = THEMES[theme];

  useFrame(() => {
    if (!groupRef.current) return;
    const point = curve.getPointAt(progress);
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
    </group>
  );
}

function Scene({
  elevationProfile,
  theme = "neon",
  progress = 0,
  storyBeats = [],
  ghosts = [],
  stats = { hr: 0, power: 0, cadence: 0 },
  avatar,
  equipment,
  quality,
}: {
  elevationProfile: number[];
  theme?: VisualizerTheme;
  progress?: number;
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
}) {
  const curve = useRouteCurve(elevationProfile);
  const styles = THEMES[theme];
  const lastBeatRef = useRef<number>(-1);

  // Animate progress if none provided
  const [activeProgress, setActiveProgress] = useState(progress);

    useFrame((state, delta) => {
      let nextProgress = activeProgress;
      if (progress === 0) {
        nextProgress = (activeProgress + delta * 0.05) % 1;
        setActiveProgress(nextProgress);
      } else {
        nextProgress = progress;
        setActiveProgress(progress);
      }

      // Track beat hits for visual markers
      storyBeats.forEach((beat, index) => {
        if (
          nextProgress >= beat.progress &&
          lastBeatRef.current < index &&
          Math.abs(nextProgress - beat.progress) < 0.02
        ) {
          lastBeatRef.current = index;
        }
      });

    // Reset loop ref if progress resets
    if (nextProgress < 0.01) lastBeatRef.current = -1;

    // Camera follow logic — offset accounts for group position [0, -10, 0]
    // Always track rider so it's never obscured by the road geometry
    const riderPos = curve.getPointAt(nextProgress);
    riderPos.y -= 10; // match group offset
    const tangent = curve.getTangentAt(nextProgress);
    // Chase camera: behind and above the rider
    const offset = tangent
      .clone()
      .multiplyScalar(-18)
      .add(new Vector3(0, 14, 0));
    const targetCamPos = riderPos.clone().add(offset);

    // Faster lerp when riding, gentle when previewing
    const lerpSpeed = progress > 0 ? 0.1 : 0.03;
    state.camera.position.lerp(targetCamPos, lerpSpeed);
    state.camera.lookAt(riderPos);
  });

  // Adaptive particle count based on quality
  const particleCount = quality?.particleCount || 200;
  const sparkleCount = Math.min(particleCount, 30 + Math.floor(stats.power / 4));
  const speedLineCount = quality?.particleCount ? Math.min(50, Math.floor(stats.power / 5)) : 0;

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 12, 35]} fov={60} />
      <ambientLight intensity={0.5} />
      <pointLight
        position={[10, 50, 10]}
        intensity={1}
        color={theme === "mars" ? "#ef4444" : theme === "rainbow" ? "#ff00ff" : "#9b7bff"}
        castShadow={quality?.shadows}
      />
      <fog attach="fog" args={[styles.fog, 40, 250]} />

      <Environment preset={styles.envPreset} />
      
      {/* Conditionally render expensive effects */}
      {particleCount > 100 && <FloatingParticles theme={theme} />}
      
      {progress > 0 && speedLineCount > 0 && (
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
        <Road curve={curve} theme={theme} />
        <RiderMarker
          curve={curve}
          progress={activeProgress}
          theme={theme}
          stats={stats}
          avatar={avatar}
          equipment={equipment}
        />

        {/* Limit ghosts on low-end devices */}
        {ghosts.slice(0, quality?.particleCount && quality.particleCount < 200 ? 3 : 10).map((g, i) => (
          <GhostRider key={i} curve={curve} progress={g} theme={theme} />
        ))}

        {storyBeats.map((beat, i) => (
          <BeatMarker key={i} beat={beat} curve={curve} />
        ))}

        {styles.grid && (
          <gridHelper
            args={[300, 30, theme === "rainbow" ? "#ff00ff" : "#2a1d5a", "#121a2d"]}
            position={[0, -2, 0]}
          />
        )}
      </group>

      {/* OrbitControls only in preview; during a ride the camera follows the rider */}
      {progress === 0 && (
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
  stats = { hr: 145, power: 210, cadence: 90 },
  storyBeats = [],
  ghosts = [],
  className = "",
  onStatsUpdate,
  avatarId,
  equipmentId,
  quality,
}: {
  elevationProfile?: number[];
  theme?: VisualizerTheme;
  progress?: number;
  stats?: RiderStats;
  storyBeats?: StoryBeat[];
  ghosts?: number[];
  className?: string;
  onStatsUpdate?: (stats: RiderStats) => void;
  avatarId?: string;
  equipmentId?: string;
  quality?: "low" | "medium" | "high";
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
    if (progress > 0 && onStatsUpdate) {
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
  }, [progress, stats, onStatsUpdate, performanceTier]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl bg-black ${className}`}
    >
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/20 to-purple-900/20">
          <div className="text-white/60 text-sm">Loading 3D route...</div>
        </div>
      }>
        <Canvas 
          dpr={effectiveQuality.pixelRatio}
          frameloop={progress > 0 ? "always" : "demand"} // Optimize when static
          performance={{ min: 0.5 }} // Allow frame rate to drop if needed
        >
          <color attach="background" args={[styles.fog]} />
          <Scene
            elevationProfile={elevationProfile}
            theme={theme}
            progress={progress}
            storyBeats={storyBeats}
            ghosts={ghosts}
            stats={stats}
            avatar={avatar}
            equipment={equipment}
            quality={effectiveQuality}
          />
        </Canvas>
      </Suspense>

      {/* Overlay UI — only show in preview mode to avoid duplicating the ride HUD */}
      {progress === 0 && (
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
