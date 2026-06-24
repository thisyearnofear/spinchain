"use client";

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

  const currentInterval = useCoachingStore((s) => s.currentInterval);

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

    </div>
  );
}
