"use client";

import { motion } from "framer-motion";

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
        <pattern id={`grid-${theme}`} width="20" height="10" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 10" fill="none" stroke={color} strokeOpacity="0.1" strokeWidth="0.5"/>
        </pattern>
        <rect width="200" height="60" fill={`url(#grid-${theme})`} />
        
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

// Keep the component name for backward compatibility
export const MiniRouteVisualizer = MiniRouteSVG;
