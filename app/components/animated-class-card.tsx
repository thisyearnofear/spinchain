"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { EnergyPulse } from "./animated-card";

interface AnimatedClassCardProps {
  classData: {
    address: string;
    name: string;
    instructor: string;
    metadata?: {
      ai?: { enabled: boolean };
      duration?: number;
      route?: any;
    };
    ticketsSold: number;
    maxRiders: number;
    currentPrice: string;
    startTime: number;
  };
  isConnected: boolean;
  onPreview: () => void;
  theme?: "neon" | "alpine" | "mars" | "ocean";
}

const themeColors = {
  neon: { primary: "#6d7cff", secondary: "#9b7bff", bg: "rgba(109, 124, 255, 0.1)" },
  alpine: { primary: "#6ef3c6", secondary: "#4ade80", bg: "rgba(110, 243, 198, 0.1)" },
  mars: { primary: "#ff6b6b", secondary: "#f97316", bg: "rgba(255, 107, 107, 0.1)" },
  ocean: { primary: "#4ecdc4", secondary: "#06b6d4", bg: "rgba(78, 205, 196, 0.1)" },
};

// Mini SVG route visualization
function MiniRoutePreview({ theme, isHovered }: { theme: string; isHovered: boolean }) {
  const colors = themeColors[theme as keyof typeof themeColors] || themeColors.neon;
  
  return (
    <div className="relative h-24 w-full overflow-hidden rounded-lg bg-[color:var(--surface-strong)]">
      {/* Grid background */}
      <svg className="absolute inset-0 w-full h-full opacity-20">
        <defs>
          <pattern id={`grid-${theme}`} width="20" height="10" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 10" fill="none" stroke={colors.primary} strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${theme})`} />
      </svg>
      
      {/* Route path */}
      <svg viewBox="0 0 200 60" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`pathGradient-${theme}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.primary} stopOpacity="0.3" />
            <stop offset="50%" stopColor={colors.primary} stopOpacity="1" />
            <stop offset="100%" stopColor={colors.secondary} stopOpacity="0.3" />
          </linearGradient>
        </defs>
        
        {/* Elevation line */}
        <motion.path
          d="M0,40 Q30,25 60,35 T120,20 T180,35 T200,30"
          fill="none"
          stroke={`url(#pathGradient-${theme})`}
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0.6 }}
          animate={{ pathLength: isHovered ? 1 : 0.6 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
        
        {/* Animated rider dot */}
        {isHovered && (
          <motion.circle
            r="3"
            fill="#ffffff"
            initial={{ offsetDistance: "0%" }}
            animate={{ offsetDistance: "100%" }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            style={{
              offsetPath: "path('M0,40 Q30,25 60,35 T120,20 T180,35 T200,30')"
            }}
          />
        )}
      </svg>
      
      {/* Stats overlay */}
      <div className="absolute bottom-1 left-2 right-2 flex justify-between text-[8px] font-mono text-[color:var(--muted)]">
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

export function AnimatedClassCard({ 
  classData, 
  isConnected, 
  onPreview,
  theme = "neon"
}: AnimatedClassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  const colors = themeColors[theme];

  // Mouse tracking for 3D tilt
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 300, damping: 30 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [10, -10]), springConfig);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-10, 10]), springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) / rect.width);
    y.set((e.clientY - centerY) / rect.height);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  // Determine if class is live (within 15 mins of start)
  const isLive = Math.abs(classData.startTime - Math.floor(Date.now() / 1000)) < 900;
  const fillPercentage = (classData.ticketsSold / classData.maxRiders) * 100;

  return (
    <motion.div
      ref={cardRef}
      className="relative"
      style={{ perspective: 1000 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className="relative rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] overflow-hidden"
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        whileHover={{ 
          boxShadow: `0 25px 50px -12px ${colors.bg}`,
          borderColor: colors.primary
        }}
        transition={{ duration: 0.2 }}
      >
        {/* Glow effect on hover */}
        <motion.div
          className="absolute inset-0 opacity-0 pointer-events-none"
          animate={{ opacity: isHovered ? 1 : 0 }}
          style={{
            background: `radial-gradient(600px circle at ${x.get() * 100 + 50}% ${y.get() * 100 + 50}%, ${colors.bg}, transparent 40%)`
          }}
        />

        {/* Live indicator */}
        {isLive && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30">
            <EnergyPulse size="sm" color="#ef4444" />
            <span className="text-[10px] font-bold text-red-400 uppercase">Live</span>
          </div>
        )}

        {/* AI Coach badge */}
        {classData.metadata?.ai?.enabled && (
          <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-full bg-[color:var(--accent)]/10 border border-[color:var(--accent)]/30">
            <span className="text-[10px] font-semibold text-[color:var(--accent)]">AI Coach</span>
          </div>
        )}

        <div className="p-5">
          {/* Header */}
          <div className="mb-4">
            <h3 className="text-lg font-bold text-[color:var(--foreground)] mb-1 line-clamp-1">
              {classData.name}
            </h3>
            <p className="text-sm text-[color:var(--muted)]">
              by {classData.instructor}
            </p>
          </div>

          {/* Mini Route Visualization */}
          <div className="mb-4">
            <MiniRoutePreview theme={theme} isHovered={isHovered} />
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between text-xs text-[color:var(--muted)] mb-4">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {classData.metadata?.duration || 45} min
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {classData.ticketsSold}/{classData.maxRiders}
            </span>
            <span className="flex items-center gap-1 font-medium text-[color:var(--foreground)]">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {classData.currentPrice} ETH
            </span>
          </div>

          {/* Fill progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-[color:var(--muted)] mb-1">
              <span>Class filling up</span>
              <span>{Math.round(fillPercentage)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[color:var(--surface-strong)] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})` }}
                initial={{ width: 0 }}
                animate={{ width: `${fillPercentage}%` }}
                transition={{ duration: 1, delay: 0.2 }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <motion.button
              onClick={onPreview}
              className="flex-1 py-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-strong)] text-sm font-medium text-[color:var(--foreground)]"
              whileHover={{ scale: 1.02, borderColor: colors.primary }}
              whileTap={{ scale: 0.98 }}
            >
              Preview
            </motion.button>
            <motion.button
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                boxShadow: isHovered ? `0 10px 30px -10px ${colors.primary}` : 'none'
              }}
              disabled={!isConnected}
              whileHover={isConnected ? { scale: 1.02 } : {}}
              whileTap={isConnected ? { scale: 0.98 } : {}}
            >
              {isConnected ? "Join" : "Connect"}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
