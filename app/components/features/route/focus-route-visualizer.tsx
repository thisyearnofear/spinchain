"use client";

import { useMemo } from "react";
import type { StoryBeat } from "@/app/routes/builder/gpx-uploader";

type Props = {
  elevationProfile: number[];
  progress: number; // 0..1
  storyBeats: StoryBeat[];
  className?: string;
};

/**
 * FocusRouteVisualizer (2D)
 *
 * Mobile-first alternative to WebGL. Designed for:
 * - low battery usage
 * - low CPU/GPU load
 * - clear workout feedback (progress + beats)
 */
export default function FocusRouteVisualizer({
  elevationProfile,
  progress,
  storyBeats,
  className = "",
}: Props) {
  const { pathD, min, max } = useMemo(() => {
    const values = elevationProfile.length > 0 ? elevationProfile : [0];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);

    const width = 1000;
    const height = 160;
    const pad = 12;

    const step = (width - pad * 2) / Math.max(1, values.length - 1);
    const points = values.map((v, i) => {
      const x = pad + i * step;
      const t = (v - min) / range;
      const y = height - pad - t * (height - pad * 2);
      return `${x},${y}`;
    });

    return {
      pathD: `M ${points.join(" L ")}`,
      min,
      max,
    };
  }, [elevationProfile]);

  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-black ${className}`}>
      {/* 2D SVG */}
      <svg viewBox="0 0 1000 160" className="h-full w-full">
        <defs>
          <linearGradient id="focusStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>

          <linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect x="0" y="0" width="1000" height="160" fill="#000" />

        {/* Area fill */}
        <path d={`${pathD} L 988,148 L 12,148 Z`} fill="url(#focusFill)" />

        {/* Elevation line */}
        <path d={pathD} fill="none" stroke="url(#focusStroke)" strokeWidth="4" strokeLinejoin="round" />

        {/* Story beats */}
        {storyBeats.map((beat, idx) => {
          const x = 12 + beat.progress * (1000 - 24);
          const color =
            beat.type === "sprint"
              ? "#ef4444"
              : beat.type === "climb"
                ? "#eab308"
                : beat.type === "rest"
                  ? "#60a5fa"
                  : "#a78bfa";
          return (
            <g key={`${beat.progress}-${idx}`}>
              <line x1={x} y1={18} x2={x} y2={150} stroke={color} strokeOpacity="0.25" strokeWidth="2" />
              <circle cx={x} cy={18} r={6} fill={color} fillOpacity="0.9" />
            </g>
          );
        })}

        {/* Progress indicator */}
        <g>
          <rect x="12" y="148" width={clampedProgress * (1000 - 24)} height="6" rx="3" fill="#8b5cf6" />
          <circle cx={12 + clampedProgress * (1000 - 24)} cy={151} r={8} fill="#fff" fillOpacity="0.9" />
        </g>

        {/* Min/Max labels */}
        <text x="12" y="18" fill="rgba(255,255,255,0.45)" fontSize="12">{Math.round(min)}m</text>
        <text x="988" y="18" textAnchor="end" fill="rgba(255,255,255,0.45)" fontSize="12">{Math.round(max)}m</text>
      </svg>

      {/* Badge */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-2">
        <div className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/70 backdrop-blur border border-white/10">
          Focus Mode
        </div>
        <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300 backdrop-blur border border-emerald-500/20">
          2D
        </div>
      </div>
    </div>
  );
}
