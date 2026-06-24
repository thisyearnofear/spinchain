"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useClass } from "../../../hooks/evm/use-class-data";
import { usePracticeConfig } from "../../../hooks/ride/use-practice-config";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore, selectTelemetrySnapshot } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useUIStore } from "@/app/stores/ui-store";
import { useRideModalStore } from "@/app/stores/ride-modal-store";
import { useAccount } from "wagmi";
import { usePanelState } from "../../../hooks/ui/use-panel-state";
import { useRideTutorial } from "../../../components/features/ride/ride-tutorial";
import { RideLoading, RideNotFound } from "../../../components/features/ride/ride-loading";
import { RideVisualization } from "../../../components/features/ride/ride-visualization";
import { RideHUDOverlay } from "../../../components/features/ride/ride-hud-overlay";
import { RideModals } from "../../../components/features/ride/ride-modals";
import type { RideRecordPoint } from "../../../lib/analytics/ride-recorder";
import {
  useDeviceType,
  useOrientation,
  useActualViewportHeight,
  usePerformanceTier,
} from "../../../lib/responsive";
import { CoachMessageOverlay } from "../../../components/features/ride/coach-message-overlay";
import { FlowBackground } from "../../../components/features/ride/flow-background";
import { PerformanceGraph } from "../../../components/features/ride/performance-graph";
import { SettlementStream } from "../../../components/features/ride/settlement-stream";
import type { RewardMode } from "../../../hooks/rewards/use-rewards";
import { useWakeLock } from "../../../hooks/use-wake-lock";
import { useRideCoordinator } from "@/app/engines/use-ride-coordinator";
import { useAiInstructor } from "@/app/hooks/ai/use-ai-instructor";
import { useLLMCoaching } from "@/app/hooks/ai/use-llm-coaching";
import { RidePreviewBadge } from "../../../components/features/common/yellow-status-indicator";
import { useHaptic } from "../../../hooks/use-haptic";
import {
  type WorkoutPlan,
  PHASE_TO_THEME,
  PRESET_WORKOUTS,
} from "../../../lib/workout-plan";
import { SectionErrorBoundary } from "../../../components/layout/error-boundary";
import { useRideKeyboard } from "@/app/hooks/ride/use-ride-keyboard";
import { useRideAnalytics } from "@/app/hooks/ride/use-ride-analytics";
import { useRideRewards } from "@/app/hooks/ride/use-ride-rewards";
import { useRideSimulator } from "@/app/hooks/ride/use-ride-simulator";
import { useRideLifecycle } from "@/app/hooks/ride/use-ride-lifecycle";
import { usePrPursuit } from "@/app/hooks/ride/use-pr-pursuit";
import { usePushLiveTelemetry } from "@/app/hooks/common/use-live-telemetry";

