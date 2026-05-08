"use client";

/**
 * RideScene — 3D visualization, flow background, performance graphs, social presence.
 * Subscribes to ride store for isRiding, rideProgress, viewMode, flowIntensity.
 * Subscribes to telemetry store for real-time metrics.
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { useRideStore } from "@/app/stores/ride-store";
import { SectionErrorBoundary } from "@/app/components/layout/error-boundary";
import { RideVisualization } from "@/app/components/features/ride/ride-visualization";
import { FlowBackground } from "@/app/components/features/ride/flow-background";
import { PerformanceGraph } from "@/app/components/features/ride/performance-graph";
import type { GhostState } from "@/app/lib/analytics/ghost-service";
import type { MultiGhostState } from "@/app/hooks/ride/use-multi-ghost";
import type { WorkoutPlan, IntervalPhase } from "@/app/lib/workout-plan";
import type { VisualizerTheme } from "@/app/components/features/route/route-visualizer";
import type { StoryBeat } from "@/app/components/features/route/route-visualizer";
import type {
  PanelKey,
  PanelState,
  PanelPositions,
  PanelPosition,
  DesktopPanelKey,
} from "@/app/hooks/ui/use-panel-state";
import type { HapticType } from "@/app/hooks/use-haptic";

interface RideSceneProps {
  classId: string;
  classData: {
    name: string;
    instructor: string;
    route?: { route?: { storyBeats?: StoryBeat[] } } | null;
    metadata?: {
      route: { name?: string };
      rewards?: { threshold?: number };
    } | null;
  };
  isPracticeMode: boolean;
  routeCoordinates: { lat: number; lng: number; ele?: number }[];
  routeElevationProfile: number[];
  currentRouteCoordinate: { lat: number; lng: number; ele?: number } | null;
  routeTheme: VisualizerTheme;
  currentInterval: { phase: IntervalPhase } | null;
  currentIntervalIndex: number;
  intervalProgress: number;
  workoutPlan: WorkoutPlan | null;
  avatarId?: string;
  equipmentId?: string;
  panelState: {
    state: PanelState;
    positions: PanelPositions;
    toggle: (key: PanelKey) => void;
    expandOne: (key: PanelKey) => void;
    setPanelPosition: (key: DesktopPanelKey, pos: PanelPosition) => void;
    snapPanelToEdge: (
      key: DesktopPanelKey,
      viewport: { width: number; height: number },
    ) => void;
  };
  haptic: { trigger: (type?: HapticType) => boolean };
  recentPowerHistory: number[];
  telemetryHistory: { power: number[]; cadence: number[]; heartRate: number[] };
  multiGhostState: MultiGhostState[];
  ghostState: GhostState;
}

export const RideScene = memo(function RideScene({
  classId: _classId,
  classData,
  isPracticeMode,
  routeCoordinates,
  routeElevationProfile,
  currentRouteCoordinate,
  routeTheme,
  currentInterval,
  currentIntervalIndex,
  intervalProgress,
  workoutPlan,
  avatarId,
  equipmentId,
  panelState,
  haptic,
  recentPowerHistory,
  telemetryHistory,
  multiGhostState,
  ghostState: _ghostState,
}: RideSceneProps) {
  // Subscribe to ride store — only re-renders when these values change
  const isRiding = useRideStore((s) => s.isRiding);
  const rideProgress = useRideStore((s) => s.rideProgress);
  const elapsedTime = useRideStore((s) => s.elapsedTime);
  const viewMode = useRideStore((s) => s.viewMode);
  const flowIntensity = useRideStore((s) => s.flowIntensity);
  const deviceType = useRideStore(() => "desktop" as "desktop"); // TODO: from responsive hook

  const flowColor =
    currentInterval?.phase === "sprint"
      ? "bg-rose-500"
      : currentInterval?.phase === "recovery"
        ? "bg-sky-500"
        : "bg-yellow-500";

  const handleTogglePanel = (key: PanelKey) => {
    panelState.toggle(key);
  };

  const handleSnapPanel = (key: DesktopPanelKey) => {
    panelState.snapPanelToEdge(key, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };

  return (
    <>
      <SectionErrorBoundary title="ride visualization">
        <RideVisualization
          viewMode={viewMode}
          deviceType={deviceType}
          isRiding={isRiding}
          rideProgress={rideProgress}
          elapsedTime={elapsedTime}
          routeElevationProfile={routeElevationProfile}
          routeCoordinates={routeCoordinates}
          currentRouteCoordinate={currentRouteCoordinate}
          classData={classData}
          workoutPlan={workoutPlan}
          currentIntervalIndex={currentIntervalIndex}
          currentInterval={currentInterval}
          intervalProgress={intervalProgress}
          routeTheme={routeTheme}
          avatarId={avatarId}
          equipmentId={equipmentId}
          panelState={panelState.state}
          panelPositions={panelState.positions}
          onTogglePanel={handleTogglePanel}
          onSetPanelPosition={panelState.setPanelPosition}
          onSnapPanel={handleSnapPanel}
          onTrackWidgetInteraction={() => {}}
          onExpandOne={panelState.expandOne}
          onHaptic={haptic.trigger}
          isPracticeMode={isPracticeMode}
          recentPowerHistory={recentPowerHistory}
        />
      </SectionErrorBoundary>

      {/* Performance Trends (Immersive only) */}
      {isRiding && viewMode === "immersive" && (
        <div className="fixed top-32 right-6 z-40 flex flex-col gap-4">
          <PerformanceGraph
            data={telemetryHistory.power}
            color="text-yellow-400"
            label="Power"
            max={400}
          />
          <PerformanceGraph
            data={telemetryHistory.cadence}
            color="text-blue-400"
            label="Cadence"
            max={140}
          />
        </div>
      )}

      {/* Social Presence: Other riders in the class */}
      {isRiding && viewMode === "immersive" && multiGhostState.length > 0 && (
        <div className="fixed top-32 left-6 z-40 flex flex-col gap-3">
          {multiGhostState.map((rider) => (
            <motion.div
              key={rider.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full pl-1.5 pr-4 py-1.5"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[10px] font-black text-indigo-300">
                  {rider.name.substring(0, 2).toUpperCase()}
                </div>
                {rider.active && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-black animate-pulse" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white/80 leading-none">
                  {rider.name}
                </span>
                <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest mt-0.5">
                  {rider.power}W | {rider.leadLagTime > 0 ? "+" : ""}
                  {rider.leadLagTime.toFixed(1)}s
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <FlowBackground
        intensity={flowIntensity}
        color={flowColor}
        isRiding={isRiding && viewMode === "immersive"}
      />
    </>
  );
});
