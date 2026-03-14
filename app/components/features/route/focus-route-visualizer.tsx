"use client";

import { useId, useMemo, useCallback, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { StoryBeat } from "@/app/routes/builder/gpx-uploader";
import { useViewport } from "@/app/lib/responsive";
import { AVATARS, EQUIPMENT } from "../../../lib/selection-library";
import type { IntervalPhase } from "../../../lib/workout-plan";
import type { RiderStats } from "./route-visualizer";
import { StreetViewPreview } from "./street-view-preview";
import { VISUALIZER_THEMES as THEMES, type VisualizerTheme } from "./visualizer-theme";
import { CollapseToggle } from "@/app/components/features/common/collapse-toggle";
import type { PanelState, PanelKey, PanelPositions, DesktopPanelKey } from "@/app/hooks/ui/use-panel-state";
import { Z_LAYERS } from "@/app/lib/ui/z-layers";

type RouteCoordinate = {
  lat: number;
  lng: number;
  ele?: number | null;
};

type Props = {
  elevationProfile: number[];
  progress: number;
  storyBeats: StoryBeat[];
  className?: string;
  currentPower?: number;
  recentPower?: number[];
  ftp?: number;
  theme?: VisualizerTheme;
  stats?: RiderStats;
  avatarId?: string;
  equipmentId?: string;
  routeName?: string;
  routeStartCoordinate?: RouteCoordinate | null;
  currentCoordinate?: RouteCoordinate | null;
  intervalPhase?: IntervalPhase | null;
  // Collapsible panel state
  panelState?: PanelState;
  panelPositions?: PanelPositions;
  onTogglePanel?: (key: PanelKey) => void;
  onSetPanelPosition?: (key: DesktopPanelKey, position: { x: number; y: number }) => void;
  onSnapPanel?: (key: DesktopPanelKey) => void;
  onTrackWidgetInteraction?: (action: "toggle" | "minimize" | "restore" | "drag", panel: PanelKey) => void;
  /** Use accordion behavior - only one panel expanded at a time (for mobile) */
  useAccordion?: boolean;
  /** Expand one panel while collapsing others (for accordion mode) */
  onExpandOne?: (key: PanelKey) => void;
  /** Trigger haptic feedback - called on panel toggle in accordion mode */
  onHaptic?: (type: "light" | "medium" | "heavy") => void;
  /** Toggle street view card visibility for mock/practice routes */
  showStreetView?: boolean;
};

const POWER_ZONES = [
  { maxRatio: 0.55, color: "#60a5fa", label: "Recovery" },
  { maxRatio: 0.75, color: "#34d399", label: "Endurance" },
  { maxRatio: 0.9, color: "#facc15", label: "Tempo" },
  { maxRatio: 1.05, color: "#fb923c", label: "Threshold" },
  { maxRatio: Number.POSITIVE_INFINITY, color: "#f87171", label: "VO2" },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getPowerZone(power: number, ftp: number) {
  const ratio = ftp > 0 ? power / ftp : 0;
  return POWER_ZONES.find((zone) => ratio <= zone.maxRatio) ?? POWER_ZONES[POWER_ZONES.length - 1];
}

function samplePoints(points: Array<{ x: number; y: number }>, count: number, scale: number, baseline: number) {
  const stride = Math.max(1, Math.floor(points.length / count));
  return points.filter((_, index) => index % stride === 0).map((point, index) => ({
    x: point.x,
    y: baseline + (point.y - baseline) * scale + Math.sin(index * 0.8) * 6,
  }));
}

function BeatGlyph({
  theme,
  beatType,
  color,
  isActive,
}: {
  theme: VisualizerTheme;
  beatType: StoryBeat["type"];
  color: string;
  isActive: boolean;
}) {
  const strokeWidth = isActive ? 2.2 : 1.8;
  const inner =
    beatType === "sprint" ? (
      <path d="M -2 -5 L 2 -1 L -1 -1 L 3 5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    ) : beatType === "climb" ? (
      <path d="M -5 4 L -1 -2 L 1 1 L 5 -5" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    ) : beatType === "rest" ? (
      <circle cx="0" cy="0" r="3.2" fill="white" fillOpacity="0.92" />
    ) : (
      <path d="M -4 0 L 0 -4 L 4 0 L 0 4 Z" fill="white" fillOpacity="0.92" />
    );

  if (theme === "neon") {
    return (
      <g>
        <rect x="-9" y="-9" width="18" height="18" rx="4" transform="rotate(45)" fill={`${color}30`} stroke={color} strokeWidth={strokeWidth} />
        {inner}
      </g>
    );
  }

  if (theme === "alpine") {
    return (
      <g>
        <path d="M 0 -11 L 10 8 L -10 8 Z" fill={`${color}35`} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
        {inner}
      </g>
    );
  }

  if (theme === "mars") {
    return (
      <g>
        <circle cx="0" cy="0" r="9" fill={`${color}20`} stroke={color} strokeWidth={strokeWidth} />
        <ellipse cx="0" cy="0" rx="12" ry="5" fill="none" stroke={`${color}99`} strokeWidth="1.2" />
        {inner}
      </g>
    );
  }

  if (theme === "anime") {
    return (
      <g>
        <circle cx="0" cy="0" r="9" fill={`${color}28`} stroke={color} strokeWidth={strokeWidth} />
        <path d="M 0 -12 L 3 -3 L 12 0 L 3 3 L 0 12 L -3 3 L -12 0 L -3 -3 Z" fill={`${color}30`} stroke={color} strokeWidth="1.2" />
        {inner}
      </g>
    );
  }

  return (
    <g>
      <path d="M 0 -11 L 10 0 L 0 11 L -10 0 Z" fill={`${color}26`} stroke={color} strokeWidth={strokeWidth} />
      <path d="M -7 0 L 0 -7 L 7 0 L 0 7 Z" fill="none" stroke={`${color}aa`} strokeWidth="1.2" />
      {inner}
    </g>
  );
}

export default function FocusRouteVisualizer({
  elevationProfile,
  progress,
  storyBeats,
  className = "",
  currentPower = 0,
  recentPower,
  ftp = 200,
  theme = "neon",
  stats = { hr: 0, power: 0, cadence: 0 },
  avatarId,
  equipmentId,
  routeName = "Focus Route",
  routeStartCoordinate,
  currentCoordinate,
  intervalPhase = null,
  panelState,
  panelPositions,
  onTogglePanel,
  onSetPanelPosition,
  onSnapPanel,
  onTrackWidgetInteraction,
  useAccordion = false,
  onExpandOne,
  onHaptic,
  showStreetView = true,
}: Props) {
  const dragStateRef = useRef<{ key: DesktopPanelKey; startX: number; startY: number; pointerX: number; pointerY: number } | null>(null);
  const viewport = useViewport();
  const gradientId = useId().replace(/:/g, "");
  const styles = THEMES[theme];
  const avatar = useMemo(() => AVATARS.find((item) => item.id === avatarId), [avatarId]);
  const equipment = useMemo(() => EQUIPMENT.find((item) => item.id === equipmentId), [equipmentId]);
  const leftMode = panelState?.focusLeft ?? "expanded";
  const rightMode = panelState?.focusRight ?? "expanded";
  const bottomMode = panelState?.focusBottom ?? "expanded";
  const leftExpanded = leftMode === "expanded";
  const rightExpanded = rightMode === "expanded";
  const bottomExpanded = bottomMode === "expanded";
  const leftMinimized = leftMode === "minimized";
  const rightMinimized = rightMode === "minimized";
  const bottomMinimized = bottomMode === "minimized";

  // Handler for accordion behavior - uses expandOne on mobile, toggle on desktop
  const handleToggle = useCallback((key: PanelKey) => {
    // Trigger haptic feedback on mobile when toggling panels
    if (useAccordion && onHaptic) {
      onHaptic("light");
    }
    if (useAccordion && onExpandOne) {
      // Mobile: accordion behavior - expand one, collapse others
      onExpandOne(key);
    } else if (onTogglePanel) {
      // Desktop: normal toggle behavior
      onTogglePanel(key);
    }
    onTrackWidgetInteraction?.("toggle", key);
  }, [useAccordion, onExpandOne, onTogglePanel, onHaptic, onTrackWidgetInteraction]);

  const getDesktopPanelStyle = useCallback((key: DesktopPanelKey): CSSProperties => {
    const position = panelPositions?.[key];
    if (!position) return {};

    if (key === "focusLeft") {
      return { top: position.y, left: Math.max(0, position.x) };
    }

    if (key === "focusRight") {
      return { top: position.y, right: Math.max(0, -position.x) };
    }

    return { left: position.x, bottom: Math.max(16, -position.y) };
  }, [panelPositions]);

  const handleDragStart = useCallback((event: ReactPointerEvent<HTMLDivElement>, key: DesktopPanelKey) => {
    if (!onSetPanelPosition) return;
    // Don't start drag if user clicked an interactive element (button, toggle, link)
    const target = event.target as HTMLElement;
    if (target.closest('button, a, [role="button"], input, select, textarea')) return;
    const current = panelPositions?.[key];
    if (!current) return;

    dragStateRef.current = {
      key,
      startX: current.x,
      startY: current.y,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [onSetPanelPosition, panelPositions]);

  const handleDragMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onSetPanelPosition || !dragStateRef.current) return;
    const drag = dragStateRef.current;
    const deltaX = event.clientX - drag.pointerX;
    const deltaY = event.clientY - drag.pointerY;
    onSetPanelPosition(drag.key, {
      x: drag.startX + deltaX,
      y: drag.startY + deltaY,
    });
  }, [onSetPanelPosition]);

  const handleDragEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    const key = dragStateRef.current.key;
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onSnapPanel?.(key);
    onTrackWidgetInteraction?.("drag", key);
  }, [onSnapPanel, onTrackWidgetInteraction]);

  const width = Math.max(360, viewport.width);
  const height = Math.max(320, viewport.height);
  const padX = Math.max(24, width * 0.05);
  const routeTop = height * 0.24;
  const routeBottom = height * 0.78;
  const horizonY = height * 0.42;
  const values = useMemo(() => (elevationProfile.length > 0 ? elevationProfile : [0]), [elevationProfile]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const clampedProgress = clamp(progress, 0, 1);
  const displayedPower = currentPower || stats.power || 0;
  const powerTrend = useMemo(() => {
    if (!recentPower || recentPower.length < 2) return 0;
    const first = recentPower[0] ?? 0;
    const last = recentPower[recentPower.length - 1] ?? 0;
    return last - first;
  }, [recentPower]);
  const avgRecentPower = useMemo(() => {
    if (!recentPower || recentPower.length === 0) return displayedPower;
    return recentPower.reduce((sum, sample) => sum + sample, 0) / recentPower.length;
  }, [displayedPower, recentPower]);
  const effortRatio = ftp > 0 ? avgRecentPower / ftp : 0;
  const routeStroke = clamp(18 + effortRatio * 10, 18, 30);
  const routeHalo = clamp(28 + effortRatio * 18, 28, 48);
  const currentZone = getPowerZone(displayedPower, ftp);

  const points = useMemo(() => {
    const step = values.length > 1 ? (width - padX * 2) / (values.length - 1) : 0;
    return values.map((value, index) => {
      const x = padX + index * step;
      const normalized = (value - min) / range;
      const y = routeBottom - normalized * (routeBottom - routeTop);
      return { x, y, elevation: value };
    });
  }, [min, padX, range, routeBottom, routeTop, values, width]);

  const routePath = useMemo(
    () => `M ${points.map((point) => `${point.x},${point.y}`).join(" L ")}`,
    [points],
  );
  const routeFillPath = useMemo(
    () => `${routePath} L ${width - padX},${height} L ${padX},${height} Z`,
    [height, padX, routePath, width],
  );
  const terrainBack = useMemo(() => {
    const sampled = samplePoints(points, 18, styles.terrainBackScale, horizonY);
    return `M ${padX},${height} L ${sampled.map((point) => `${point.x},${point.y}`).join(" L ")} L ${width - padX},${height} Z`;
  }, [height, horizonY, padX, points, styles.terrainBackScale, width]);
  const terrainFront = useMemo(() => {
    const sampled = samplePoints(points, 24, styles.terrainFrontScale, horizonY + 40);
    return `M ${padX},${height} L ${sampled.map((point) => `${point.x},${point.y}`).join(" L ")} L ${width - padX},${height} Z`;
  }, [height, horizonY, padX, points, styles.terrainFrontScale, width]);

  const riderPosition = useMemo(() => {
    const index = Math.floor(clampedProgress * Math.max(0, points.length - 1));
    const nextIndex = Math.min(index + 1, points.length - 1);
    const localProgress = clamp(clampedProgress * Math.max(0, points.length - 1) - index, 0, 1);
    const current = points[index] ?? { x: padX, y: routeBottom };
    const next = points[nextIndex] ?? current;
    const x = current.x + (next.x - current.x) * localProgress;
    const y = current.y + (next.y - current.y) * localProgress;
    const rotation = (Math.atan2(next.y - current.y, Math.max(1, next.x - current.x)) * 180) / Math.PI;
    return { x, y, rotation };
  }, [clampedProgress, padX, points, routeBottom]);

  const beatMarkers = useMemo(
    () =>
      storyBeats.map((beat) => {
        const x = padX + beat.progress * (width - padX * 2);
        const beatIndex = Math.min(points.length - 1, Math.max(0, Math.round(beat.progress * Math.max(0, points.length - 1))));
        const pathPoint = points[beatIndex] ?? { y: routeBottom };
        const color =
          beat.type === "sprint"
            ? "#fb7185"
            : beat.type === "climb"
              ? "#facc15"
              : beat.type === "rest"
                ? "#60a5fa"
                : styles.lineColor;
        return {
          ...beat,
          x,
          y: Math.max(routeTop + 18, pathPoint.y - 52),
          color,
          isActive: Math.abs(beat.progress - clampedProgress) < 0.02,
          isPassed: beat.progress < clampedProgress,
        };
      }),
    [clampedProgress, padX, points, routeBottom, routeTop, storyBeats, styles.lineColor, width],
  );

  const nextBeat = beatMarkers.find((beat) => beat.progress >= clampedProgress) ?? beatMarkers[beatMarkers.length - 1];
  const currentSlope = useMemo(() => {
    const index = Math.min(points.length - 2, Math.max(0, Math.floor(clampedProgress * Math.max(1, points.length - 1))));
    const current = points[index];
    const next = points[index + 1];
    if (!current || !next) return 0;
    return ((current.elevation - next.elevation) / Math.max(1, next.x - current.x)) * 120;
  }, [clampedProgress, points]);
  const completionWidth = padX + clampedProgress * (width - padX * 2);
  const routePreviewCoordinate = routeStartCoordinate ?? currentCoordinate ?? null;
  const nextBeatDistance = nextBeat ? Math.max(0, Math.round((nextBeat.progress - clampedProgress) * 100)) : 0;
  const horizonPatternOpacity = clamp(styles.patternOpacity + effortRatio * 0.04, styles.patternOpacity, styles.patternOpacity + 0.08);
  const isGridTheme = styles.atmosphere === "grid" || styles.atmosphere === "prism";
  const isMistTheme = styles.atmosphere === "mist";
  const isDustTheme = styles.atmosphere === "dust";
  const isSunTheme = styles.atmosphere === "sun";
  const isPrismTheme = styles.atmosphere === "prism";
  const roadDashStroke = theme === "anime" ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.14)";
  const routeBaseStroke = theme === "anime" ? `${styles.roadColor}f5` : `url(#${gradientId}-route-base)`;
  const beatPulseDuration = clamp(60 / Math.max(stats.cadence || 72, 48), 0.42, 1.1);
  const routeSyncStyle = {
    ["--focus-route-duration" as string]: `${beatPulseDuration}s`,
    ["--focus-route-delay" as string]: "-0.08s",
  } as CSSProperties;
  const phaseAccent =
    intervalPhase === "sprint"
      ? "#fb7185"
      : intervalPhase === "recovery" || intervalPhase === "cooldown"
        ? "#60a5fa"
        : intervalPhase === "interval"
          ? "#f97316"
          : intervalPhase === "warmup"
            ? "#34d399"
            : currentZone.color;
  const primaryMetric =
    intervalPhase === "sprint"
      ? { label: "Cadence", value: `${Math.round(stats.cadence)}`, unit: "rpm" }
      : intervalPhase === "recovery" || intervalPhase === "cooldown"
        ? { label: "Heart Rate", value: `${Math.round(stats.hr)}`, unit: "bpm" }
        : { label: "Power", value: `${Math.round(displayedPower)}`, unit: "watts" };
  const secondaryMetric =
    intervalPhase === "sprint"
      ? { label: "Power", value: `${Math.round(displayedPower)}`, unit: "watts" }
      : intervalPhase === "recovery" || intervalPhase === "cooldown"
        ? { label: "Cadence", value: `${Math.round(stats.cadence)}`, unit: "rpm" }
        : { label: "Heart Rate", value: `${Math.round(stats.hr)}`, unit: "bpm" };
  const tertiaryMetric =
    intervalPhase === "warmup"
      ? { label: "Trend", value: `${powerTrend >= 0 ? "+" : ""}${Math.round(powerTrend)}`, unit: "W" }
      : { label: "Zone", value: currentZone.label, unit: "target" };
  const phaseLabel = intervalPhase ? intervalPhase.charAt(0).toUpperCase() + intervalPhase.slice(1) : "Cruise";

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl bg-black ${className}`}
      style={{
        background: `linear-gradient(180deg, ${styles.skyTop} 0%, ${styles.skyBottom} 50%, #030712 100%)`,
      }}
    >
      <div className="focus-aurora absolute -left-[10%] top-[-12%] h-[58%] w-[72%] rounded-full blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${styles.horizonGlow}44 0%, transparent 68%)` }}
      />
      <div className="focus-aurora absolute right-[-18%] top-[8%] h-[44%] w-[58%] rounded-full blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${currentZone.color}2f 0%, transparent 66%)`, animationDelay: "-6s" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 35%, ${styles.horizonGlow}55 0%, transparent 42%)`,
        }}
      />
      {isGridTheme ? (
        <>
          <div
            className="focus-scanline absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(90deg, transparent 0%, ${styles.horizonGlow}1c 40%, ${styles.horizonGlow}30 50%, ${styles.horizonGlow}1c 60%, transparent 100%)`,
              mixBlendMode: "screen",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,${horizonPatternOpacity}) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,${horizonPatternOpacity * 0.8}) 1px, transparent 1px)`,
              backgroundSize: `${Math.max(44, width * 0.045)}px ${Math.max(44, width * 0.045)}px`,
              maskImage: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.9) 32%, rgba(0,0,0,0.95) 78%, transparent 100%)",
              opacity: styles.patternOpacity,
            }}
          />
        </>
      ) : null}
      {isMistTheme ? (
        <>
          <div className="focus-aurora absolute left-[-8%] top-[18%] h-28 w-[42%] rounded-full blur-3xl pointer-events-none"
            style={{ background: "rgba(255,255,255,0.18)", animationDuration: "20s" }}
          />
          <div className="focus-aurora absolute right-[-6%] top-[26%] h-24 w-[36%] rounded-full blur-3xl pointer-events-none"
            style={{ background: "rgba(255,255,255,0.14)", animationDelay: "-10s", animationDuration: "22s" }}
          />
        </>
      ) : null}
      {isDustTheme ? (
        <>
          <div className="focus-aurora absolute right-[10%] top-[14%] h-40 w-40 rounded-full blur-2xl pointer-events-none"
            style={{ background: `${styles.horizonGlow}44`, animationDuration: "18s" }}
          />
          <div className="absolute inset-x-0 top-[18%] h-28 opacity-40 pointer-events-none"
            style={{ background: `linear-gradient(180deg, ${styles.horizonGlow}22 0%, transparent 100%)` }}
          />
        </>
      ) : null}
      {isSunTheme ? (
        <div className="absolute left-1/2 top-[12%] h-36 w-36 -translate-x-1/2 rounded-full blur-sm pointer-events-none"
          style={{ background: `radial-gradient(circle, rgba(255,255,255,0.92) 0%, ${styles.horizonGlow}88 30%, transparent 72%)` }}
        />
      ) : null}
      {isPrismTheme ? (
        <div
          className="focus-scanline absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(120deg, transparent 0%, ${styles.lineColor}26 22%, transparent 36%, ${styles.horizonGlow}26 50%, transparent 64%, ${currentZone.color}20 78%, transparent 100%)`,
            mixBlendMode: "screen",
          }}
        />
      ) : null}

      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`${gradientId}-route-base`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={`${styles.roadColor}ee`} />
            <stop offset="100%" stopColor={`${styles.terrainAccent}ee`} />
          </linearGradient>
          <linearGradient id={`${gradientId}-route-line`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={styles.lineColor} />
            <stop offset="50%" stopColor={currentZone.color} />
            <stop offset="100%" stopColor={styles.riderColor} />
          </linearGradient>
          <linearGradient id={`${gradientId}-terrain-back`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={`${styles.terrainAccent}55`} />
            <stop offset="100%" stopColor={`${styles.terrainColor}00`} />
          </linearGradient>
          <linearGradient id={`${gradientId}-terrain-front`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={`${styles.terrainColor}ee`} />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <linearGradient id={`${gradientId}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={`${styles.horizonGlow}44`} />
            <stop offset="100%" stopColor={`${styles.terrainColor}00`} />
          </linearGradient>
          <linearGradient id={`${gradientId}-progress`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={styles.lineColor} />
            <stop offset="100%" stopColor={currentZone.color} />
          </linearGradient>
          <filter id={`${gradientId}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id={`${gradientId}-progress-clip`}>
            <rect x="0" y="0" width={completionWidth} height={height} />
          </clipPath>
        </defs>

        <path d={terrainBack} fill={`url(#${gradientId}-terrain-back)`} />
        <path d={terrainFront} fill={`url(#${gradientId}-terrain-front)`} />

        {Array.from({ length: theme === "anime" ? 4 : 6 }).map((_, index) => {
          const y = horizonY + index * ((height - horizonY) / 7);
          return (
            <line
              key={index}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke={theme === "anime" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)"}
              strokeDasharray={`${Math.max(24, width * 0.02)} ${Math.max(14, width * 0.012)}`}
            />
          );
        })}

        <path d={routeFillPath} fill={`url(#${gradientId}-fill)`} />
        <path
          d={routePath}
          fill="none"
          stroke="rgba(15,23,42,0.9)"
          strokeWidth={routeHalo}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={routePath}
          fill="none"
          stroke={routeBaseStroke}
          strokeWidth={routeStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={routePath}
          fill="none"
          stroke={roadDashStroke}
          strokeWidth={Math.max(2, routeStroke * 0.08)}
          strokeDasharray={`${Math.max(18, width * 0.018)} ${Math.max(12, width * 0.012)}`}
          strokeLinecap="round"
          opacity={styles.routeDashOpacity}
        />
        <path
          d={routePath}
          fill="none"
          stroke={`url(#${gradientId}-progress)`}
          strokeWidth={Math.max(5, routeStroke * 0.33)}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${gradientId}-glow)`}
          clipPath={`url(#${gradientId}-progress-clip)`}
          className="focus-route-sync"
          style={routeSyncStyle}
        />

        {beatMarkers.map((beat, index) => {
          const beatDistance = Math.abs(beat.progress - clampedProgress);
          const isApproaching = beat.progress >= clampedProgress && beatDistance <= 0.12;
          const syncScale = clamp(1.22 - beatDistance * 3.4, 0.94, 1.24);
          const syncOpacity = clamp(1 - beatDistance * 4.6, 0.26, 0.94);
          const syncClass = beat.isActive || isApproaching ? "focus-beat-sync" : theme === "anime" || theme === "rainbow" ? "focus-float" : undefined;

          return (
          <g
            key={`${beat.progress}-${index}`}
            opacity={beat.isPassed ? 0.42 : 1}
            className={syncClass}
            style={
              syncClass === "focus-beat-sync"
                ? ({
                    ["--focus-beat-duration" as string]: `${beatPulseDuration}s`,
                    ["--focus-beat-delay" as string]: `${index * -0.06}s`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  } as CSSProperties)
                : undefined
            }
          >
            <line
              x1={beat.x}
              y1={beat.y + 10}
              x2={beat.x}
              y2={Math.min(routeBottom + 36, beat.y + 78)}
              stroke={beat.color}
              strokeOpacity={beat.isActive ? 0.88 : isApproaching ? syncOpacity : 0.28}
              strokeWidth={beat.isActive ? 2.8 : isApproaching ? 2.1 : 1.5}
            />
            <g transform={`translate(${beat.x} ${beat.y})`}>
              {(beat.isActive || isApproaching) && (
                <circle
                  cx="0"
                  cy="0"
                  r={12 * syncScale}
                  fill={beat.color}
                  fillOpacity={beat.isActive ? 0.18 : 0.1}
                />
              )}
              <BeatGlyph theme={theme} beatType={beat.type} color={beat.color} isActive={beat.isActive} />
            </g>
            <text
              x={beat.x}
              y={beat.y - 16}
              textAnchor="middle"
              fill="rgba(255,255,255,0.84)"
              fontSize={Math.max(10, width * 0.008)}
              fontWeight="700"
              opacity={beat.isActive ? 1 : isApproaching ? syncOpacity : 0.84}
            >
              {beat.label}
            </text>
          </g>
          );
        })}

        <g className="focus-float" transform={`translate(${riderPosition.x} ${riderPosition.y}) rotate(${riderPosition.rotation})`}>
          <circle
            cx="0"
            cy="0"
            r={clamp(20 + stats.cadence * 0.08, 20, 34)}
            fill={currentZone.color}
            fillOpacity="0.16"
            filter={`url(#${gradientId}-glow)`}
            className="focus-pulse"
          />
          <g transform="translate(-16 -16)">
            <rect x="0" y="8" width="32" height="16" rx="8" fill="rgba(15,23,42,0.9)" stroke={styles.riderColor} strokeWidth="1.5" />
            <path d="M6 16 L12 8 L20 8 L26 16" fill="none" stroke={currentZone.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="22" r="5" fill="none" stroke={styles.riderColor} strokeWidth="1.5" />
            <circle cx="22" cy="22" r="5" fill="none" stroke={styles.riderColor} strokeWidth="1.5" />
          </g>
        </g>
      </svg>

      {/* Left Panel - Route Info - Hidden on mobile when collapsed */}
      <div
        className={`absolute max-w-sm hidden md:block ${leftMinimized ? "opacity-0 pointer-events-none" : ""}`}
        id="focus-left-panel"
        style={{ ...getDesktopPanelStyle("focusLeft"), zIndex: Z_LAYERS.widgets }}
        onPointerDown={(event) => handleDragStart(event, "focusLeft")}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <div
          className="rounded-[1.75rem] border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden"
          style={{ background: `linear-gradient(180deg, ${styles.panelColor} 0%, rgba(3,7,18,0.84) 100%)`, boxShadow: `0 24px 80px ${styles.horizonGlow}18` }}
        >
          {/* Header - Always visible */}
          <div className="flex items-center justify-between px-4 py-3 cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-white/55">
              {/* Drag handle grip dots */}
              <span className="text-white/25 text-[10px] leading-none select-none" aria-hidden="true">⠿</span>
              <span>Focus View</span>
              <span className="h-1 w-1 rounded-full bg-white/40" />
              <span>{styles.worldLabel}</span>
            </div>
            <CollapseToggle
              isCollapsed={!leftExpanded}
              onToggle={() => handleToggle('focusLeft')}
              label="Focus View Info"
            />
          </div>
          
          {/* Collapsible Content */}
          {leftExpanded && (
            <div className="px-4 pb-4">
              <div className="text-xl font-semibold text-white">{routeName}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/72">
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
                  {avatar?.name ?? "Rider"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
                  {equipment?.name ?? "Bike"}
                </span>
                <span className="rounded-full border px-3 py-1" style={{ borderColor: `${currentZone.color}66`, color: currentZone.color }}>
                  {currentZone.label}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-white/70">
                <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
                  <div className="uppercase tracking-[0.2em] text-white/35">View</div>
                  <div className="mt-1 text-sm font-semibold text-white">2D Cinema</div>
                </div>
                <div
                  className="rounded-2xl border px-3 py-2"
                  style={{ borderColor: `${phaseAccent}30`, background: `${phaseAccent}14` }}
                >
                  <div className="uppercase tracking-[0.2em] text-white/45">Phase</div>
                  <div className="mt-1 text-sm font-semibold" style={{ color: phaseAccent }}>{phaseLabel}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
                  <div className="uppercase tracking-[0.2em] text-white/35">Target</div>
                  <div className="mt-1 text-sm font-semibold text-white">{tertiaryMetric.value}</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Collapsed preview badge */}
          {!leftExpanded && !leftMinimized && (
            <div className="px-4 pb-3 flex items-center gap-2">
              <span className="text-xs text-white/60">{routeName}</span>
              <span className="text-xs" style={{ color: currentZone.color }}>{currentZone.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Power/Metrics - Hidden on mobile */}
      <div
        className={`absolute flex w-[min(26rem,calc(100%-2rem))] flex-col gap-3 hidden md:flex ${rightMinimized ? "opacity-0 pointer-events-none" : ""}`}
        id="focus-right-panel"
        style={{ ...getDesktopPanelStyle("focusRight"), zIndex: Z_LAYERS.widgets }}
        onPointerDown={(event) => handleDragStart(event, "focusRight")}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <div
          className="rounded-[1.75rem] border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden"
          style={{ background: `linear-gradient(180deg, ${styles.panelColor} 0%, rgba(3,7,18,0.86) 100%)`, boxShadow: `0 24px 80px ${phaseAccent}20` }}
          id="focus-right-panel"
        >
          {/* Header - Always visible */}
          <div className="flex items-center justify-between p-4 pb-2 cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-white/45">
              {/* Drag handle grip dots */}
              <span className="text-white/25 text-[10px] leading-none select-none" aria-hidden="true">⠿</span>
              <span>{primaryMetric.label}</span>
            </div>
            <CollapseToggle
              isCollapsed={!rightExpanded}
              onToggle={() => handleToggle('focusRight')}
              label="Power Metrics"
            />
          </div>
          
          {/* Collapsed preview - show primary metric only */}
          {!rightExpanded && !rightMinimized && (
            <div className="px-4 pb-3">
              <div className="text-2xl font-semibold" style={{ color: phaseAccent }}>{primaryMetric.value}</div>
              <div className="text-xs text-white/55">{primaryMetric.unit}</div>
            </div>
          )}
          
          {/* Expanded content */}
          {rightExpanded && (
            <div className="px-4 pb-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="mt-1 text-3xl font-semibold" style={{ color: phaseAccent }}>{primaryMetric.value}</div>
                  <div className="text-xs text-white/55">{primaryMetric.unit}</div>
                </div>
                <div className="text-right text-xs text-white/68">
                  <div>{secondaryMetric.label}: {secondaryMetric.value} {secondaryMetric.unit}</div>
                  <div>{tertiaryMetric.label}: {tertiaryMetric.value}</div>
                  <div className={powerTrend >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    {powerTrend >= 0 ? "+" : ""}
                    {Math.round(powerTrend)} W trend
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="focus-route-sync h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${clamp(((intervalPhase === "sprint" ? stats.cadence / 120 : displayedPower / Math.max(ftp, 1)) * 100), 0, 100)}%`,
                      background: `linear-gradient(90deg, ${styles.lineColor} 0%, ${phaseAccent} 100%)`,
                      ...routeSyncStyle,
                    }}
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/45">
                <span>Energy Lane</span>
                <span style={{ color: phaseAccent }}>{phaseLabel}</span>
              </div>
            </div>
          )}
        </div>

        {showStreetView && routePreviewCoordinate ? (
          <div
            className="overflow-hidden rounded-[1.75rem] border border-white/10 backdrop-blur-xl shadow-2xl"
            style={{ background: `linear-gradient(180deg, ${styles.panelColor} 0%, rgba(3,7,18,0.88) 100%)` }}
          >
            <StreetViewPreview
              lat={routePreviewCoordinate.lat}
              lng={routePreviewCoordinate.lng}
              width={420}
              height={180}
              className="h-40 w-full rounded-none object-cover"
              alt={`${routeName} street view`}
            />
            <div className="grid grid-cols-3 gap-3 px-4 py-3 text-xs text-white/70">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Grade</div>
                <div className="mt-1 text-sm font-semibold text-white">{currentSlope >= 0 ? "+" : ""}{currentSlope.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Progress</div>
                <div className="mt-1 text-sm font-semibold text-white">{Math.round(clampedProgress * 100)}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Elevation</div>
                <div className="mt-1 text-sm font-semibold text-white">{Math.round(currentCoordinate?.ele ?? routeStartCoordinate?.ele ?? min)} m</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom Panel - Route Progress - More compact on mobile */}
      <div
        className="absolute"
        id="focus-bottom-panel"
        style={{ ...getDesktopPanelStyle("focusBottom"), right: 16, width: "min(calc(100% - 2rem), 76rem)", zIndex: Z_LAYERS.widgets }}
        onPointerDown={(event) => handleDragStart(event, "focusBottom")}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <div
          className="rounded-[1.75rem] border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden"
          style={{ background: `linear-gradient(180deg, ${styles.panelColor} 0%, rgba(3,7,18,0.9) 100%)` }}
        >
          {/* Collapsed state - thin progress bar only */}
          {!bottomExpanded && !bottomMinimized && (
            <div className="p-2">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${clamp(clampedProgress * 100, 0, 100)}%`,
                    background: `linear-gradient(90deg, ${styles.lineColor} 0%, ${currentZone.color} 100%)`,
                  }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <button
                  onClick={() => handleToggle('focusBottom')}
                  className="text-[10px] text-white/40 hover:text-white/60 transition-colors"
                  aria-label="Expand Route Progress"
                >
                  {Math.round(clampedProgress * 100)}%
                </button>
              </div>
            </div>
          )}
          
          {/* Expanded content */}
          {bottomExpanded && (
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-2 cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-white/45">
                  {/* Drag handle grip dots */}
                  <span className="text-white/25 text-[10px] leading-none select-none" aria-hidden="true">⠿</span>
                  <span>Route Progress</span>
                </div>
                <CollapseToggle
                  isCollapsed={false}
                  onToggle={() => handleToggle('focusBottom')}
                  label="Route Progress"
                />
              </div>
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="focus-route-sync h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${clamp(clampedProgress * 100, 0, 100)}%`,
                        background: `linear-gradient(90deg, ${styles.lineColor} 0%, ${currentZone.color} 100%)`,
                        ...routeSyncStyle,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-white/55">
                    <span className="inline-block h-2 w-2 rounded-full focus-pulse" style={{ backgroundColor: currentZone.color }} />
                    <span>{nextBeat ? `${nextBeatDistance}% to ${nextBeat.label}` : "Cruising"}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs text-white/72 md:min-w-[20rem]">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Low</div>
                    <div className="mt-1 text-sm font-semibold text-white">{Math.round(min)} m</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">High</div>
                    <div className="mt-1 text-sm font-semibold text-white">{Math.round(max)} m</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Next Beat</div>
                    <div className="mt-1 text-sm font-semibold text-white">{nextBeat?.label ?? "Cruise"}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop minimized pills */}
      <div className="hidden md:flex absolute right-4 bottom-8 gap-2" style={{ zIndex: Z_LAYERS.widgets + 10 }}>
        {leftMinimized && (
          <button
            onClick={() => {
              handleToggle("focusLeft");
              onTrackWidgetInteraction?.("restore", "focusLeft");
            }}
            className="rounded-full bg-black/70 border border-white/20 px-3 py-1.5 text-xs text-white/80"
          >
            Route
          </button>
        )}
        {rightMinimized && (
          <button
            onClick={() => {
              handleToggle("focusRight");
              onTrackWidgetInteraction?.("restore", "focusRight");
            }}
            className="rounded-full bg-black/70 border border-white/20 px-3 py-1.5 text-xs text-white/80"
          >
            Metrics
          </button>
        )}
        {bottomMinimized && (
          <button
            onClick={() => {
              handleToggle("focusBottom");
              onTrackWidgetInteraction?.("restore", "focusBottom");
            }}
            className="rounded-full bg-black/70 border border-white/20 px-3 py-1.5 text-xs text-white/80"
          >
            Progress
          </button>
        )}
      </div>
    </div>
  );
}
