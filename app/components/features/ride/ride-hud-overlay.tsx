"use client";

import { useEffect } from "react";
import { RideTopBar } from "./ride-top-bar";
import { RideHUD } from "./ride-hud";
import { RideBottomPanel } from "./ride-bottom-panel";
import { RideFocusControl } from "./ride-focus-control";
import { useRideFocusAdapter, useRideFocusVisibility } from "@/app/hooks/ui/use-ride-focus-adapter";
import { useRideFocusKeyboard } from "@/app/hooks/ui/use-ride-focus-mode";
import type { GhostState } from "@/app/lib/analytics/ghost-service";
import type { IntervalPhase, WorkoutPlan } from "@/app/lib/workout-plan";
import type { PanelKey, PanelState } from "@/app/hooks/ui/use-panel-state";
import type { RewardMode, RewardStreamState } from "@/app/hooks/rewards/use-rewards";
import type { HapticType } from "@/app/hooks/use-haptic";
import type { TelemetryData } from "./ride-hud";
import type { AgentDecision } from "@/app/lib/ai-types";
import type { MultiGhostState } from "@/app/hooks/ride/use-multi-ghost";

interface RideHUDOverlayProps {
  classData: { name: string; instructor: string };
  isPracticeMode: boolean;
  routeIsGenerated?: boolean;
  isRiding: boolean;
  isExiting: boolean;
  rideProgress: number;
  isTrainingMode: boolean;
  isGuestMode: boolean;
  useSimulator: boolean;
  bleConnected: boolean;
  walletConnected: boolean;
  rewardMode: RewardMode;
  rewardsFormattedReward: string;
  rewardsIsActive: boolean;
  rewardsClearNodeConnected?: boolean;
  deviceType: "mobile" | "tablet" | "desktop";
  simulatedReward: { isSimulating: boolean; formattedReward: string };
  telemetryHistory: { power: number[]; cadence: number[]; heartRate: number[] };
  ghostState: GhostState;
  multiGhostState: MultiGhostState[];
  currentInterval: {
    phase: IntervalPhase;
    durationSeconds: number;
    coachCue?: string;
    targetRpm?: [number, number];
  } | null;
  aiLogs: Array<{ timestamp: number; message: string; type: "info" | "action" | "alert" }>;
  aiActive: boolean;
  agentName: string;
  reasonerState: string;
  lastDecision: AgentDecision | null;
  thoughtLog: string[];
  isSpeaking: boolean;
  widgetsVisible: boolean;
  panelState: PanelState;
  elapsedTime: number;
  connectionHint: string | null;
  telemetryEffort: number;
  telemetryCadence: number;
  workoutPlan: WorkoutPlan | null;
  currentIntervalIndex: number;
  intervalProgress: number;
  intervalRemaining: number;
  rewardsStreamState: RewardStreamState | null;
  rewardsMode: RewardMode;
  orientation: "portrait" | "landscape";
  onSetUseSimulator: (v: boolean) => void;
  onSetRewardMode: (m: RewardMode) => void;
  onExitRide: () => void;
  onResetPrefs: () => void;
  onCollapseToggle: () => void;
  isAllCollapsed: boolean;
  onTogglePanel: (key: PanelKey) => void;
  onStartRide: () => void;
  onPauseRide: () => void;
  onSetWorkoutPlan: (p: WorkoutPlan | null) => void;
  onSetUseSimulator2: (v: boolean) => void;
  onBleMetrics: (m: Partial<TelemetryData>) => void;
  onSimulatorMetrics: (m: {
    heartRate: number;
    power: number;
    cadence: number;
    speed: number;
    effort: number;
    distance?: number;
    timestamp?: number;
  }) => void;
  onHaptic: (type?: HapticType) => boolean;
  formatTime: (s: number) => string;
  trackWidgetInteraction: (action: "toggle" | "minimize" | "restore" | "drag", panel: PanelKey) => void;
  cycleRideWidgetsMode: () => void;
  socialRiders: MultiGhostState[];
}

