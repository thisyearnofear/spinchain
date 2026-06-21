"use client";

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
import { TronRenderer } from "@/app/components/features/renderers/tron-renderer";
import { FocusRenderer } from "@/app/components/features/renderers/focus-renderer";
import type { VisualizationConfig, RenderMode } from "@/app/engines/types";
import { useEffect, useMemo, useState } from "react";
import { probeGpu, getQualitySettings } from "@/app/lib/gpu-probe";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useUIStore } from "@/app/stores/ui-store";

interface RideVisualizationProps {
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
  routeTheme: VisualizerTheme;
  searchParams: URLSearchParams;
  panelState: PanelState;
  panelPositions: PanelPositions;
  onTogglePanel: (key: PanelKey) => void;
  onSetPanelPosition: (key: DesktopPanelKey, pos: PanelPosition) => void;
  onSnapPanel: (key: DesktopPanelKey) => void;
  onTrackWidgetInteraction: (action: "toggle" | "minimize" | "restore" | "drag", panel: PanelKey) => void;
  onExpandOne: (key: PanelKey) => void;
  onHaptic?: (type?: HapticType) => boolean;
  visualizationConfig?: VisualizationConfig;
}

export function RideVisualization({
  routeElevationProfile,
  routeCoordinates,
  currentRouteCoordinate,
  classData,
  workoutPlan,
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
  visualizationConfig,
}: RideVisualizationProps) {
  const viewMode = useUIStore((s) => s.viewMode);
  const deviceType = useUIStore((s) => s.deviceType);
  const isPracticeMode = useUIStore((s) => s.isPracticeMode);

  const isRiding = useRideStore((s) => s.isActive);
  const rideProgress = useRideStore((s) => s.rideProgress);

  const heartRate = useTelemetryStore((s) => s.snapshot.heartRate);
  const power = useTelemetryStore((s) => s.snapshot.power);
  const cadence = useTelemetryStore((s) => s.snapshot.cadence);
  const recentPowerHistory = useTelemetryStore((s) => s.recentPower);

  const rendererStats = useMemo(() => ({ hr: heartRate, power, cadence }), [heartRate, power, cadence]);
  const telemetryForTron = useMemo(() => ({ heartRate, power, cadence }), [heartRate, power, cadence]);

  const currentIntervalIndex = useCoachingStore((s) => s.currentIntervalIndex);
  const currentInterval = useCoachingStore((s) => s.currentInterval);
  const intervalProgress = useCoachingStore((s) => s.intervalProgress);

  const emptyStoryBeats = useMemo(() => [] as StoryBeat[], []);

  const [localRenderConfig, setLocalRenderConfig] = useState<VisualizationConfig | null>(null);

  useEffect(() => {
    const probe = probeGpu();
    const quality = getQualitySettings(probe);
    setLocalRenderConfig({
      mode: probe.recommendedMode,
      canRender3d: probe.recommendedMode === "tron-3d",
      quality,
      gpu: {
        webgl2: probe.webgl2,
        webgpu: probe.webgpu,
        vendor: probe.vendor,
        isLowEnd: probe.isLowEnd,
        canPostProcess: probe.canPostProcess,
      },
      degraded: false,
      lastDegradedAt: null,
    });
  }, []);

  const renderConfig = visualizationConfig ?? localRenderConfig;

  const effectiveMode: RenderMode =
    viewMode === "focus"
      ? "focus-2d"
      : renderConfig?.mode ?? "tron-3d";

  const routeProgress = isRiding || rideProgress > 0 ? rideProgress / 100 : 0;
  const visualizerMode: "preview" | "ride" | "finished" =
    rideProgress >= 100 ? "finished" : isRiding || rideProgress > 0 ? "ride" : "preview";

  return (
    <div className="absolute inset-0">
      {effectiveMode === "focus-2d" ? (
        <FocusRenderer
          elevationProfile={routeElevationProfile}
          storyBeats={classData.route?.route?.storyBeats ?? emptyStoryBeats}
          progress={routeProgress}
          currentPower={power}
          recentPower={recentPowerHistory}
          ftp={Math.max(classData?.metadata?.rewards?.threshold ?? 200, 200)}
          theme={routeTheme}
          stats={rendererStats}
          avatarId={searchParams.get("avatarId") || undefined}
          equipmentId={searchParams.get("equipmentId") || undefined}
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
      ) : (
        <TronRenderer
          mode={visualizerMode}
          progress={routeProgress}
          routeElevationProfile={routeElevationProfile}
          routeCoordinates={routeCoordinates}
          currentRouteCoordinate={currentRouteCoordinate}
          telemetry={telemetryForTron}
          routeTheme={routeTheme}
          storyBeats={classData.route?.route?.storyBeats ?? emptyStoryBeats}
          avatarId={searchParams.get("avatarId") || undefined}
          equipmentId={searchParams.get("equipmentId") || undefined}
          quality={renderConfig?.gpu.isLowEnd ? "low" : deviceType === "mobile" ? "low" : "high"}
          className="h-full w-full"
          userDisplayName={undefined}
        />
      )}

      {/* Route progress bar — always visible, tall enough to see clearly */}
      <div className="absolute inset-x-0 bottom-0 h-2.5 sm:h-4 bg-black/80 border-t border-white/15 flex z-20">
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
                className="relative h-full border-r border-white/10 last:border-r-0"
                style={{ width: `${widthPct}%` }}
              >
                <div
                  className={`h-full transition-transform duration-300 origin-left ${phaseColor} ${
                    isComplete ? "opacity-90" : isCurrent ? "opacity-70" : "opacity-15"
                  }`}
                  style={{
                    transform: `scaleX(${isCurrent ? intervalProgress : isComplete ? 1 : 0})`,
                  }}
                />
                {isCurrent && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                    style={{ left: `${intervalProgress * 100}%` }}
                  />
                )}
              </div>
            );
          })
        ) : (
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-transform duration-300 origin-left"
            style={{ transform: `scaleX(${rideProgress / 100})` }}
          />
        )}
      </div>
    </div>
  );
}
