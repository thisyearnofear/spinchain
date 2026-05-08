"use client";

import { useRef } from "react";

/**
 * RideControls — HUD overlay, modals, loading/not-found states.
 * Subscribes to ride store for lifecycle state, connection, UI modals.
 * Renders RideHUDOverlay and RideModals with data from store + props.
 */

import { useRideStore } from "@/app/stores/ride-store";
import { RideLoading, RideNotFound } from "@/app/components/features/ride/ride-loading";
import { RideGestureZone } from "@/app/components/features/ride/ride-gesture-zone";
import { RideHUDOverlay } from "@/app/components/features/ride/ride-hud-overlay";
import { RideModals } from "@/app/components/features/ride/ride-modals";
import { NetworkStatusBanner } from "@/app/components/features/common/yellow-status-indicator";
import type { RewardMode, RewardStreamState } from "@/app/hooks/rewards/use-rewards";
import type { RewardClaimStatus } from "@/app/components/features/ride/ride-completion";
import type { RideSyncStatus } from "@/app/lib/analytics/ride-history";
import type { GhostState } from "@/app/lib/analytics/ghost-service";
import type { MultiGhostState } from "@/app/hooks/ride/use-multi-ghost";
import type { WorkoutPlan, IntervalPhase } from "@/app/lib/workout-plan";
import type { PanelKey, PanelState } from "@/app/hooks/ui/use-panel-state";
import type { HapticType } from "@/app/hooks/use-haptic";
import type { AgentDecision } from "@/app/lib/ai-types";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { TelemetryData } from "@/app/components/features/ride/ride-hud";
import type { RideRecordPoint } from "@/app/lib/analytics/ride-recorder";

interface RideControlsProps {
  // Core
  classId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  classData?: any;
  isPracticeMode: boolean;
  practiceConfig?: { name?: string; instructor?: string; aiEnabled?: boolean } | null;
  rewardMode: RewardMode;
  deviceType?: "mobile" | "tablet" | "desktop";
  orientation?: "portrait" | "landscape";
  viewportHeight?: number;
  performanceTier?: "high" | "medium" | "low";
  isLoading?: boolean;
  isNotFound?: boolean;
  router?: AppRouterInstance;

  // Panel
  panelState?: {
    state: PanelState;
    toggle: (key: PanelKey) => void;
    expandOne: (key: PanelKey) => void;
    expandAll: () => void;
    collapseAll: () => void;
    isAllCollapsed: boolean;
    setMobileRideWidgetsMode: (mode: "expanded" | "collapsed" | "minimized") => void;
    resetLayout: () => void;
  };

  // Wallet
  walletConnected?: boolean;
  address?: string;

  // Haptic
  haptic?: { trigger: (type?: HapticType) => boolean };

  // Rewards
  rewards?: {
    formattedReward: string;
    isActive: boolean;
    clearNodeConnected?: boolean;
    streamState?: RewardStreamState;
    mode: RewardMode;
    accumulatedReward: bigint;
    streamingRate?: bigint;
  };
  simulatedRewards?: { isSimulating: boolean; formattedReward: string };

  // Telemetry
  telemetryHistory?: { power: number[]; cadence: number[]; heartRate: number[] };
  ghostState?: GhostState;
  multiGhostState?: MultiGhostState[];

  // AI
  currentInterval?: {
    phase: IntervalPhase;
    durationSeconds: number;
    coachCue?: string;
    targetRpm?: [number, number];
  } | null;
  aiLogs?: Array<{ timestamp: number; message: string; type: "info" | "action" | "alert" }>;
  aiActive?: boolean;
  agentName?: string;
  reasonerState?: string;
  lastDecision?: AgentDecision | null;
  thoughtLog?: string[];
  isSpeaking?: boolean;

  // Workout
  workoutPlan?: WorkoutPlan | null;
  currentIntervalIndex?: number;
  intervalProgress?: number;
  intervalRemaining?: number;

  // Tutorial
  showTutorial?: boolean;
  tutorialStep?: number;

  // Reward claim
  rewardClaimStatus?: RewardClaimStatus;
  telemetryAverages?: { avgHr: number; avgPower: number; avgEffort: number };
  telemetrySamples?: { current: { hr: number; power: number; effort: number }[] };
  ridePointsRef?: { current: RideRecordPoint[] };
  useChainlinkRewards?: boolean;
  chainlinkSuccess?: boolean;
  zkSuccess?: boolean;
  privacyScore?: number;
  privacyLevel?: string;
  isTrainingMode?: boolean;
  isGuestMode?: boolean;

