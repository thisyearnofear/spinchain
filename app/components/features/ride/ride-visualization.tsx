"use client";

import { memo, Component, type ReactNode, useMemo } from "react";
import dynamic from "next/dynamic";
import FocusRouteVisualizer from "@/app/components/features/route/focus-route-visualizer";
import type { WorkoutPlan, IntervalPhase } from "@/app/lib/workout-plan";
import { Z_LAYERS } from "@/app/lib/ui/z-layers";
import type { VisualizerTheme } from "@/app/components/features/route/route-visualizer";
import type {
  PanelKey,
  DesktopPanelKey,
  PanelPosition,
  PanelPositions,
  PanelState,
} from "@/app/hooks/ui/use-panel-state";
import type { HapticType } from "@/app/hooks/use-haptic";
import type { StoryBeat } from "@/app/components/features/route/route-visualizer";
import { useCoreMetrics } from "@/app/hooks/ride/use-telemetry-store";

const RouteVisualizerRaw = dynamic(
  () => import("@/app/components/features/route/route-visualizer"),
  { ssr: false },
);

// Memoize to prevent WebGL context thrashing from parent re-renders
const RouteVisualizer = memo(RouteVisualizerRaw);

// ============================================================================
// Session-level WebGL Degradation Tracking
// ============================================================================
//
// After repeated 3D failures within the same browser session, we permanently
// degrade to 2D SVG to avoid the React #185 infinite retry loop. The threshold
// is intentionally low (2 failures) because a WebGL context loss on the first
// attempt strongly suggests a persistent GPU/device limitation.
//
const WEBGL_DEGRADE_KEY = "spinchain:webgl:degraded";
const WEBGL_FAILURE_COUNT_KEY = "spinchain:webgl:failureCount";
const WEBGL_MAX_FAILURES = 2;

function getWebGLFailureCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    return parseInt(
      sessionStorage.getItem(WEBGL_FAILURE_COUNT_KEY) || "0",
      10,
    );
  } catch {
    return 0;
  }
}

function incrementWebGLFailureCount(): number {
  const count = getWebGLFailureCount() + 1;
  try {
    sessionStorage.setItem(WEBGL_FAILURE_COUNT_KEY, String(count));
    if (count >= WEBGL_MAX_FAILURES) {
      sessionStorage.setItem(WEBGL_DEGRADE_KEY, "true");
    }
  } catch {
    // storage unavailable — proceed normally
  }
  return count;
}

function isWebGLPermanentlyDegraded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(WEBGL_DEGRADE_KEY) === "true";
  } catch {
    return false;
  }
}

