"use client";

import { RideTopBar } from "./ride-top-bar";
import { RideHUD } from "./ride-hud";
import { RideBottomPanel } from "./ride-bottom-panel";
import type { GhostState } from "@/app/lib/analytics/ghost-service";

interface RideHUDOverlayProps {
  classData: { name: string; instructor: string };
  isPracticeMode: boolean;
  isRiding: boolean;
  isExiting: boolean;
  rideProgress: number;
  isTrainingMode: boolean;
  isGuestMode: boolean;
  useSimulator: boolean;
  bleConnected: boolean;
  walletConnected: boolean;
  rewardMode: string;
  rewardsFormattedReward: string;
  rewardsIsActive: boolean;
  rewardsClearNodeConnected: boolean;
  viewMode: "immersive" | "focus";
  hudMode: "full" | "compact" | "minimal";
  deviceType: "mobile" | "tablet" | "desktop";
  simulatedReward: string;
  telemetry: any;
  telemetryHistory: { power: number[]; cadence: number[]; heartRate: number[] };
  ghostState: GhostState;
  currentInterval: { phase: string; targetRpm?: [number, number] } | null;
  aiLogs: any[];
  aiActive: boolean;
  agentName: string;
  reasonerState: any;
  lastDecision: any;
  thoughtLog: any[];
  isSpeaking: boolean;
  widgetsVisible: boolean;
  widgetsMode: string;
  panelState: any;
  elapsedTime: number;
  connectionHint: string | null;
  telemetryEffort: number;
  telemetryCadence: number;
  workoutPlan: any;
  currentIntervalIndex: number;
  intervalProgress: number;
  intervalRemaining: number;
  rewardsStreamState: any;
  rewardsMode: string;
  orientation: string;
  onSetUseSimulator: (v: boolean) => void;
  onSetRewardMode: (m: any) => void;
  onToggleViewMode: () => void;
  onCycleHudMode: () => void;
  onExitRide: () => void;
  onResetPrefs: () => void;
  onCollapseToggle: () => void;
  isAllCollapsed: boolean;
  onTogglePanel: (key: any) => void;
  onSetWidgetsMode: (m: any) => void;
  onStartRide: () => void;
  onPauseRide: () => void;
  onSetWorkoutPlan: (p: any) => void;
  onSetUseSimulator2: (v: boolean) => void;
  onBleMetrics: (m: any) => void;
  onSimulatorMetrics: (m: any) => void;
  onHaptic: (type: string) => void;
  formatTime: (s: number) => string;
  trackWidgetInteraction: (action: any, panel: any) => void;
  cycleRideWidgetsMode: () => void;
}

export function RideHUDOverlay(props: RideHUDOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <RideTopBar
        className={props.classData.name}
        instructor={props.classData.instructor}
        isPracticeMode={props.isPracticeMode}
        isRiding={props.isRiding}
        isExiting={props.isExiting}
        rideProgress={props.rideProgress}
        isTrainingMode={props.isTrainingMode}
        isGuestMode={props.isGuestMode}
        useSimulator={props.useSimulator}
        bleConnected={props.bleConnected}
        walletConnected={props.walletConnected}
        rewardMode={props.rewardMode as any}
        rewardsFormattedReward={props.rewardsFormattedReward}
        rewardsIsActive={props.rewardsIsActive}
        rewardsClearNodeConnected={props.rewardsClearNodeConnected}
        viewMode={props.viewMode}
        hudMode={props.hudMode}
        deviceType={props.deviceType}
        simulatedReward={props.simulatedReward}
        onSetUseSimulator={props.onSetUseSimulator}
        onSetRewardMode={props.onSetRewardMode}
        onToggleViewMode={props.onToggleViewMode}
        onCycleHudMode={props.onCycleHudMode}
        onExitRide={props.onExitRide}
        onResetPrefs={props.onResetPrefs}
        onCollapseToggle={props.onCollapseToggle}
        isAllCollapsed={props.isAllCollapsed}
      />

      {(!props.isRiding || props.deviceType !== "mobile" || props.widgetsVisible) && (
        <RideHUD
          telemetry={props.telemetry}
          deviceType={props.deviceType}
          orientation={props.orientation as any}
          hudMode={props.hudMode}
          isRiding={props.isRiding}
          rideProgress={props.rideProgress}
          rewardsActive={props.rewardsIsActive}
          rewardsStreamState={props.rewardsStreamState}
          rewardsMode={props.rewardsMode as any}
          intervalPhase={props.currentInterval?.phase ?? null}
          aiLog={props.aiLogs[0]}
          ghostState={props.ghostState}
          multiGhostState={[
            { id: "g1", name: "Vitalik", leadLagTime: -12.4, distanceGap: 45, active: true },
            { id: "g2", name: "Satoshi", leadLagTime: 5.2, distanceGap: -20, active: true },
          ]}
          targetRpm={props.currentInterval?.targetRpm}
        />
      )}

      {props.isRiding && props.viewMode === "immersive" && (
        <button
          onClick={() => {
            props.onHaptic("light");
            props.cycleRideWidgetsMode();
          }}
          className="absolute right-4 bottom-24 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-black/70 backdrop-blur border border-white/20 shadow-lg transition-transform active:scale-95"
          aria-label={
            props.widgetsMode === "expanded"
              ? "Collapse widgets"
              : props.widgetsMode === "collapsed"
                ? "Minimize widgets"
                : "Restore widgets"
          }
        >
          {props.widgetsMode === "expanded" ? (
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
            </svg>
          ) : props.widgetsMode === "collapsed" ? (
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
        isRiding={props.isRiding}
        isStarting={false}
        rideProgress={props.rideProgress}
        elapsedTime={props.elapsedTime}
        hudMode={props.hudMode}
        deviceType={props.deviceType}
        widgetsMode={props.widgetsMode as any}
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
        intervalProgress={props.intervalProgress}
        intervalRemaining={props.intervalRemaining}
        aiActive={props.aiActive}
        agentName={props.agentName}
        reasonerState={props.reasonerState}
        lastDecision={props.lastDecision}
        thoughtLog={props.thoughtLog}
        isSpeaking={props.isSpeaking}
        panelState={props.panelState}
        onTogglePanel={props.onTogglePanel}
        onSetWidgetsMode={props.onSetWidgetsMode}
        onStartRide={props.onStartRide}
        onPauseRide={props.onPauseRide}
        onSetWorkoutPlan={props.onSetWorkoutPlan}
        onSetUseSimulator={props.onSetUseSimulator2}
        onBleMetrics={props.onBleMetrics}
        onSimulatorMetrics={props.onSimulatorMetrics}
        onHaptic={props.onHaptic}
        formatTime={props.formatTime}
      />
    </div>
  );
}