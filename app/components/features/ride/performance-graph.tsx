"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface PerformanceGraphProps {
  data: number[];
  color: string;
  label: string;
  min?: number;
  max?: number;
}

export function PerformanceGraph({
  data,
  color,
  label,
  min = 0,
  max = 300,
}: PerformanceGraphProps) {
  const points = useMemo(() => {
    if (data.length < 2) return "";
    const width = 200;
    const height = 60;
    const padding = 5;

    return data
      .map((val, i) => {
        const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
        const normalized = Math.max(0, Math.min(1, (val - min) / (max - min)));
        const y = height - (normalized * (height - padding * 2) + padding);
        return `${x},${y}`;
      })
      .join(" ");
  }, [data, min, max]);

  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-black/40 border border-white/5 backdrop-blur-xl">
      <div className="flex items-center justify-between w-full px-2">
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">
          {label} Trend
        </span>
        <div className="flex items-center gap-1">
          <div
            className={`w-1.5 h-1.5 rounded-full ${color.replace("text-", "bg-")} animate-pulse`}
          />
          <span className={`text-[10px] font-bold ${color}`}>
            {data[data.length - 1]}
          </span>
        </div>
      </div>

      <svg width="200" height="60" className="overflow-visible">
        <defs>
          <linearGradient
            id={`grad-${label}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop
              offset="0%"
              stopColor="currentColor"
              stopOpacity="0.3"
              className={color}
            />
            <stop
              offset="100%"
              stopColor="currentColor"
              stopOpacity="0"
              className={color}
            />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <motion.polyline
          fill={`url(#grad-${label})`}
          points={`${points} 200,60 0,60`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Line */}
        <motion.polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          className={color}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
        />
      </svg>
    </div>
  );
}