export function RideHUDOverlay(props: RideHUDOverlayProps) {
  // Integrate unified focus mode system
  const focusAdapter = useRideFocusAdapter(props.deviceType);
  const visibility = useRideFocusVisibility();
  const keyboardHandler = useRideFocusKeyboard();
  
  // Setup keyboard shortcuts (Z, H, I, A, G)
  useEffect(() => {
    if (!props.isRiding) return;
    window.addEventListener("keydown", keyboardHandler);
    return () => window.removeEventListener("keydown", keyboardHandler);
  }, [props.isRiding, keyboardHandler]);
  
  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Top bar - controlled by focus mode */}
      {visibility.showTopBar && (
        <RideTopBar
          className={props.classData.name}
          instructor={props.classData.instructor}
          isPracticeMode={props.isPracticeMode}
          routeIsGenerated={props.routeIsGenerated}
          isRiding={props.isRiding}
          isExiting={props.isExiting}
          rideProgress={props.rideProgress}
          isTrainingMode={props.isTrainingMode}
          isGuestMode={props.isGuestMode}
          useSimulator={props.useSimulator}
          bleConnected={props.bleConnected}
          walletConnected={props.walletConnected}
          rewardMode={props.rewardMode}
          rewardsFormattedReward={props.rewardsFormattedReward}
          rewardsIsActive={props.rewardsIsActive}
          rewardsClearNodeConnected={props.rewardsClearNodeConnected}
          viewMode={focusAdapter.viewMode}
          hudMode={focusAdapter.hudMode}
          simulatedReward={props.simulatedReward}
          onSetUseSimulator={props.onSetUseSimulator}
          onSetRewardMode={props.onSetRewardMode}
          onExitRide={props.onExitRide}
          onResetPrefs={props.onResetPrefs}
          onCollapseToggle={props.onCollapseToggle}
          isAllCollapsed={props.isAllCollapsed}
          showClassInfo={visibility.showClassInfo}
        />
      )}

        {/* Center HUD - controlled by focus mode */}
        {visibility.showCenterMetrics && (!props.isRiding || props.deviceType !== "mobile" || props.widgetsVisible) && (
          <RideHUD
            deviceType={props.deviceType}
            orientation={props.orientation}
            hudMode={focusAdapter.hudMode}
            isRiding={props.isRiding}
            rideProgress={props.rideProgress}
            rewardsActive={props.rewardsIsActive}
            rewardsStreamState={props.rewardsStreamState}
            rewardsMode={props.rewardsMode}
            intervalPhase={props.currentInterval?.phase ?? null}
            aiLog={props.aiLogs[0]}
            ghostState={visibility.showGhostPacer ? props.ghostState : undefined}
            multiGhostState={visibility.showGhostPacer ? props.multiGhostState : []}
            targetRpm={props.currentInterval?.targetRpm}
            showBottomPanel={visibility.showBottomPanel}
          />
        )}

      {/* Unified focus control - replaces the cryptic FAB */}
      {props.isRiding && (
        <RideFocusControl 
          position="bottom-right" 
          size="md"
          onHaptic={props.onHaptic}
        />
      )}

      {/* Bottom panel - controlled by focus mode */}
      {visibility.showBottomPanel && (
        <RideBottomPanel
          isRiding={props.isRiding}
          isStarting={false}
          rideProgress={props.rideProgress}
          elapsedTime={props.elapsedTime}
          hudMode={focusAdapter.hudMode}
          deviceType={props.deviceType}
          widgetsMode={focusAdapter.widgetsMode}
          useSimulator={props.useSimulator}
          isPracticeMode={props.isPracticeMode}
          isTrainingMode={props.isTrainingMode}
          bleConnected={props.bleConnected}
          walletConnected={props.walletConnected}
          connectionHint={props.connectionHint}
          telemetryEffort={props.telemetryEffort}
          telemetryCadence={props.telemetryCadence}
          workoutPlan={props.workoutPlan}
          currentInterval={props.currentInterval}
          currentIntervalIndex={props.currentIntervalIndex}
          intervalRemaining={props.intervalRemaining}
          aiActive={props.aiActive}
          agentName={props.agentName}
          reasonerState={props.reasonerState}
          lastDecision={props.lastDecision}
          thoughtLog={props.thoughtLog}
          isSpeaking={props.isSpeaking}
          panelState={props.panelState}
          onTogglePanel={props.onTogglePanel}
          onStartRide={props.onStartRide}
          onPauseRide={props.onPauseRide}
          onSetWorkoutPlan={props.onSetWorkoutPlan}
          onSetUseSimulator={props.onSetUseSimulator2}
          onBleMetrics={props.onBleMetrics}
          onSimulatorMetrics={props.onSimulatorMetrics}
          onHaptic={props.onHaptic}
          formatTime={props.formatTime}
          showIntervalBanner={visibility.showIntervalBanner}
          showAiCoach={visibility.showAiCoach}
        />
      )}
    </div>
  );
}
