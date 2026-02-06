"use client";

/**
 * AudioWaveform Component - Visual feedback for audio playback
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Adds visual polish to existing audio
 * - PERFORMANT: CSS animations, minimal JS
 * - MODULAR: Works with any audio source
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface AudioWaveformProps {
  isActive: boolean;
  intensity?: number; // 0-1
  color?: string;
  barCount?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CONFIG = {
  sm: { height: 24, barWidth: 3, gap: 2 },
  md: { height: 40, barWidth: 4, gap: 3 },
  lg: { height: 60, barWidth: 6, gap: 4 },
};

export function AudioWaveform({
  isActive,
  intensity = 0.5,
  color = "#6366f1",
  barCount = 12,
  size = "md",
  className = "",
}: AudioWaveformProps) {
  const config = SIZE_CONFIG[size];
  const [bars, setBars] = useState<number[]>([]);
  const animationRef = useRef<number | null>(null);

  // Generate animated bar heights
  useEffect(() => {
    if (!isActive) {
      setBars(Array(barCount).fill(0.1));
      return;
    }

    const animate = () => {
      setBars(
        Array(barCount)
          .fill(0)
          .map((_, i) => {
            // Create wave pattern
            const base = Math.sin(Date.now() / 200 + i * 0.5) * 0.5 + 0.5;
            const noise = Math.random() * 0.3;
            return Math.min(1, (base + noise) * intensity);
          })
      );
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, intensity, barCount]);

  return (
    <div
      className={`flex items-center justify-center gap-1 ${className}`}
      style={{ height: config.height }}
    >
      {bars.map((height, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{
            width: config.barWidth,
            backgroundColor: color,
            boxShadow: isActive ? `0 0 10px ${color}50` : "none",
          }}
          animate={{
            height: Math.max(config.height * 0.1, config.height * height),
            opacity: isActive ? 0.8 + height * 0.2 : 0.3,
          }}
          transition={{
            duration: 0.1,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

// Simpler variant for inline use
export function AudioIndicator({
  isActive,
  color = "#6366f1",
  size = "md",
  className = "",
}: {
  isActive: boolean;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full"
          style={{ backgroundColor: color }}
          animate={
            isActive
              ? {
                  height: [4, 12, 4],
                  opacity: [0.5, 1, 0.5],
                }
              : { height: 4, opacity: 0.3 }
          }
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export default AudioWaveform;
