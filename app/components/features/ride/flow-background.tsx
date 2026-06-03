"use client";

import { useMemo } from "react";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore, selectEffort, selectCadence } from "@/app/stores/telemetry-store";
import { useCoachingStore, selectCurrentInterval } from "@/app/stores/coaching-store";
import { useUIStore, selectViewMode } from "@/app/stores/ui-store";

const PARTICLES = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  size: 100 + (i * 37) % 300,
  x: (i * 13) % 100,
  y: (i * 23) % 100,
  duration: 12 + (i * 7) % 15,
  delay: -i * 2,
}));

function FlowBackgroundInner() {
  const effort = useTelemetryStore(selectEffort);
  const cadence = useTelemetryStore(selectCadence);
  const currentInterval = useCoachingStore(selectCurrentInterval);

  const intensity = useMemo(() => {
    if (!currentInterval?.targetRpm) return Math.min(1, effort / 100);
    const [min] = currentInterval.targetRpm;
    return Math.min(1, cadence / min);
  }, [cadence, effort, currentInterval]);

  const bgColor = useMemo(() => {
    if (currentInterval?.phase === "sprint") return "#fb7185";
    if (currentInterval?.phase === "recovery") return "#38bdf8";
    return "#fbbf24";
  }, [currentInterval?.phase]);

  const baseOpacity = 0.1 + intensity * 0.2;
  const scale = 1 + intensity * 0.3;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-20 opacity-30">
      <div
        className="absolute inset-0 transition-colors duration-1000"
        style={{ backgroundColor: bgColor, opacity: baseOpacity }}
      />

      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full blur-[60px]"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            backgroundColor: bgColor,
            opacity: baseOpacity,
            transform: `scale(${scale})`,
            animation: `flow-float ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
            willChange: "transform",
          }}
        />
      ))}

      {intensity > 0.7 && (
        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_100px,rgba(255,255,255,0.03)_101px,rgba(255,255,255,0.03)_102px)]" />
      )}
    </div>
  );
}

export function FlowBackground() {
  const isRiding = useRideStore((s) => s.isActive);
  const viewMode = useUIStore(selectViewMode);

  if (!isRiding || viewMode !== "immersive") return null;
  return <FlowBackgroundInner />;
}
