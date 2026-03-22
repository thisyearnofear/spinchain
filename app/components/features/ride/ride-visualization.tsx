"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import FocusRouteVisualizer from "@/app/components/features/route/focus-route-visualizer";
import type { WorkoutPlan } from "@/app/lib/workout-plan";
import type { GhostState } from "@/app/lib/analytics/ghost-service";
import { Z_LAYERS } from "@/app/lib/ui/z-layers";

const RouteVisualizer = dynamic(
  () => import("@/app/components/features/route/route-visualizer"),
  { ssr: false },
);

interface RideVisualizationProps {
  viewMode: "immersive" | "focus";
  deviceType: "mobile" | "tablet" | "desktop";
  isRiding: boolean;
  rideProgress: number;
  elapsedTime: number;
  telemetry: {
    heartRate: number;
    power: number;
    cadence: number;
  };
  routeElevationProfile: number[];
  routeCoordinates: { lat: number; lng: number; ele?: number }[];
  currentRouteCoordinate: { lat: number; lng: number; ele?: number } | null;
  classData: {
    name: string;
    metadata?: {
      route: { name?: string };
      rewards?: { threshold?: number };
    };
  };
  workoutPlan: WorkoutPlan | null;
  currentIntervalIndex: number;
  currentInterval: { phase: string } | null;
  intervalProgress: number;
  routeTheme: string;
  searchParams: URLSearchParams;
  panelState: any;
  panelPositions: any;
  onTogglePanel: (key: any) => void;
  onSetPanelPosition: (key: string, pos: any) => void;
  onSnapPanel: (key: string) => void;
  onTrackWidgetInteraction: (action: any, panel: any) => void;
  onExpandOne: (key: string) => void;
  onHaptic?: (type: string) => void;
  isPracticeMode: boolean;
  recentPowerHistory: number[];
}

export function RideVisualization({
  viewMode,
  deviceType,
  isRiding,
  rideProgress,
  elapsedTime,
  telemetry,
  routeElevationProfile,
  routeCoordinates,
  currentRouteCoordinate,
  classData,
  workoutPlan,
  currentIntervalIndex,
  currentInterval,
  intervalProgress,
  routeTheme,
  searchParams,
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
  const routeProgress = isRiding || rideProgress > 0 ? rideProgress / 100 : 0;
  const visualizerMode: "preview" | "ride" | "finished" =
    rideProgress >= 100 ? "finished" : isRiding || rideProgress > 0 ? "ride" : "preview";

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute inset-0">
      {viewMode === "focus" ? (
        <FocusRouteVisualizer
          elevationProfile={routeElevationProfile}
          storyBeats={(classData as any)?.route?.route?.storyBeats ?? []}
          progress={routeProgress}
          currentPower={telemetry.power}
          recentPower={recentPowerHistory}
          ftp={Math.max(classData?.metadata?.rewards?.threshold ?? 200, 200)}
          theme={routeTheme as any}
          stats={{
            hr: telemetry.heartRate,
            power: telemetry.power,
            cadence: telemetry.cadence,
          }}
          avatarId={searchParams.get("avatarId") || undefined}
          equipmentId={searchParams.get("equipmentId") || undefined}
          routeName={classData.metadata?.route?.name || classData.name}
          routeStartCoordinate={routeCoordinates[0] ?? null}
          currentCoordinate={currentRouteCoordinate}
          intervalPhase={(currentInterval?.phase as any) ?? null}
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
      ) : (
        <RouteVisualizer
          elevationProfile={routeElevationProfile}
          theme={routeTheme}
          storyBeats={(classData as any)?.route?.route?.storyBeats ?? []}
          progress={routeProgress}
          mode={visualizerMode}
          stats={{
            hr: telemetry.heartRate,
            power: telemetry.power,
            cadence: telemetry.cadence,
          }}
          avatarId={searchParams.get("avatarId") || undefined}
          equipmentId={searchParams.get("equipmentId") || undefined}
          quality={deviceType === "mobile" ? "low" : "high"}
          className="h-full w-full"
        />
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
}