"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface RoutePathProps {
  color?: string;
  speed?: number;
  amplitude?: number;
}

function RoutePath({ color = "#6d7cff", speed = 1, amplitude = 0.5 }: RoutePathProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(0);

  // Generate elevation profile
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 50;
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * 4 - 2;
      const y = Math.sin(i * 0.3) * amplitude * 0.5 + Math.sin(i * 0.1) * amplitude;
      const z = 0;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }, [amplitude]);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  useFrame((state) => {
    if (!meshRef.current) return;
    progressRef.current += speed * 0.01;
    if (progressRef.current > 1) progressRef.current = 0;
    
    // Animate the mesh along the curve
    const point = curve.getPoint(progressRef.current);
    meshRef.current.position.set(point.x, point.y, point.z + 0.1);
  });

  return (
    <>
      {/* The route line */}
      <mesh>
        <tubeGeometry args={[curve, 64, 0.02, 8, false]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* Animated rider dot */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial 
          color="#ffffff" 
          emissive={color}
          emissiveIntensity={1}
        />
      </mesh>
      
      {/* Glow effect */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial 
          color={color}
          transparent
          opacity={0.3}
        />
      </mesh>
    </>
  );
}

interface MiniRouteVisualizerProps {
  theme?: "neon" | "alpine" | "mars" | "ocean";
  className?: string;
}

const themeColors = {
  neon: "#6d7cff",
  alpine: "#6ef3c6", 
  mars: "#ff6b6b",
  ocean: "#4ecdc4"
};

export function MiniRouteVisualizer({ theme = "neon", className = "" }: MiniRouteVisualizerProps) {
  const color = themeColors[theme];

  return (
    <div className={`relative ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color={color} />
        <RoutePath color={color} speed={0.5} amplitude={0.6} />
      </Canvas>
      
      {/* Overlay stats */}
      <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] text-[color:var(--muted)]">
        <span>0km</span>
        <span className="text-[color:var(--accent)]">● Live</span>
        <span>25km</span>
      </div>
    </div>
  );
}

// Simpler 2D version for cards
export function MiniRouteSVG({ theme = "neon", className = "" }: MiniRouteVisualizerProps) {
  const color = themeColors[theme];
  
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <svg 
        viewBox="0 0 200 60" 
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`gradient-${theme}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="50%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.2" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background grid */}
        <pattern id="grid" width="20" height="10" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 10" fill="none" stroke={color} strokeOpacity="0.1" strokeWidth="0.5"/>
        </pattern>
        <rect width="200" height="60" fill="url(#grid)" />
        
        {/* Elevation profile */}
        <motion.path
          d="M0,40 Q25,20 50,35 T100,25 T150,40 T200,20"
          fill="none"
          stroke={`url(#gradient-${theme})`}
          strokeWidth="2"
          filter="url(#glow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />
        
        {/* Animated dot */}
        <motion.circle
          r="4"
          fill="#ffffff"
          filter="url(#glow)"
          initial={{ offsetDistance: "0%" }}
          animate={{ offsetDistance: "100%" }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          style={{
            offsetPath: "path('M0,40 Q25,20 50,35 T100,25 T150,40 T200,20')"
          }}
        />
      </svg>
      
      {/* Stats overlay */}
      <div className="absolute bottom-1 left-2 right-2 flex justify-between text-[8px] text-[color:var(--muted)] font-mono">
        <span>0m</span>
        <span className="flex items-center gap-0.5">
          <span className="w-1 h-1 rounded-full bg-[color:var(--success)] animate-pulse" />
          LIVE
        </span>
        <span>+420m</span>
      </div>
    </div>
  );
}

// Add framer-motion import
import { motion } from "framer-motion";