export default function LiveRidePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = params.classId as string;

  // ─── Data Loading ──────────────────────────────────────────────
  const { isPracticeMode, practiceConfig, practiceClassData } = usePracticeConfig(classId);
  const { classData: fetchedClassData, isLoading } = useClass(classId as `0x${string}`);
  const classData = isPracticeMode ? practiceClassData : fetchedClassData;
  const [loadStartedAt] = useState(() => Date.now());
  const classDataRef = useRef(classData);
  useEffect(() => { classDataRef.current = classData; }, [classData]);

  // ─── Device / Viewport ─────────────────────────────────────────
  const deviceType = useDeviceType();
  const orientation = useOrientation();
  const viewportHeight = useActualViewportHeight();
  const performanceTier = usePerformanceTier();

  // ─── Store Reads ───────────────────────────────────────────────
  const isRiding = useRideStore((s) => s.isActive);
  const rideProgress = useRideStore((s) => s.rideProgress);
  const elapsedTime = useRideStore((s) => s.elapsedTime);
  const multiGhostState = useRideStore((s) => s.multiGhostState);

  const telemetryHeartRate = useTelemetryStore((s) => s.snapshot.heartRate);
  const telemetryEffort = useTelemetryStore((s) => s.snapshot.effort);
  const telemetryHistory = useTelemetryStore((s) => s.history);
  const telemetryAverages = useTelemetryStore((s) => s.averages);

  const currentInterval = useCoachingStore((s) => s.currentInterval);

  // ─── Ride Coordinator ──────────────────────────────────────────
  const coordinator = useRideCoordinator();
  const coordinatorRef = useRef(coordinator);
  useEffect(() => {
    coordinatorRef.current = coordinator;
  }, [coordinator]);
  const emptyRidePointsRef = useRef<RideRecordPoint[]>([]);

  // ─── AI Instructor (personality-driven rule-based coaching) ───
  const telemetrySnapshot = useTelemetryStore(selectTelemetrySnapshot);
  const [suiSessionId, setSuiSessionId] = useState<string | null>(null);
  useEffect(() => {
    if (!isRiding) {
      setSuiSessionId(null);
      return;
    }
    const interval = setInterval(() => {
      const state = coordinatorRef.current?.getSuiSessionState?.();
      if (state?.sessionId && !state.sessionId.startsWith("pending-")) {
        setSuiSessionId(state.sessionId);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isRiding]);
  const aiInstructorMetrics = useMemo(
    () =>
      isRiding
        ? {
            power: telemetrySnapshot.power,
            cadence: telemetrySnapshot.cadence,
            heartRate: telemetrySnapshot.heartRate,
            speed: telemetrySnapshot.speed,
            distance: telemetrySnapshot.distance,
            resistance: telemetrySnapshot.resistance,
            wBal: telemetrySnapshot.wBal,
            wBalPercentage: telemetrySnapshot.wBalPercentage,
            timestamp: telemetrySnapshot.timestamp,
          }
        : null,
    [isRiding, telemetrySnapshot],
  );
  const aiInstructor = useAiInstructor({
    agentName: "Coach",
    personality: "data",
    sessionObjectId: suiSessionId,
    metrics: aiInstructorMetrics,
    currentInterval,
    isEnabled: isRiding,
  });

  // Forward AI instructor logs to coaching store for UI display
  const setAiLogs = useCoachingStore((s) => s.setAiLogs);
  useEffect(() => {
    if (aiInstructor.logs.length > 0) {
      setAiLogs(
        aiInstructor.logs.map((log) => ({
          type: log.type === "action" ? "action" : log.type === "alert" ? "correction" : "observation",
          message: log.message,
          timestamp: log.timestamp,
        })),
      );
    }
  }, [aiInstructor.logs, setAiLogs]);

  // ─── LLM Coaching (periodic AI-powered coaching via /api/ai/chat) ──
  const aiMeta = classData?.metadata?.ai as { systemPromptCid?: string } | undefined;
  useLLMCoaching({
    enabled: isRiding,
    personality: "data",
    systemPromptCid: aiMeta?.systemPromptCid,
  });

  // ─── Panel State ───────────────────────────────────────────────
  const panelState = usePanelState(deviceType);
  const viewMode = useUIStore((s) => s.viewMode);
  const hudMode = useUIStore((s) => s.hudMode);

  useEffect(() => {
    if (isRiding) panelState.startRideLayout();
    else panelState.endRideLayout();
  }, [isRiding, panelState]);

  const handleTogglePanel = useCallback(
    (key: Parameters<typeof panelState.toggle>[0]) => {
      if (deviceType === "mobile") {
        const isExpanded = panelState.state[key] === "expanded";
        if (isExpanded) panelState.collapse(key);
        else panelState.expandOne(key);
      } else {
        panelState.toggle(key);
      }
    },
    [deviceType, panelState],
  );

  const handleSnapPanel = useCallback(
    (key: Parameters<typeof panelState.snapPanelToEdge>[0]) => {
      panelState.snapPanelToEdge(key, { width: window.innerWidth, height: window.innerHeight });
    },
    [panelState],
  );

  const handleTrackWidgetInteraction = useCallback(() => {}, []);

  const handleResetPrefs = useCallback(() => {
    useUIStore.getState().resetPrefs();
    panelState.resetLayout();
  }, [panelState]);

  const handleCollapseToggle = useCallback(() => {
    if (panelState.isAllCollapsed) panelState.expandAll();
    else panelState.collapseAll();
  }, [panelState]);

  // ─── BLE / Simulator State ─────────────────────────────────────
  const [bleConnected, setBleConnected] = useState(false);
  const [useSimulator, setUseSimulator] = useState(() => {
    if (typeof window === "undefined") return false;
    const urlParams = new URLSearchParams(window.location.search);
    return isPracticeMode || urlParams.get("demo") === "true" || urlParams.get("sim") === "true";
  });

  useEffect(() => {
    useUIStore.setState({ deviceType, orientation, bleConnected, useSimulator, isPracticeMode });
  }, [deviceType, orientation, bleConnected, useSimulator, isPracticeMode]);

  useEffect(() => {
    useUIStore.setState({ widgetsMode: panelState.state.mobileRideWidgets });
  }, [panelState.state.mobileRideWidgets]);

  // ─── Workout Plan ──────────────────────────────────────────────
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(() => PRESET_WORKOUTS[1]);
  const agentName = classData?.instructor || "Coach";
  const aiPersonality = classData?.metadata?.ai?.personality;
  const [rewardMode, setRewardMode] = useState<RewardMode>("zk-batch");

  // ─── Route Derived Data ────────────────────────────────────────
  const routeCoordinates = useMemo(
    () => classData?.route?.route.coordinates ?? [],
    [classData?.route?.route.coordinates],
  );
  const routeElevationProfile = useMemo(
    () => routeCoordinates.map((c) => c.ele || 0),
    [routeCoordinates],
  );
  const routeProgress = isRiding || rideProgress > 0 ? rideProgress / 100 : 0;
  const currentRouteCoordinate = useMemo(() => {
    if (routeCoordinates.length === 0) return null;
    const index = Math.min(
      routeCoordinates.length - 1,
      Math.max(0, Math.round(routeProgress * Math.max(0, routeCoordinates.length - 1))),
    );
    return routeCoordinates[index] ?? null;
  }, [routeCoordinates, routeProgress]);
  const routeTheme = currentInterval
    ? PHASE_TO_THEME[currentInterval.phase]
    : (classData?.metadata?.route.theme as "neon" | "alpine" | "mars" | "anime" | "rainbow") || "neon";

  // ─── Wallet / Guest / Training Mode ────────────────────────────
  const { isConnected: walletConnected, address } = useAccount();
  const isGuestMode = typeof window !== "undefined" && localStorage.getItem("spin-guest-mode") === "true" && !walletConnected;
  const isTrainingMode = useSimulator && !isPracticeMode && walletConnected;

  useEffect(() => {
    useUIStore.setState({ isGuestMode, isTrainingMode });
  }, [isGuestMode, isTrainingMode]);

  // ─── Mobile Hooks ──────────────────────────────────────────────
  const { request: requestWakeLock, release: releaseWakeLock, isActive: wakeLockActive } = useWakeLock();
  const haptic = useHaptic();

  useEffect(() => {
    if (isRiding && deviceType === "mobile") requestWakeLock();
    else if (!isRiding && wakeLockActive) releaseWakeLock();
  }, [isRiding, deviceType, requestWakeLock, releaseWakeLock, wakeLockActive]);

  // ─── Audio (via coordinator) ───────────────────────────────────
  const playSound = useCallback((type: unknown) => coordinatorRef.current.playSound?.(type as never)?.catch?.(() => {}), []);
  const playCountdown = useCallback((seconds: number) => coordinatorRef.current.playCountdown?.(seconds), []);
  const stopAudio = useCallback(() => coordinatorRef.current.stopAudio?.(), []);
  const speak = useCallback((text: string, emotion?: unknown) => coordinatorRef.current.speak?.(text, emotion as never)?.catch?.(() => {}), []);

  // ─── Extracted Hooks ───────────────────────────────────────────
  const rewardsHook = useRideRewards({
    rewardMode,
    classId,
    classData,
    isPracticeMode,
    isTrainingMode,
    address,
    elapsedTime,
    telemetryAverages,
    telemetryHeartRate,
  });

  const simulatorHook = useRideSimulator({
    isRiding,
    isTrainingMode,
    isGuestMode,
    isPracticeMode,
    telemetryEffort,
    coordinator,
    classDataRef,
  });

  const analyticsHook = useRideAnalytics({
    classId,
    isPracticeMode,
    isRiding,
    rideProgress,
    bleConnected,
    useSimulator,
    telemetryEffort,
    playSound,
  });

  useRideKeyboard({
    isRiding,
    panelState,
    coordinator,
    playSound,
  });

  const lifecycle = useRideLifecycle({
    classId,
    classData,
    practiceConfig,
    isPracticeMode,
    isTrainingMode,
    bleConnected,
    useSimulator,
    walletConnected,
    address,
    rewardMode,
    agentName,
    workoutPlan,
    deviceType,
    performanceTier,
    telemetryAverages,
    elapsedTime,
    rewardClaimStatus: rewardsHook.rewardClaimStatus,
    useChainlinkRewards: rewardsHook.useChainlinkRewards,
    chainlinkSuccess: rewardsHook.chainlinkSuccess,
    zkSuccess: rewardsHook.zkSuccess,
    privacyScore: rewardsHook.privacyScore,
    privacyLevel: rewardsHook.privacyLevel,
    rewards: rewardsHook.rewards,
    coordinator,
    coordinatorRef,
    isRidingRef: simulatorHook.isRidingRef,
    trackedCompletionRef: analyticsHook.trackedCompletionRef,
    playCountdown,
    playSound,
    stopAudio,
    speak,
    setUseSimulator,
    setBleConnected,
    trackLiveTelemetry: analyticsHook.trackLiveTelemetry,
  });

  // Push live telemetry to server for instructor view (throttled)
  const { pushTelemetry, clearTelemetry } = usePushLiveTelemetry(isRiding && !isPracticeMode ? classId : null);
  useEffect(() => {
    if (!isRiding) return;
    pushTelemetry({
      heartRate: telemetrySnapshot.heartRate,
      power: telemetrySnapshot.power,
      cadence: telemetrySnapshot.cadence,
      effort: telemetrySnapshot.effort,
      elapsedSec: elapsedTime,
    });
  }, [isRiding, telemetrySnapshot, elapsedTime, pushTelemetry]);

  // Clear live telemetry on unmount or ride end
  const isRidingRef = useRef(isRiding);
  isRidingRef.current = isRiding;
  useEffect(() => {
    return () => {
      if (isRidingRef.current) clearTelemetry();
    };
  }, [clearTelemetry]);

  // Sync completedRideId back to rewards hook
  const completedRideId = useRideModalStore((s) => s.completedRideId);

  // PR pursuit callouts during ride
  usePrPursuit(isRiding);
  useEffect(() => {
    if (completedRideId) {
      rewardsHook.setCompletedRideId(completedRideId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedRideId, rewardsHook.setCompletedRideId]);

  // ─── Visibility Pause (save CPU when tab hidden) ──────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleVisibility = () => {
      if (document.hidden && simulatorHook.isRidingRef.current) {
        simulatorHook.isRidingRef.current = false;
        useRideStore.setState({ isActive: false });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [simulatorHook.isRidingRef]);

  const formatTime = useCallback((seconds: number) => {
    const wholeSeconds = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(wholeSeconds / 60);
    const secs = wholeSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // ─── Tutorial ──────────────────────────────────────────────────
  const { nextStep: nextTutorial, dismiss: dismissTutorial } = useRideTutorial({ isPracticeMode, walletConnected });

  // Show keyboard controls hint when a simulator/practice ride starts
  useEffect(() => {
    if (isRiding && useSimulator) {
      useRideModalStore.getState().setShowKeyboardHints(true);
    }
  }, [isRiding, useSimulator]);

  // ─── Loading / Not Found Gates ─────────────────────────────────
  if (isLoading && !isPracticeMode) {
    return (
      <RideLoading
        classId={classId}
        isPracticeMode={isPracticeMode}
        practiceClassName={practiceConfig?.name}
        rewardModeLabel={rewardMode === "yellow-stream" ? "Yellow Stream" : "ZK Batch"}
        loadStartedAt={loadStartedAt}
        onPracticeMode={() => router.push("/rider?mode=practice")}
        onBack={() => router.push("/rider")}
      />
    );
  }
  if (!classData || !classData.route) return <RideNotFound onExit={lifecycle.exitRide} />;

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black" style={{ height: deviceType === "mobile" ? `${viewportHeight}px` : "100vh" }}>
      <div className="absolute top-2 left-2 z-50">
        <RidePreviewBadge />
      </div>

      <SectionErrorBoundary title="ride visualization">
        <RideVisualization
          routeElevationProfile={routeElevationProfile}
          routeCoordinates={routeCoordinates}
          currentRouteCoordinate={currentRouteCoordinate}
          classData={classData}
          routeTheme={routeTheme}
          searchParams={searchParams}
          panelState={panelState.state}
          panelPositions={panelState.positions}
          onTogglePanel={handleTogglePanel}
          onSetPanelPosition={panelState.setPanelPosition}
          onSnapPanel={handleSnapPanel}
          onTrackWidgetInteraction={handleTrackWidgetInteraction}
          onExpandOne={panelState.expandOne}
          onHaptic={haptic.trigger}
        />
      </SectionErrorBoundary>

      <SectionErrorBoundary title="ride HUD">
        <RideHUDOverlay
          classData={classData}
          routeIsGenerated={classData?.routeIsGenerated}
          walletConnected={walletConnected}
          workoutPlan={workoutPlan}
          connectionHint={lifecycle.connectionHint}
          simulatedReward={simulatorHook.simulatedRewards}
          panelState={panelState.state}
          rewardMode={rewardMode}
          onSetUseSimulator={setUseSimulator}
          onSetRewardMode={setRewardMode}
          onExitRide={lifecycle.exitRide}
          onResetPrefs={handleResetPrefs}
          onCollapseToggle={handleCollapseToggle}
          isAllCollapsed={panelState.isAllCollapsed}
          onTogglePanel={handleTogglePanel}
          onSetWidgetsMode={panelState.setMobileRideWidgetsMode}
          onStartRide={lifecycle.startRide}
          onPauseRide={lifecycle.pauseRide}
          onSetWorkoutPlan={setWorkoutPlan}
          onBleMetrics={lifecycle.handleBleMetrics}
          onSimulatorMetrics={simulatorHook.handleSimulatorMetrics}
          onHaptic={haptic.trigger}
          formatTime={formatTime}
        />
      </SectionErrorBoundary>

      {isRiding && viewMode === "immersive" && hudMode !== "minimal" && deviceType !== "mobile" && (
        <div className="fixed top-40 right-6 z-40 flex flex-col gap-4">
          <PerformanceGraph data={telemetryHistory.power ?? []} color="text-yellow-400" label="Power" max={400} />
          <PerformanceGraph data={telemetryHistory.cadence ?? []} color="text-blue-400" label="Cadence" max={140} />
        </div>
      )}

      {isRiding && viewMode === "immersive" && hudMode !== "minimal" && multiGhostState.length > 0 && (
        <div className="fixed top-40 left-6 z-40 flex flex-col gap-3">
          {multiGhostState.map((rider, idx) => {
            const isAhead = rider.leadLagTime < 0;
            const positionColor = idx === 0 ? "emerald" : idx === 1 ? "amber" : "rose";
            return (
              <div key={rider.id ?? idx} className="flex items-center gap-3 bg-black/70 backdrop-blur-xl border border-white/10 rounded-full pl-1.5 pr-4 py-1.5 animate-in fade-in slide-in-from-left-5 duration-500">
                <div className="relative">
                  <div className={`w-8 h-8 rounded-full bg-${positionColor}-500/20 border border-${positionColor}-500/30 flex items-center justify-center text-[10px] font-black text-${positionColor}-300`}>
                    {rider.name?.substring(0, 2).toUpperCase() ?? "??"}
                  </div>
                  {rider.active && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-black animate-pulse" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white/80 leading-none">{rider.name}</span>
                  <span className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${isAhead ? "text-emerald-400" : "text-rose-400"}`}>
                    {rider.power}W · {isAhead ? "+" : ""}{Math.abs(rider.leadLagTime).toFixed(1)}s {isAhead ? "ahead" : "behind"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hudMode !== "minimal" && <FlowBackground />}
      {hudMode !== "minimal" && <SettlementStream />}
      <CoachMessageOverlay />

      {isRiding && currentInterval?.phase === "sprint" && (
        <div className="absolute inset-0 pointer-events-none rounded-none border-4 border-red-500/60 animate-pulse" />
      )}

      <SectionErrorBoundary title="ride modals">
      <RideModals
        classId={classId}
        classData={classData}
        rewardsFormattedReward={rewardsHook.rewards.formattedReward}
        handleClaimRewards={rewardsHook.handleClaimRewards}
        rewardClaimStatus={rewardsHook.rewardClaimStatus}
        agentName={agentName}
        aiPersonality={aiPersonality || "data"}
        ridePointsRef={emptyRidePointsRef}
        router={router}
        onExitRide={lifecycle.exitRide}
        onCompletionExit={lifecycle.handleCompletionExit}
        onEnableSimulatorFromModal={lifecycle.handleEnableSimulatorFromModal}
        onDismissNoBike={lifecycle.handleDismissNoBike}
        onDismissKeyboardHints={lifecycle.handleDismissKeyboardHints}
        onDemoModalClose={lifecycle.handleDemoModalClose}
        onNextTutorial={nextTutorial}
        onDismissTutorial={dismissTutorial}
        onSimulatorMetrics={simulatorHook.handleSimulatorMetrics}
      />
      </SectionErrorBoundary>
    </div>
  );
}