// ============================================================================
// WebGL Error Boundary — catches 3D rendering failures and degrades to 2D SVG
// ============================================================================
//
// When the WebGL context is lost or R3F throws during rendering, this boundary
// catches the error at the source and renders FocusRouteVisualizer (2D SVG)
// instead of letting the error propagate up through Suspense/error boundaries,
// which causes React #185 ("Looping waitForRootToLoad detected").
//
class WebGLErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const failureCount = incrementWebGLFailureCount();
    console.warn(
      `[WebGLErrorBoundary] 3D renderer failed (attempt ${failureCount}/${WEBGL_MAX_FAILURES}) — degrading to 2D SVG:`,
      error.message,
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface RideVisualizationProps {
  viewMode: "immersive" | "focus";
  deviceType: "mobile" | "tablet" | "desktop";
  isRiding: boolean;
  rideProgress: number;
  elapsedTime: number;
  routeElevationProfile: number[];
  routeCoordinates: { lat: number; lng: number; ele?: number }[];
  currentRouteCoordinate: { lat: number; lng: number; ele?: number } | null;
  classData: {
    name: string;
    route?: { route?: { storyBeats?: StoryBeat[] } } | null;
    metadata?: {
      route: { name?: string };
      rewards?: { threshold?: number };
    } | null;
  };
  workoutPlan: WorkoutPlan | null;
  currentIntervalIndex: number;
  currentInterval: { phase: IntervalPhase } | null;
  intervalProgress: number;
  routeTheme: VisualizerTheme;
  avatarId?: string;
  equipmentId?: string;
  panelState: PanelState;
  panelPositions: PanelPositions;
  onTogglePanel: (key: PanelKey) => void;
  onSetPanelPosition: (key: DesktopPanelKey, pos: PanelPosition) => void;
  onSnapPanel: (key: DesktopPanelKey) => void;
  onTrackWidgetInteraction: (action: "toggle" | "minimize" | "restore" | "drag", panel: PanelKey) => void;
  onExpandOne: (key: PanelKey) => void;
  onHaptic?: (type?: HapticType) => boolean;
  isPracticeMode: boolean;
  recentPowerHistory: number[];
}

// Custom comparator: skip callback/handler props — they're only used on user
// interaction, not for rendering the 3D scene or SVG visualizer.
function vizPropsEqual(prev: RideVisualizationProps, next: RideVisualizationProps) {
  return (
    prev.viewMode === next.viewMode &&
    prev.deviceType === next.deviceType &&
    prev.isRiding === next.isRiding &&
    prev.rideProgress === next.rideProgress &&
    prev.elapsedTime === next.elapsedTime &&
    prev.routeTheme === next.routeTheme &&
    prev.currentIntervalIndex === next.currentIntervalIndex &&
    prev.intervalProgress === next.intervalProgress &&
    prev.isPracticeMode === next.isPracticeMode &&
    prev.routeElevationProfile === next.routeElevationProfile &&
    prev.routeCoordinates === next.routeCoordinates &&
    prev.currentRouteCoordinate === next.currentRouteCoordinate &&
    prev.classData === next.classData &&
    prev.workoutPlan === next.workoutPlan &&
    prev.recentPowerHistory === next.recentPowerHistory &&
    prev.panelState === next.panelState
  );
}

export const RideVisualization = memo(function RideVisualization({
  viewMode,
  deviceType,
  isRiding,
  rideProgress,
  elapsedTime,
  routeElevationProfile,
  routeCoordinates,
  currentRouteCoordinate,
  classData,
  workoutPlan,
  currentIntervalIndex,
  currentInterval,
  intervalProgress,
  routeTheme,
  avatarId,
  equipmentId,
  panelState,
  panelPositions,
  onTogglePanel,
  onSetPanelPosition,
  onSnapPanel,
  onTrackWidgetInteraction,
  onExpandOne,
  onHaptic,
  isPracticeMode,
  recentPowerHistory,
}: RideVisualizationProps) {
  // Subscribe directly to telemetry store — avoids parent re-renders passing telemetry as a prop
  const telemetry = useCoreMetrics();
  const routeProgress = isRiding || rideProgress > 0 ? rideProgress / 100 : 0;
  const visualizerMode: "preview" | "ride" | "finished" =
    rideProgress >= 100 ? "finished" : isRiding || rideProgress > 0 ? "ride" : "preview";

  // If WebGL has failed repeatedly this session, skip 3D entirely
  const permanentlyDegraded = useMemo(() => isWebGLPermanentlyDegraded(), []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const focusFallback = (
    <FocusRouteVisualizer
      elevationProfile={routeElevationProfile}
      storyBeats={(classData.route?.route?.storyBeats ?? []).filter((b): b is StoryBeat => b != null)}
      progress={routeProgress}
      currentPower={telemetry.power}
      recentPower={recentPowerHistory}
      ftp={Math.max(classData?.metadata?.rewards?.threshold ?? 200, 200)}
      theme={routeTheme}
      stats={{
        hr: telemetry.heartRate,
        power: telemetry.power,
        cadence: telemetry.cadence,
      }}
      avatarId={avatarId}
      equipmentId={equipmentId}
      routeName={classData.metadata?.route?.name || classData.name}
      routeStartCoordinate={routeCoordinates[0] ?? null}
      currentCoordinate={currentRouteCoordinate}
      intervalPhase={currentInterval?.phase ?? null}
      className="h-full w-full"
      panelState={panelState}
      panelPositions={panelPositions}
      onTogglePanel={onTogglePanel}
      onSetPanelPosition={onSetPanelPosition}
      onSnapPanel={onSnapPanel}
      onTrackWidgetInteraction={onTrackWidgetInteraction}
      useAccordion={deviceType === "mobile"}
      onExpandOne={onExpandOne}
      onHaptic={deviceType === "mobile" ? onHaptic : undefined}
      showStreetView={!isPracticeMode}
    />
  );

  return (
    <div className="absolute inset-0">
      {viewMode === "focus" || permanentlyDegraded ? (
        focusFallback
      ) : (
        <WebGLErrorBoundary fallback={focusFallback}>
          <RouteVisualizer
            elevationProfile={routeElevationProfile}
            theme={routeTheme}
            storyBeats={(classData.route?.route?.storyBeats ?? []).filter((b): b is StoryBeat => b != null)}
            progress={routeProgress}
            mode={visualizerMode}
            stats={{
              hr: telemetry.heartRate,
              power: telemetry.power,
              cadence: telemetry.cadence,
            }}
            avatarId={avatarId}
            equipmentId={equipmentId}
            quality={deviceType === "mobile" ? "low" : "high"}
            className="h-full w-full"
          />
        </WebGLErrorBoundary>
      )}

      {/* Mini Stats Bar - Mobile: Always visible during ride */}
      {isRiding && deviceType === "mobile" && (
        <div
          className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl px-4 py-2 pointer-events-none"
          style={{ zIndex: Z_LAYERS.widgets + 10 }}
        >
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-white/40">Time</span>
              <span className="text-sm font-bold text-white">{formatTime(elapsedTime)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-white/40">Progress</span>
              <span className="text-sm font-bold text-white">{Math.round(rideProgress)}%</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {telemetry.heartRate > 0 && (
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-white/40">HR</span>
                <span className="text-sm font-bold text-rose-400">{telemetry.heartRate}</span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-white/40">Watts</span>
              <span className="text-sm font-bold text-yellow-400">{telemetry.power}</span>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {(isRiding || rideProgress > 0) && (
        <div className="absolute inset-x-0 bottom-0 h-2 sm:h-3 bg-black/50 flex">
          {workoutPlan ? (
            workoutPlan.intervals.map((interval, i) => {
              const widthPct = (interval.durationSeconds / workoutPlan.totalDuration) * 100;
              const isCurrent = i === currentIntervalIndex;
              const isComplete = i < currentIntervalIndex;
              const phaseColor =
                interval.phase === "sprint" ? "bg-red-500"
                  : interval.phase === "interval" ? "bg-yellow-500"
                  : interval.phase === "warmup" ? "bg-green-500"
                  : interval.phase === "recovery" ? "bg-blue-500"
                  : interval.phase === "cooldown" ? "bg-indigo-400"
                  : "bg-purple-500";
              return (
                <div
                  key={i}
                  className="relative h-full border-r border-black/30 last:border-r-0"
                  style={{ width: `${widthPct}%` }}
                >
                  <div
                    className={`h-full transition-all duration-300 ${phaseColor} ${
                      isComplete ? "opacity-100" : isCurrent ? "opacity-80" : "opacity-20"
                    }`}
                    style={{
                      width: isCurrent ? `${intervalProgress * 100}%` : isComplete ? "100%" : "0%",
                    }}
                  />
                  {isCurrent && (
                    <div
                      className="absolute top-0 right-0 bottom-0 w-0.5 bg-white animate-pulse"
                      style={{ left: `${intervalProgress * 100}%` }}
                    />
                  )}
                </div>
              );
            })
          ) : (
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
              style={{ width: `${rideProgress}%` }}
            />
          )}
        </div>
      )}
    </div>
  );
}, vizPropsEqual);
