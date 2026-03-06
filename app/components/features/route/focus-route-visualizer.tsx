"use client";

import { useMemo, useRef, useEffect } from "react";
import type { StoryBeat } from "@/app/routes/builder/gpx-uploader";

// Power zone definitions (standard cycling zones)
const POWER_ZONES = {
  1: { color: "#3b82f6", label: "Recovery" },      // Blue
  2: { color: "#22c55e", label: "Endurance" },     // Green
  3: { color: "#eab308", label: "Tempo" },         // Yellow
  4: { color: "#f97316", label: "Threshold" },     // Orange
  5: { color: "#ef4444", label: "VO2 Max" },       // Red
} as const;

type PowerZone = keyof typeof POWER_ZONES;

type Props = {
  elevationProfile: number[];
  progress: number; // 0..1
  storyBeats: StoryBeat[];
  className?: string;
  // Enhanced props for effort visualization
  currentPower?: number; // Current watts
  powerZones?: PowerZone[]; // Zone for each elevation point
  recentPower?: number[]; // Last N power readings for line width
  ftp?: number; // Functional threshold power for zone calculation
};

/**
 * FocusRouteVisualizer (2D)
 *
 * Mobile-first alternative to WebGL. Designed for:
 * - low battery usage
 * - low CPU/GPU load
 * - clear workout feedback (progress + beats)
 * 
 * Enhanced with:
 * - Animated rider avatar
 * - Power zone coloring
 * - Effort-based line width
 * - Completed section dimming
 * - Upcoming terrain preview
 */
