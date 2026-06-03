"use client";

import { memo } from "react";
import { RideTopBar } from "./ride-top-bar";
import { RideHUD } from "./ride-hud";
import { RideBottomPanel } from "./ride-bottom-panel";
import type { WorkoutPlan } from "@/app/lib/workout-plan";
import type { PanelKey, PanelState, WidgetMode } from "@/app/hooks/ui/use-panel-state";
import type { RewardMode } from "@/app/hooks/rewards/use-rewards";
import type { HapticType } from "@/app/hooks/use-haptic";
import { useRideStore } from "@/app/stores/ride-store";
import { useRewardsStore } from "@/app/stores/rewards-store";
import { useUIStore } from "@/app/stores/ui-store";

interface RideHUDOverlayProps {
  classData: { name: string; instructor: string };
  routeIsGenerated?: boolean;
  walletConnected: boolean;
  workoutPlan: WorkoutPlan | null;
  connectionHint: string | null;
  simulatedReward: { isSimulating: boolean; formattedReward: string };
  panelState: PanelState;
  rewardMode: RewardMode;
  onSetUseSimulator: (v: boolean) => void;
  onSetRewardMode: (m: RewardMode) => void;
  onExitRide: () => void;
  onResetPrefs: () => void;
  onCollapseToggle: () => void;
  isAllCollapsed: boolean;
  onTogglePanel: (key: PanelKey) => void;
  onSetWidgetsMode: (m: WidgetMode) => void;
  onStartRide: () => void;
  onPauseRide: () => void;
  onSetWorkoutPlan: (p: WorkoutPlan | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onBleMetrics: (m: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSimulatorMetrics: (m: any) => void;
  onHaptic: (type?: HapticType) => boolean;
  formatTime: (s: number) => string;
}

export const RideHUDOverlay = memo(function RideHUDOverlay(props: RideHUDOverlayProps) {
  const isRiding = useRideStore((s) => s.isActive);
  const deviceType = useUIStore((s) => s.deviceType);
  const widgetsMode = useUIStore((s) => s.widgetsMode);
  const viewMode = useUIStore((s) => s.viewMode);

  const cycleWidgetsMode = useUIStore((s) => s.cycleWidgetsMode);

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <RideTopBar
        className={props.classData.name}
        instructor={props.classData.instructor}
        routeIsGenerated={props.routeIsGenerated}
        walletConnected={props.walletConnected}
        simulatedReward={props.simulatedReward}
        onSetUseSimulator={props.onSetUseSimulator}
        onSetRewardMode={props.onSetRewardMode}
        onExitRide={props.onExitRide}
        onResetPrefs={props.onResetPrefs}
        onCollapseToggle={props.onCollapseToggle}
        isAllCollapsed={props.isAllCollapsed}
      />

      {(!isRiding || deviceType !== "mobile" || true) && (
        <RideHUD />
      )}

      {isRiding && viewMode === "immersive" && (
        <button
          onClick={() => {
            props.onHaptic("light");
            cycleWidgetsMode();
          }}
          className="absolute right-4 bottom-24 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-black/70 backdrop-blur border border-white/20 shadow-lg transition-transform active:scale-95"
          aria-label={
            widgetsMode === "expanded"
              ? "Collapse widgets"
              : widgetsMode === "collapsed"
                ? "Minimize widgets"
                : "Restore widgets"
          }
        >
          {widgetsMode === "expanded" ? (
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
            </svg>
          ) : widgetsMode === "collapsed" ? (
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      )}

      <RideBottomPanel
        walletConnected={props.walletConnected}
        workoutPlan={props.workoutPlan}
        connectionHint={props.connectionHint}
        panelState={props.panelState}
        onTogglePanel={props.onTogglePanel}
        onSetWidgetsMode={props.onSetWidgetsMode}
        onStartRide={props.onStartRide}
        onPauseRide={props.onPauseRide}
        onSetWorkoutPlan={props.onSetWorkoutPlan}
        onSetUseSimulator={props.onSetUseSimulator}
        onBleMetrics={props.onBleMetrics}
        onSimulatorMetrics={props.onSimulatorMetrics}
        onHaptic={props.onHaptic}
        formatTime={props.formatTime}
      />
    </div>
  );
});
