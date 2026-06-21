"use client";

import { motion } from "framer-motion";

export type CoachyMood = "welcoming" | "cheering" | "coaching" | "celebrating" | "thinking" | "resting";

interface CoachyMascotProps {
  mood?: CoachyMood;
  size?: number;
  className?: string;
  animate?: boolean;
}

const moodColors: Record<CoachyMood, { primary: string; accent: string; glow: string }> = {
  welcoming: { primary: "#6366f1", accent: "#818cf8", glow: "rgba(99, 102, 241, 0.3)" },
  cheering: { primary: "#f59e0b", accent: "#fbbf24", glow: "rgba(245, 158, 11, 0.3)" },
  coaching: { primary: "#06b6d4", accent: "#22d3ee", glow: "rgba(6, 182, 212, 0.3)" },
  celebrating: { primary: "#10b981", accent: "#34d399", glow: "rgba(16, 185, 129, 0.3)" },
  thinking: { primary: "#8b5cf6", accent: "#a78bfa", glow: "rgba(139, 92, 246, 0.3)" },
  resting: { primary: "#64748b", accent: "#94a3b8", glow: "rgba(100, 116, 139, 0.2)" },
};

export function CoachyMascot({ mood = "welcoming", size = 80, className = "", animate = true }: CoachyMascotProps) {
  const colors = moodColors[mood];

  const eyeState = {
    welcoming: "open",
    cheering: "happy",
    coaching: "focused",
    celebrating: "happy",
    thinking: "looking-up",
    resting: "closed",
  }[mood];

  const mouthState = {
    welcoming: "smile",
    cheering: "open-smile",
    coaching: "speaking",
    celebrating: "big-grin",
    thinking: "small-o",
    resting: "flat",
  }[mood];

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full blur-xl animate-pulse"
        style={{ background: colors.glow }}
      />

      <motion.div
        animate={animate ? {
          y: [0, -4, 0],
          rotate: [0, mood === "cheering" ? 3 : 0, 0],
        } : undefined}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="relative"
      >
        <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
          <ellipse cx="50" cy="55" rx="38" ry="35" fill={colors.primary} />
          <ellipse cx="50" cy="52" rx="34" ry="30" fill={colors.accent} opacity="0.3" />
          <path d="M 18 42 Q 50 28 82 42 L 82 48 Q 50 34 18 48 Z" fill="rgba(0,0,0,0.15)" />

          {eyeState === "open" && (
            <>
              <circle cx="38" cy="50" r="4" fill="white" />
              <circle cx="62" cy="50" r="4" fill="white" />
              <circle cx="38" cy="50" r="2" fill="#1e293b" />
              <circle cx="62" cy="50" r="2" fill="#1e293b" />
            </>
          )}
          {eyeState === "happy" && (
            <>
              <path d="M 34 50 Q 38 45 42 50" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M 58 50 Q 62 45 66 50" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </>
          )}
          {eyeState === "focused" && (
            <>
              <rect x="34" y="48" width="8" height="4" rx="2" fill="white" />
              <rect x="58" y="48" width="8" height="4" rx="2" fill="white" />
              <circle cx="38" cy="50" r="1.5" fill="#1e293b" />
              <circle cx="62" cy="50" r="1.5" fill="#1e293b" />
            </>
          )}
          {eyeState === "looking-up" && (
            <>
              <circle cx="38" cy="48" r="3" fill="white" />
              <circle cx="62" cy="48" r="3" fill="white" />
              <circle cx="38" cy="46" r="1.5" fill="#1e293b" />
              <circle cx="62" cy="46" r="1.5" fill="#1e293b" />
            </>
          )}
          {eyeState === "closed" && (
            <>
              <path d="M 34 50 L 42 50" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M 58 50 L 66 50" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </>
          )}

          {mouthState === "smile" && (
            <path d="M 42 62 Q 50 67 58 62" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          )}
          {mouthState === "open-smile" && (
            <ellipse cx="50" cy="64" rx="6" ry="4" fill="white" />
          )}
          {mouthState === "speaking" && (
            <motion.ellipse
              cx="50" cy="64" rx="4" ry="3" fill="white"
              animate={animate ? { ry: [3, 5, 3] } : undefined}
              transition={{ duration: 0.4, repeat: Infinity }}
            />
          )}
          {mouthState === "big-grin" && (
            <path d="M 38 60 Q 50 72 62 60 Q 50 66 38 60 Z" fill="white" />
          )}
          {mouthState === "small-o" && (
            <circle cx="50" cy="64" r="3" fill="white" />
          )}
          {mouthState === "flat" && (
            <path d="M 44 63 L 56 63" stroke="white" strokeWidth="2" strokeLinecap="round" />
          )}

          {(mood === "celebrating" || mood === "cheering") && (
            <>
              <circle cx="28" cy="58" r="4" fill="rgba(255,255,255,0.15)" />
              <circle cx="72" cy="58" r="4" fill="rgba(255,255,255,0.15)" />
            </>
          )}
        </svg>
      </motion.div>
    </div>
  );
}