export default function FocusRouteVisualizer({
  elevationProfile,
  progress,
  storyBeats,
  className = "",
  currentPower,
  powerZones,
  recentPower,
  ftp = 200, // Default FTP for demo
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const riderRef = useRef<SVGGElement>(null);

  // Calculate path data and points
  const { pathD, points, min, max, pathElement, width, height, isDesktop } = useMemo(() => {
    const values = elevationProfile.length > 0 ? elevationProfile : [0];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);

    // Adaptive dimensions based on container size
    const containerWidth = 1000; // Default mobile width
    const containerHeight = 160; // Default mobile height
    const pad = 12;

    // Calculate responsive dimensions
    const isDesktop = window.innerWidth > 768;
    const width = isDesktop ? Math.min(1400, window.innerWidth * 0.8) : containerWidth;
    const height = isDesktop ? 200 : containerHeight;

    const step = (width - pad * 2) / Math.max(1, values.length - 1);
    const points = values.map((v, i) => {
      const x = pad + i * step;
      const t = (v - min) / range;
      const y = height - pad - t * (height - pad * 2);
      return { x, y, elevation: v };
    });

    const pathD = `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")}`;

    return { pathD, points, min, max, pathElement: pathD, width, height, isDesktop };
  }, [elevationProfile]);

  const clampedProgress = Math.min(1, Math.max(0, progress));

  // Calculate rider position along path
  const riderPosition = useMemo(() => {
    const index = Math.floor(clampedProgress * (points.length - 1));
    const nextIndex = Math.min(index + 1, points.length - 1);
    const localProgress = (clampedProgress * (points.length - 1)) - index;

    const current = points[index];
    const next = points[nextIndex];

    if (!current || !next) return { x: 12, y: 80, rotation: 0 };

    const x = current.x + (next.x - current.x) * localProgress;
    const y = current.y + (next.y - current.y) * localProgress;

    // Calculate slope for rider rotation
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;

    return { x, y, rotation };
  }, [points, clampedProgress]);

  // Calculate effort-based line width
  const avgRecentPower = useMemo(() => {
    if (!recentPower || recentPower.length === 0) return null;
    return recentPower.reduce((a, b) => a + b, 0) / recentPower.length;
  }, [recentPower]);

  const effortWidth = useMemo(() => {
    if (!avgRecentPower || !ftp) return 4;
    const intensity = avgRecentPower / ftp;
    // Width ranges from 4 (base) to 12 (max effort)
    return Math.min(12, 4 + intensity * 8);
  }, [avgRecentPower, ftp]);

  // Generate segmented path for zone coloring
  const zoneSegments = useMemo(() => {
    if (!powerZones || powerZones.length === 0) return null;

    const segments: { d: string; color: string }[] = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const zone = powerZones[i] || 2; // Default to endurance
      const color = POWER_ZONES[zone]?.color || POWER_ZONES[2].color;
      
      segments.push({
        d: `M ${start.x},${start.y} L ${end.x},${end.y}`,
        color,
      });
    }

    return segments;
  }, [points, powerZones]);

  // Animate rider using CSS transforms (60fps friendly)
  useEffect(() => {
    if (riderRef.current) {
      const { x, y, rotation } = riderPosition;
      riderRef.current.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
    }
  }, [riderPosition]);

  // Calculate completion mask
  const completionWidth = clampedProgress * (1000 - 24);
  const upcomingStart = Math.min(1, clampedProgress + 0.1) * (1000 - 24);

  // Get current zone for display
  const currentZoneIndex = Math.floor(clampedProgress * (powerZones?.length || 1));
  const currentZone = powerZones?.[currentZoneIndex];
  const currentZoneColor = currentZone ? POWER_ZONES[currentZone]?.color : null;

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-black ${className}`}>
      {/* 2D SVG */}
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Gradients */}
          <linearGradient id="focusStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>

          <linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="upcomingGlow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>

          {/* Glow filter for effort visualization */}
          <filter id="effortGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Clip path for completed section */}
          <clipPath id="completedClip">
            <rect x="0" y="0" width={completionWidth + 12} height="160" />
          </clipPath>

          <clipPath id="upcomingClip">
            <rect x={upcomingStart + 12} y="0" width={100} height="160" />
          </clipPath>
        </defs>

        {/* Background */}
        <rect x="0" y="0" width="1000" height="160" fill="#000" />

        {/* Area fill */}
        <path d={`${pathD} L 988,148 L 12,148 Z`} fill="url(#focusFill)" />

        {/* Completed section (dimmed) */}
        {completionWidth > 0 && (
          <path
            d={pathD}
            fill="none"
            stroke="#4b5563"
            strokeWidth={effortWidth}
            strokeLinejoin="round"
            strokeOpacity="0.4"
            clipPath="url(#completedClip)"
          />
        )}

        {/* Zone-colored segments (active section) */}
        {zoneSegments ? (
          zoneSegments.map((seg, i) => {
            const segProgress = i / zoneSegments.length;
            const isCompleted = segProgress < clampedProgress;
            const isUpcoming = segProgress > clampedProgress + 0.1;
            
            if (isCompleted || isUpcoming) return null;

            return (
              <path
                key={i}
                d={seg.d}
                fill="none"
                stroke={seg.color}
                strokeWidth={effortWidth}
                strokeLinecap="round"
                filter={avgRecentPower && avgRecentPower > ftp * 1.2 ? "url(#effortGlow)" : undefined}
              />
            );
          })
        ) : (
          /* Fallback: gradient stroke when no zone data */
          <path
            d={pathD}
            fill="none"
            stroke="url(#focusStroke)"
            strokeWidth={effortWidth}
            strokeLinejoin="round"
            style={{
              clipPath: `inset(0 ${100 - clampedProgress * 100}% 0 0)`,
            }}
          />
        )}

        {/* Upcoming terrain glow */}
        <rect
          x={upcomingStart + 12}
          y="0"
          width="100"
          height="160"
          fill="url(#upcomingGlow)"
          style={{ mixBlendMode: "screen" }}
        />

        {/* Story beats with enhanced gamification */}
        {storyBeats.map((beat, idx) => {
          const x = 12 + beat.progress * (1000 - 24);
          const isCompleted = beat.progress < clampedProgress;
          const isCurrent = Math.abs(beat.progress - clampedProgress) < 0.02;
          const color =
            beat.type === "sprint"
              ? "#ef4444"
              : beat.type === "climb"
                ? "#eab308"
                : beat.type === "rest"
                  ? "#60a5fa"
                  : "#a78bfa";

          // Enhanced visual feedback for achievements
          const beatSize = isCurrent ? 8 : isCompleted ? 4 : 6;
          const beatOpacity = isCurrent ? 1 : isCompleted ? 0.3 : 0.9;
          const lineOpacity = isCompleted ? 0.05 : 0.2;

          // Achievement badge for completed beats
          const showBadge = isCompleted && beat.progress < clampedProgress - 0.05;

          return (
            <g key={`${beat.progress}-${idx}`} opacity={isCompleted ? 0.3 : 1}>
              {/* Achievement badge for completed beats */}
              {showBadge && (
                <g opacity={0.8}>
                  <circle
                    cx={x}
                    cy={30}
                    r="12"
                    fill="url(#achievementGradient)"
                    className="transition-all duration-300"
                  />
                  <text
                    x={x}
                    y={34}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="bold"
                    className="text-white/90"
                  >
                    🏆
                  </text>
                </g>
              )}

              {/* Main beat indicator */}
              <line
                x1={x}
                y1={18}
                x2={x}
                y2={150}
                stroke={color}
                strokeOpacity={lineOpacity}
                strokeWidth="2"
                className="transition-opacity duration-300"
              />
              <circle
                cx={x}
                cy={18}
                r={beatSize}
                fill={color}
                fillOpacity={beatOpacity}
                className="transition-all duration-300"
              />

              {/* Current beat highlight */}
              {isCurrent && (
                <g className="animate-pulse">
                  <circle
                    cx={x}
                    cy={18}
                    r="10"
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    opacity="0.3"
                  />
                  <text
                    x={x}
                    y={34}
                    textAnchor="middle"
                    fill={color}
                    fontSize="10"
                    fontWeight="bold"
                    className="text-white/90"
                  >
                    {beat.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Achievement gradient */}
        <defs>
          <linearGradient id="achievementGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffeb3b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ff9800" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Progress bar background */}
        <rect x="12" y="154" width={1000 - 24} height="4" rx="2" fill="#374151" />

        {/* Enhanced progress bar with gamification */}
        <g>
          {/* Progress fill with gradient */}
          <rect
            x="12"
            y="154"
            width={completionWidth}
            height="4"
            rx="2"
            fill="url(#progressGradient)"
            className="transition-all duration-300"
          />

          {/* Progress milestones */}
          {[0.25, 0.5, 0.75, 1].map((milestone, i) => {
            const milestoneX = 12 + milestone * (1000 - 24);
            const isCompleted = clampedProgress >= milestone;
            const showMilestone = isCompleted || clampedProgress > milestone - 0.1;

            if (!showMilestone) return null;

            return (
              <g key={i} opacity={isCompleted ? 1 : 0.5}>
                <line
                  x1={milestoneX}
                  y1="154"
                  x2={milestoneX}
                  y2="158"
                  stroke={isCompleted ? "#8b5cf6" : "#374151"}
                  strokeWidth="2"
                  className="transition-opacity duration-300"
                />
                {isCompleted && (
                  <text
                    x={milestoneX}
                    y="148"
                    textAnchor="middle"
                    fill="#8b5cf6"
                    fontSize="9"
                    fontWeight="bold"
                    className="text-white/90"
                  >
                    {i === 0 ? "25%" : i === 1 ? "50%" : i === 2 ? "75%" : "100%"}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Progress gradient */}
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {/* Enhanced labels with gamification */}
        <g className="transition-opacity duration-300">
          {/* Min/Max labels */}
          <text x="12" y="18" fill="rgba(255,255,255,0.7)" fontSize="12">
            {Math.round(min)}m
          </text>
          <text x="988" y="18" textAnchor="end" fill="rgba(255,255,255,0.7)" fontSize="12">
            {Math.round(max)}m
          </text>

          {/* Achievement milestones */}
          {clampedProgress >= 0.25 && (
            <g opacity={clampedProgress >= 0.25 ? 1 : 0.5}>
              <circle
                cx="250"
                cy="30"
                r="6"
                fill="url(#achievementGradient)"
                className="transition-all duration-300"
              />
              <text
                x="250"
                y="34"
                textAnchor="middle"
                fill="white"
                fontSize="9"
                fontWeight="bold"
                className="text-white/90"
              >
                🚀
              </text>
            </g>
          )}

          {clampedProgress >= 0.5 && (
            <g opacity={clampedProgress >= 0.5 ? 1 : 0.5}>
              <circle
                cx="500"
                cy="30"
                r="6"
                fill="url(#achievementGradient)"
                className="transition-all duration-300"
              />
              <text
                x="500"
                y="34"
                textAnchor="middle"
                fill="white"
                fontSize="9"
                fontWeight="bold"
                className="text-white/90"
              >
                🏅
              </text>
            </g>
          )}

          {clampedProgress >= 0.75 && (
            <g opacity={clampedProgress >= 0.75 ? 1 : 0.5}>
              <circle
                cx="750"
                cy="30"
                r="6"
                fill="url(#achievementGradient)"
                className="transition-all duration-300"
              />
              <text
                x="750"
                y="34"
                textAnchor="middle"
                fill="white"
                fontSize="9"
                fontWeight="bold"
                className="text-white/90"
              >
                🔥
              </text>
            </g>
          )}

          {clampedProgress >= 0.95 && (
            <g opacity={clampedProgress >= 0.95 ? 1 : 0.5}>
              <circle
                cx="988"
                cy="30"
                r="6"
                fill="url(#achievementGradient)"
                className="transition-all duration-300"
              />
              <text
                x="988"
                y="34"
                textAnchor="end"
                fill="white"
                fontSize="9"
                fontWeight="bold"
                className="text-white/90"
              >
                🎉
              </text>
            </g>
          )}
        </g>

        {/* Rider avatar - animated via CSS transforms */}
        <g
          ref={riderRef}
          className="will-change-transform"
          style={{
            transform: `translate(${riderPosition.x}px, ${riderPosition.y}px) rotate(${riderPosition.rotation}deg)`,
            transition: "transform 0.1s linear",
          }}
        >
          {/* Bike/rider icon */}
          <g transform="translate(-12, -12)">
            {/* Wheels */}
            <circle cx="6" cy="18" r="5" fill="none" stroke={currentZoneColor || "#fff"} strokeWidth="2" />
            <circle cx="18" cy="18" r="5" fill="none" stroke={currentZoneColor || "#fff"} strokeWidth="2" />
            {/* Frame */}
            <path
              d="M6 18 L10 10 L16 10 L18 18 M10 10 L8 6 M16 10 L14 6"
              fill="none"
              stroke={currentZoneColor || "#fff"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Rider dot */}
            <circle cx="11" cy="6" r="3" fill={currentZoneColor || "#fff"} />
          </g>
        </g>
      </svg>

      {/* Badges */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-2">
        <div className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/70 backdrop-blur border border-white/10">
          <span className="hidden sm:inline">Focus Mode</span>
          <span className="sm:hidden">2D</span>
        </div>
        <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300 backdrop-blur border border-emerald-500/20">
          <span className="hidden sm:inline">2D</span>
          <span className="sm:hidden">Mobile</span>
        </div>
        {currentZone && (
          <div
            className="rounded-full px-3 py-1 text-xs backdrop-blur border"
            style={{
              backgroundColor: `${POWER_ZONES[currentZone].color}20`,
              borderColor: `${POWER_ZONES[currentZone].color}40`,
              color: POWER_ZONES[currentZone].color,
            }}
          >
            {POWER_ZONES[currentZone].label}
          </div>
        )}
      </div>

      {/* Current power display */}
      {currentPower && (
        <div className="absolute top-4 right-4 z-10 text-right">
          <div className="text-2xl font-bold text-white">{Math.round(currentPower)}</div>
          <div className="text-xs text-white/50">watts</div>
        </div>
      )}

      {/* Desktop enhancements */}
      {isDesktop && (
        <div className="absolute top-4 left-4 z-10">
          <div className="rounded-lg bg-black/60 px-4 py-3 backdrop-blur-md border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <svg className="h-4 w-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs text-white/70">Desktop Mode</span>
            </div>
            <div className="text-xs text-white/50">
              Enhanced visuals and interactions
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
