"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  CatmullRomCurve3,
  Vector3,
  Mesh,
  Shape,
  ExtrudeGeometry,
  Group,
  PointLight,
} from "three";
import { useMemo, useRef, useState, useEffect } from "react";
import {
  OrbitControls,
  Environment,
  Stars,
  Float,
  Html,
  PerspectiveCamera,
  Sparkles,
  Trail,
} from "@react-three/drei";

const THEMES = {
  neon: {
    fog: "#07090f",
    roadColor: "#1f2937",
    roadEmissive: "#6d7cff",
    roadEmissiveIntensity: 0.2,
    lineColor: "#6ef3c6",
    riderColor: "#ffffff",
    grid: true,
    stars: true,
    envPreset: "city" as const,
    particleColor: "#4fd1c5",
  },
  alpine: {
    fog: "#caccf0",
    roadColor: "#4a5568",
    roadEmissive: "#000000",
    roadEmissiveIntensity: 0,
    lineColor: "#2d3748",
    riderColor: "#fbbf24",
    grid: false,
    stars: false,
    envPreset: "forest" as const,
    particleColor: "#ffffff",
  },
  mars: {
    fog: "#451a1a",
    roadColor: "#7f1d1d",
    roadEmissive: "#ef4444",
    roadEmissiveIntensity: 0.1,
    lineColor: "#fca5a5",
    riderColor: "#fbbf24",
    grid: false,
    stars: true,
    envPreset: "sunset" as const,
    particleColor: "#f87171",
  },
};

export type VisualizerTheme = keyof typeof THEMES;

export type StoryBeat = {
  progress: number;
  label: string;
  type: "climb" | "sprint" | "drop" | "rest";
};

export type RiderStats = {
  hr: number;
  power: number;
  cadence: number;
};

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
    const width = 2.5;
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
  }, [curve]);

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
      {theme === "neon" && (
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
}: {
  curve: CatmullRomCurve3;
  progress: number;
  theme?: VisualizerTheme;
  stats?: RiderStats;
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
    groupRef.current.position.y += 1.5;

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
        length={10}
        color={styles.riderColor}
        attenuation={(t) => t * t}
      >
        <Float speed={5} rotationIntensity={0.2} floatIntensity={0.5}>
          {/* Main Body */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.8, 2, 8]} />
            <meshStandardMaterial
              color={styles.riderColor}
              emissive={styles.riderColor}
              emissiveIntensity={4}
              toneMapped={false}
            />
          </mesh>

          {/* Pulsing Aura */}
          <mesh ref={auraRef} rotation={[Math.PI / 2, 0, 0]}>
            <sphereGeometry args={[1.5, 32, 32]} />
            <meshBasicMaterial
              color={styles.riderColor}
              transparent
              opacity={0.1}
            />
          </mesh>

          <pointLight
            ref={lightRef}
            distance={20}
            intensity={10}
            color={styles.riderColor}
          />
        </Float>
      </Trail>

      {/* Label */}
      <Html position={[0, 3, 0]} center transform sprite distanceFactor={20}>
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
}: {
  elevationProfile: number[];
  theme?: VisualizerTheme;
  progress?: number;
  storyBeats?: StoryBeat[];
  ghosts?: number[];
  stats?: RiderStats;
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

    // Camera follow logic
    if (progress > 0) {
      const riderPos = curve.getPointAt(nextProgress);
      const tangent = curve.getTangentAt(nextProgress);
      const offset = tangent
        .clone()
        .multiplyScalar(-30)
        .add(new Vector3(0, 15, 0));
      const targetCamPos = riderPos.clone().add(offset);

      state.camera.position.lerp(targetCamPos, 0.05);
      state.camera.lookAt(riderPos);
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[50, 40, 80]} fov={55} />
      <ambientLight intensity={0.5} />
      <pointLight
        position={[10, 50, 10]}
        intensity={1}
        color={theme === "mars" ? "#ef4444" : "#9b7bff"}
      />
      <fog attach="fog" args={[styles.fog, 20, 250]} />

      <Environment preset={styles.envPreset} />
        <FloatingParticles theme={theme} />
        {progress > 0 && (
          <SpeedLines
            count={Math.min(50, Math.floor(stats.power / 5))}
            theme={theme}
          />
        )}

        <Sparkles
          count={Math.min(100, 30 + Math.floor(stats.power / 4))}
          scale={100}
          size={Math.min(4, 1.5 + stats.power / 150)}
          speed={0.3 + (stats.cadence / 200)}
          color={styles.particleColor}
          opacity={Math.min(0.5, 0.1 + stats.power / 500)}
        />

      <group position={[0, -10, 0]}>
        <Road curve={curve} theme={theme} />
        <RiderMarker
          curve={curve}
          progress={activeProgress}
          theme={theme}
          stats={stats}
        />

        {ghosts.map((g, i) => (
          <GhostRider key={i} curve={curve} progress={g} theme={theme} />
        ))}

        {storyBeats.map((beat, i) => (
          <BeatMarker key={i} beat={beat} curve={curve} />
        ))}

        {styles.grid && (
          <gridHelper
            args={[300, 30, "#2a1d5a", "#121a2d"]}
            position={[0, -2, 0]}
          />
        )}
      </group>

      <OrbitControls
        autoRotate={progress === 0}
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI / 2}
        minDistance={20}
        maxDistance={150}
        enablePan={false}
      />
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
}: {
  elevationProfile?: number[];
  theme?: VisualizerTheme;
  progress?: number;
  stats?: RiderStats;
  storyBeats?: StoryBeat[];
  ghosts?: number[];
  className?: string;
  onStatsUpdate?: (stats: RiderStats) => void;
}) {
  const styles = THEMES[theme];

  // Simulation loop for stats if progress is live
  useEffect(() => {
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
  }, [progress, stats, onStatsUpdate]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl bg-black ${className}`}
    >
      <Canvas dpr={[1, 2]}>
        <color attach="background" args={[styles.fog]} />
        <Scene
          elevationProfile={elevationProfile}
          theme={theme}
          progress={progress}
          storyBeats={storyBeats}
          ghosts={ghosts}
          stats={stats}
        />
      </Canvas>

      {/* Rider HUD Overlay */}
      {progress > 0 && (
        <div className="absolute inset-x-0 top-0 z-20 pointer-events-none p-6">
          <div className="flex gap-4">
            <div className="rounded-xl bg-black/40 border border-white/10 backdrop-blur-md p-3 flex flex-col min-w-[80px]">
              <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                HR
              </span>
              <span className="text-2xl font-black text-white">{stats.hr}</span>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/10 backdrop-blur-md p-3 flex flex-col min-w-[80px]">
              <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                Power
              </span>
              <span className="text-2xl font-black text-[color:var(--brand)]">
                {stats.power}w
              </span>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/10 backdrop-blur-md p-3 flex flex-col min-w-[80px]">
              <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                RPM
              </span>
              <span className="text-2xl font-black text-white">
                {stats.cadence}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Overlay UI */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-2">
        <div className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/70 backdrop-blur border border-white/10">
          {progress > 0 ? "Live View" : "Interactive Preview"}
        </div>
        <div className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-300 backdrop-blur border border-indigo-500/20">
          WebGL
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-10">
        <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/70 backdrop-blur border border-white/10">
          <span
            className={`block h-2 w-2 rounded-full ${progress > 0 ? "animate-pulse bg-green-400" : "bg-yellow-400"}`}
          />
          {progress > 0
            ? `${Math.round(progress * 100)}% Complete`
            : "Preview Mode"}
        </div>
      </div>
    </div>
  );
}
