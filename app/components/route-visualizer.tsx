"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  CatmullRomCurve3,
  Vector3,
  Mesh,
  Shape,
  ExtrudeGeometry,
  Group,
} from "three";
import { useMemo, useRef, useState } from "react";
import {
  OrbitControls,
  Environment,
  Stars,
  Float,
  Html,
  PerspectiveCamera,
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
    <mesh ref={meshRef} geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        color={styles.roadColor}
        emissive={styles.roadEmissive}
        emissiveIntensity={styles.roadEmissiveIntensity}
        roughness={0.4}
        metalness={0.8}
      />
    </mesh>
  );
}

function RiderMarker({
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
  });

  return (
    <group ref={groupRef}>
      <Float speed={5} rotationIntensity={0.2} floatIntensity={0.5}>
        {/* Rider Avatar / Cone */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.8, 2, 8]} />
          <meshStandardMaterial
            color={styles.riderColor}
            emissive={styles.riderColor}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>

        {/* Glow effect */}
        <pointLight distance={15} intensity={5} color={styles.riderColor} />
      </Float>

      {/* Label */}
      <Html position={[0, 2.5, 0]} center transform sprite>
        <div className="flex flex-col items-center gap-1">
          <div className="whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm border border-white/20">
            YOU
          </div>
        </div>
      </Html>
    </group>
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
}: {
  elevationProfile: number[];
  theme?: VisualizerTheme;
  progress?: number;
  storyBeats?: StoryBeat[];
  ghosts?: number[];
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

    // Audio Trigger Logic
    storyBeats.forEach((beat, index) => {
      if (
        nextProgress >= beat.progress &&
        lastBeatRef.current < index &&
        Math.abs(nextProgress - beat.progress) < 0.02
      ) {
        lastBeatRef.current = index;
        // Simple Audio Feedback (Browser Audio)
        if (typeof window !== "undefined") {
          try {
            const ctx = new (window.AudioContext ||
              (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 440;
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
          } catch (e) {
            console.warn("Audio Context failed", e);
          }
        }
      }
    });

    // Reset loop ref if progress resets
    if (nextProgress < 0.01) lastBeatRef.current = -1;
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[50, 40, 80]} fov={45} />
      <ambientLight intensity={0.2} />
      <pointLight
        position={[10, 50, 10]}
        intensity={1}
        color={theme === "mars" ? "#ef4444" : "#9b7bff"}
      />
      <fog attach="fog" args={[styles.fog, 20, 250]} />

      <Environment preset={styles.envPreset} />
      <FloatingParticles theme={theme} />

      <group position={[0, -10, 0]}>
        <Road curve={curve} theme={theme} />
        <RiderMarker curve={curve} progress={activeProgress} theme={theme} />

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
}: {
  elevationProfile?: number[];
  theme?: VisualizerTheme;
  progress?: number;
  stats?: RiderStats;
  storyBeats?: StoryBeat[];
  ghosts?: number[];
  className?: string;
}) {
  const styles = THEMES[theme];

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
