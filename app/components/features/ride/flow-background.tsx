"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore, selectEffort, selectCadence } from "@/app/stores/telemetry-store";
import { useCoachingStore, selectCurrentInterval } from "@/app/stores/coaching-store";
import { useUIStore, selectViewMode } from "@/app/stores/ui-store";

export function FlowBackground() {
  const isRiding = useRideStore((s) => s.isActive);
  const effort = useTelemetryStore(selectEffort);
  const cadence = useTelemetryStore(selectCadence);
  const currentInterval = useCoachingStore(selectCurrentInterval);
  const viewMode = useUIStore(selectViewMode);

  const intensity = useMemo(() => {
    if (!currentInterval?.targetRpm) return effort / 100;
    const [min] = currentInterval.targetRpm;
    return Math.min(1, cadence / min);
  }, [cadence, effort, currentInterval]);

  const color = useMemo(() => {
    if (currentInterval?.phase === "sprint") return "bg-rose-500";
    if (currentInterval?.phase === "recovery") return "bg-sky-500";
    return "bg-yellow-500";
  }, [currentInterval?.phase]);
  const particles = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      size: Math.random() * 400 + 100,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 20 + 10,
    }));
  }, []);

  if (!isRiding || viewMode !== "immersive") return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-20 opacity-30">
      {/* Dynamic Gradient Base */}
      <div
        className={`absolute inset-0 transition-colors duration-1000 ${color}`}
        style={{ opacity: 0.1 + intensity * 0.2 }}
      />

      {/* Floating Flow Particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full blur-[120px]"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            backgroundColor: "currentColor",
            color: color.includes("rose")
              ? "#fb7185"
              : color.includes("sky")
                ? "#38bdf8"
                : "#fbbf24",
          }}
          animate={{
            x: [0, Math.random() * 100 - 50, 0],
            y: [0, Math.random() * 100 - 50, 0],
            scale: [1, 1.2 + intensity * 0.5, 1],
            opacity: [0.1, 0.2 + intensity * 0.3, 0.1],
          }}
          transition={{
            duration: p.duration / (1 + intensity),
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Speed Lines effect at high intensity */}
      {intensity > 0.7 && (
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[repeating-linear-gradient(90deg,transparent,transparent_100px,rgba(255,255,255,0.03)_101px,rgba(255,255,255,0.03)_102px)] animate-[pulse_2s_infinite]" />
        </div>
      )}
    </div>
  );
}
