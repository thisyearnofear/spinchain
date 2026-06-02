"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import type { VisualizerTheme } from "@/app/components/features/route/visualizer-theme";
import type { StoryBeat } from "@/app/routes/builder/gpx-uploader";
import type { IntervalPhase } from "@/app/lib/workout-plan";
import type { PanelState, PanelKey, PanelPositions, DesktopPanelKey } from "@/app/hooks/ui/use-panel-state";
import type { HapticType } from "@/app/hooks/use-haptic";

const FocusRouteVisualizer = dynamic(
  () => import("@/app/components/features/route/focus-route-visualizer"),
  { ssr: false },
);

export interface FocusRendererProps {
  elevationProfile: number[];
  storyBeats: StoryBeat[];
  progress: number;
  currentPower: number;
  recentPower: number[];
  ftp: number;
  theme: VisualizerTheme;
  stats: { hr: number; power: number; cadence: number };
  avatarId?: string;
  equipmentId?: string;
  routeName: string;
  routeStartCoordinate: { lat: number; lng: number; ele?: number } | null;
  currentCoordinate: { lat: number; lng: number; ele?: number } | null;
  intervalPhase: IntervalPhase | null;
  className?: string;
  panelState: PanelState;
  panelPositions: PanelPositions;
  onTogglePanel: (key: PanelKey) => void;
  onSetPanelPosition: (key: DesktopPanelKey, pos: { x: number; y: number }) => void;
  onSnapPanel: (key: DesktopPanelKey) => void;
  onTrackWidgetInteraction: (action: "toggle" | "minimize" | "restore" | "drag", panel: PanelKey) => void;
  onExpandOne: (key: PanelKey) => void;
  onHaptic?: (type?: HapticType) => boolean;
  useAccordion: boolean;
  showStreetView: boolean;
}

/**
 * FocusRenderer — 2D SVG-backed route visualizer.
 *
 * Thin adapter around the existing FocusRouteVisualizer component.
 * Provides a consistent interface alongside TronRenderer so the
 * VisualizationEngine can dispatch to either seamlessly.
 */
export function FocusRenderer(props: FocusRendererProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
            <span className="text-xs font-mono text-white/40 uppercase tracking-widest">
              Loading Focus View...
            </span>
          </div>
        </div>
      }
    >
      <FocusRouteVisualizer
        elevationProfile={props.elevationProfile}
        storyBeats={props.storyBeats}
        progress={props.progress}
        currentPower={props.currentPower}
        recentPower={props.recentPower}
        ftp={props.ftp}
        theme={props.theme}
        stats={props.stats}
        avatarId={props.avatarId}
        equipmentId={props.equipmentId}
        routeName={props.routeName}
        routeStartCoordinate={props.routeStartCoordinate}
        currentCoordinate={props.currentCoordinate}
        intervalPhase={props.intervalPhase}
        className={props.className}
        panelState={props.panelState}
        panelPositions={props.panelPositions}
        onTogglePanel={props.onTogglePanel}
        onSetPanelPosition={props.onSetPanelPosition}
        onSnapPanel={props.onSnapPanel}
        onTrackWidgetInteraction={props.onTrackWidgetInteraction}
        onExpandOne={props.onExpandOne}
        onHaptic={props.onHaptic}
        useAccordion={props.useAccordion}
        showStreetView={props.showStreetView}
      />
    </Suspense>
  );
}
