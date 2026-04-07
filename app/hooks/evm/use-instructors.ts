"use client";

import { useMemo } from "react";
import { useClasses, type ClassWithRoute } from "./use-class-data";

export interface InstructorProfile {
  name: string;
  role: string;
  icon: string;
  color: string;
  rating: string;
  rides: string;
  specialty: string;
  agenticPowers: string[];
  address: `0x${string}` | string;
  isAI: boolean;
}

const PERSONALITY_MAP: Record<string, { icon: string, color: string, role: string, powers: string[] }> = {
  "zen": {
    icon: "🧘",
    color: "from-emerald-500 to-teal-500",
    role: "Mindful Recovery",
    powers: ["Heart Rate Coherence", "Breathwork Guiding", "Low-Impact Optimization"]
  },
  "drill-sergeant": {
    icon: "⚡",
    color: "from-amber-500 to-orange-500",
    role: "High-Intensity Lead",
    powers: ["Real-time Resistance", "Sprint Analytics", "Interval Engineering"]
  },
  "data": {
    icon: "📊",
    color: "from-blue-500 to-cyan-500",
    role: "Endurance Specialist",
    powers: ["W'bal Optimization", "FTP Tracking", "Zone-based Pacing"]
  }
};

/**
 * useInstructors - Aggregates instructor data from on-chain classes
 * 
 * Production Architecture:
 * - Fetches all classes from the factory
 * - Extracts unique instructors and their metadata
 * - Provides a unified profile for both human and AI instructors
 */
export function useInstructors() {
  const { classes, isLoading, error } = useClasses();

  const instructors = useMemo(() => {
    const instructorMap = new Map<string, InstructorProfile>();

    classes.forEach((cls: ClassWithRoute) => {
      const name = cls.instructor;
      if (!name || instructorMap.has(name)) return;

      const metadata = cls.route?.metadata;
      const isAI = metadata?.ai?.enabled ?? false;
      const personality = metadata?.ai?.personality ?? "data";
      const config = PERSONALITY_MAP[personality] || PERSONALITY_MAP["data"];

      instructorMap.set(name, {
        name,
        address: name.startsWith("0x") ? name : "0x0000000000000000000000000000000000000000",
        isAI,
        role: config.role,
        icon: config.icon,
        color: config.color,
        rating: (4.5 + Math.random() * 0.5).toFixed(1), // Mocked for now, should be on-chain
        rides: (100 + Math.floor(Math.random() * 2000)).toString(), // Mocked for now
        specialty: metadata?.description?.split(".")[0] || "Professional Cycling Instructor",
        agenticPowers: isAI ? config.powers : ["Class Design", "Live Coaching", "Performance Feedback"],
      });
    });

    return Array.from(instructorMap.values());
  }, [classes]);

  return {
    instructors,
    isLoading,
    error
  };
}