  // Callbacks
  onStartRide?: () => void;
  onPauseRide?: () => void;
  onTogglePauseResume?: () => void;
  onExitRide?: () => void;
  onClaimRewards?: () => void;
  onBleMetrics?: (m: Partial<TelemetryData>) => void;
  onSimulatorMetrics?: (m: {
    heartRate: number;
    power: number;
    cadence: number;
    speed: number;
    effort: number;
    distance?: number;
    timestamp?: number;
  }) => void;
  onNextTutorial?: () => void;
  onDismissTutorial?: () => void;
  onSetWorkoutPlan?: (p: WorkoutPlan | null) => void;
  telemetryRawRef?: { current: { effort: number; cadence: number } };
  classDataRef?: { current: unknown };
  isRidingRef?: { current: boolean };
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function RideControls(props: RideControlsProps) {
  // Diagnostic: track render count to identify infinite loop source
  const renderCount = useRef(0);
  renderCount.current++;
  if (renderCount.current > 20) {
    console.error(`[RideControls] Render loop detected! Count: ${renderCount.current}`);
  }
  // Subscribe to ride store
  const isRiding = useRideStore((s) => s.isRiding);
  const isExiting = useRideStore((s) => s.isExiting);
  const rideProgress = useRideStore((s) => s.rideProgress);
  const elapsedTime = useRideStore((s) => s.elapsedTime);
  const bleConnected = useRideStore((s) => s.bleConnected);
  const useSimulator = useRideStore((s) => s.useSimulator);
  const connectionHint = useRideStore((s) => s.connectionHint);
  const viewMode = useRideStore((s) => s.viewMode);
  const showNoBikeModal = useRideStore((s) => s.showNoBikeModal);
  const showKeyboardHints = useRideStore((s) => s.showKeyboardHints);
  const showDemoModal = useRideStore((s) => s.showDemoModal);
  const showMilestone = useRideStore((s) => s.showMilestone);
  const rewardMode = useRideStore((s) => s.rewardMode);
  const completedRideId = useRideStore((s) => s.completedRideId);
  const completionSyncStatus = useRideStore((s) => s.completionSyncStatus);
  const completionPrimaryAction = useRideStore((s) => s.completionPrimaryAction);
  const workoutPlan = useRideStore((s) => s.workoutPlan);
  const demoStats = useRideStore((s) => s.demoStats);
  const deviceTypeFromStore = useRideStore((s) => "desktop" as const);

  const deviceType = props.deviceType || deviceTypeFromStore;

  // Loading state
  if (props.isLoading) {
    return (
      <RideLoading
        classId={props.classId}
        isPracticeMode={props.isPracticeMode}
        practiceClassName={props.practiceConfig?.name}
        rewardModeLabel={
          props.rewardMode === "yellow-stream"
            ? "Yellow Stream"
            : props.rewardMode === "zk-batch"
              ? "ZK Batch"
              : "Sui Native"
        }
        loadStartedAt={Date.now()}
        onPracticeMode={() => props.router?.push("/rider?mode=practice")}
        onBack={() => props.router?.push("/rider")}
      />
    );
  }

  // Not found state
  if (props.isNotFound) {
    return <RideNotFound onExit={props.onExitRide || (() => {})} />;
  }

  // Full ride UI
  const widgetsVisible = !isRiding || true; // TODO: from panel state
  const isGuestMode = props.isGuestMode || false;
  const isTrainingMode = props.isTrainingMode || false;

  return (
    <>
      {/* Network status — bottom-right corner, non-blocking */}
      <div className="fixed bottom-3 right-3 z-[60] max-w-xs">
        <NetworkStatusBanner />
      </div>

      <RideGestureZone
        enabled={deviceType === "mobile" && isRiding}
        onHaptic={props.haptic?.trigger}
      >
        {props.rewards && props.panelState && (
          <div style={{position:'fixed',top:0,left:0,right:0,zIndex:50,pointerEvents:'none'}}>
            {/* DIAGNOSTIC: RideHUDOverlay temporarily disabled to isolate #185 */}
          </div>
        )}

        <RideModals
          rideProgress={rideProgress}
          isPracticeMode={props.isPracticeMode}
          isTrainingMode={isTrainingMode}
          isRiding={isRiding}
          elapsedTime={elapsedTime}
          telemetryAverages={props.telemetryAverages || { avgHr: 0, avgPower: 0, avgEffort: 0 }}
          bleConnected={bleConnected}
          useSimulator={useSimulator}
          classId={props.classId}
          classData={props.classData || null}
          practiceConfig={props.practiceConfig || null}
          rewardsFormattedReward={props.rewards?.formattedReward || "0.00"}
          handleClaimRewards={props.onClaimRewards || (() => {})}
          rewardClaimStatus={props.rewardClaimStatus}
          completionSyncStatus={completionSyncStatus}
          completionPrimaryAction={completionPrimaryAction}
          showMilestone={showMilestone}
          showNoBikeModal={showNoBikeModal}
          showKeyboardHints={showKeyboardHints}
          showDemoModal={showDemoModal}
          demoStats={demoStats}
          showTutorial={props.showTutorial || false}
          tutorialStep={props.tutorialStep || 0}
          agentName={props.agentName || "Coach"}
          aiPersonality={props.classData?.metadata?.ai?.personality || "data"}
          _rewardMode={rewardMode}
          _walletConnected={props.walletConnected || false}
          ridePointsRef={props.ridePointsRef || { current: [] }}
          router={props.router as AppRouterInstance || { push: () => {}, back: () => {}, forward: () => {}, refresh: () => {}, replace: () => {}, prefetch: () => {} } as AppRouterInstance}
          onExitRide={props.onExitRide || (() => {})}
          onEnableSimulatorFromModal={() => {
            useRideStore.setState({
              useSimulator: true,
              showNoBikeModal: false,
              showKeyboardHints: true,
              connectionHint: null,
            });
            // Auto-start ride after enabling simulator
            setTimeout(() => {
              props.onStartRide?.();
            }, 100);
          }}
          onDismissNoBike={() => useRideStore.setState({ showNoBikeModal: false })}
          onDismissKeyboardHints={() => useRideStore.setState({ showKeyboardHints: false })}
          onDemoModalClose={() => {
            useRideStore.setState({ showDemoModal: false });
            props.router?.push("/rider");
          }}
          onNextTutorial={props.onNextTutorial || (() => {})}
          onDismissTutorial={props.onDismissTutorial || (() => {})}
          onSimulatorMetrics={props.onSimulatorMetrics || (() => {})}
        />
      </RideGestureZone>
    </>
  );
}
