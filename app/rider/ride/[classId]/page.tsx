"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useClass, type ClassWithRoute } from "../../../hooks/evm/use-class-data";
import { usePracticeConfig } from "../../../hooks/ride/use-practice-config";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore, selectTelemetrySnapshot } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useUIStore } from "@/app/stores/ui-store";
import { useRideModalStore } from "@/app/stores/ride-modal-store";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { usePanelState } from "../../../hooks/ui/use-panel-state";
import { useRideTutorial } from "../../../components/features/ride/ride-tutorial";
import { RideLoading, RideNotFound } from "../../../components/features/ride/ride-loading";
import { RideVisualization } from "../../../components/features/ride/ride-visualization";
// NOTE: RideHUDOverlay v1 was replaced by RideHUDOverlayV2 (see below) — do not reintroduce.
import { useSwipeGesture } from "@/app/hooks/ride/use-swipe-gesture";
import type { RideRecordPoint } from "../../../lib/analytics/ride-recorder";
import type { SessionMilestone } from "@/app/lib/milestones";
import {
  useDeviceType,
  useOrientation,
  useActualViewportHeight,
  usePerformanceTier,
} from "../../../lib/responsive";
import { CoachChannel } from "../../../components/features/ride/coach-channel";
import { EnhancedFlowBackground } from "../../../components/features/ride/enhanced-flow-background";
import { RideHUDOverlayV2 } from "../../../components/features/ride/ride-hud-overlay-v2";
import { probeGpu } from "@/app/lib/gpu-probe";
import { RideTransitionOverlay } from "../../../components/features/ride/ride-transition-overlay";
import { RideCompletionV2 } from "../../../components/features/ride/ride-completion-v2";
import { ModalStack } from "../../../components/features/ride/modal-stack";
import type { RewardMode } from "../../../hooks/rewards/use-rewards";
import { useWakeLock } from "../../../hooks/use-wake-lock";
import { useRideCoordinator } from "@/app/engines/use-ride-coordinator";
import { useAiInstructor } from "@/app/hooks/ai/use-ai-instructor";
import { useLLMCoaching } from "@/app/hooks/ai/use-llm-coaching";
import { useHaptic } from "../../../hooks/use-haptic";
import {
  type WorkoutPlan,
  type WorkoutInterval,
  PHASE_TO_THEME,
  PRESET_WORKOUTS,
} from "../../../lib/workout-plan";
import { SectionErrorBoundary } from "../../../components/layout/error-boundary";
import { useRideKeyboard } from "@/app/hooks/ride/use-ride-keyboard";
import { useRideAnalytics } from "@/app/hooks/ride/use-ride-analytics";
import { useBleData } from "@/app/hooks/ble/use-ble-data";
import type { FitnessMetrics } from "@/app/lib/ble/types";
import { useToast } from "@/app/components/ui/toast";
import { useRideRewards } from "@/app/hooks/ride/use-ride-rewards";
import { useRideSimulator } from "@/app/hooks/ride/use-ride-simulator";
import { useRideLifecycle } from "@/app/hooks/ride/use-ride-lifecycle";
import { usePrPursuit } from "@/app/hooks/ride/use-pr-pursuit";
import { usePushLiveTelemetry } from "@/app/hooks/common/use-live-telemetry";
import { useSensorySync } from "@/app/hooks/ride/use-sensory-sync";
import { useFlowState, type FlowStateEvent } from "@/app/lib/flow-state";
import type { FlowStateTier } from "@/app/lib/flow-state";
import { milestonesAndStreaks } from "@/app/lib/milestones";
import { STORAGE_KEYS } from "@/app/lib/analytics/ride-history";
import { experienceManager, useExperience } from "@/app/lib/experience-level";
import { musicEngine, useMusicEngine } from "@/app/lib/music-engine";

/** Fully static class strings per multi-ghost avatar position, so Tailwind's
 *  build-time scanner can see them (dynamic `bg-${color}-500` templates get
 *  purged from the production bundle). */
const POSITION_AVATAR_CLASSES = [
  "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300",
  "bg-amber-500/20 border border-amber-500/30 text-amber-300",
  "bg-rose-500/20 border border-rose-500/30 text-rose-300",
];

/**
 * RideAiTelemetryBridge — owns the telemetry-snapshot-driven side effects
 * (rule-based AI instructor, LLM coaching, live telemetry push to the
 * instructor view) in an isolated component tree.
 *
 * telemetrySnapshot gets a new object identity on every telemetry commit
 * (up to 10Hz on high-tier desktop). Subscribing to it directly from the
 * 500+ line root page re-rendered the entire ride page at that rate. This
 * component renders nothing — it exists purely to scope that subscription
 * away from the root.
 */
function RideAiTelemetryBridge({
  isRiding,
  isPracticeMode,
  classId,
  classData,
  currentInterval,
  elapsedTime,
  coordinatorRef,
}: {
  isRiding: boolean;
  isPracticeMode: boolean;
  classId: string;
  classData: ClassWithRoute | null;
  currentInterval: WorkoutInterval | null;
  elapsedTime: number;
  coordinatorRef: React.MutableRefObject<ReturnType<typeof useRideCoordinator> | null>;
}) {
  const telemetrySnapshot = useTelemetryStore(selectTelemetrySnapshot);

  // ─── AI Instructor (personality-driven rule-based coaching) ───
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
  }, [isRiding, coordinatorRef]);

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

  // ─── Push live telemetry to server for instructor view (throttled) ───
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
  useEffect(() => {
    isRidingRef.current = isRiding;
  }, [isRiding]);
  useEffect(() => {
    return () => {
      if (isRidingRef.current) clearTelemetry();
    };
  }, [clearTelemetry]);

  return null;
}

export default function LiveRidePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = params.classId as string;
  const { openConnectModal } = useConnectModal();

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
  const isStarting = useRideStore((s) => s.isStarting);
  const isPaused = useRideStore((s) => s.isPaused);
  const rideProgress = useRideStore((s) => s.rideProgress);
  const elapsedTime = useRideStore((s) => s.elapsedTime);
  const multiGhostState = useRideStore((s) => s.multiGhostState);

  // NOTE: the page deliberately does NOT subscribe to live snapshot values
  // (heartRate/effort/history) — those change on every telemetry commit and
  // would re-render the whole page at up to 10Hz. Consumers that need them
  // read on demand via useTelemetryStore.getState() (see hooks below).
  const telemetryAverages = useTelemetryStore((s) => s.averages);

  const currentInterval = useCoachingStore((s) => s.currentInterval);

  // ─── Ride Coordinator ──────────────────────────────────────────
  const coordinator = useRideCoordinator();
  const coordinatorRef = useRef(coordinator);
  useEffect(() => {
    coordinatorRef.current = coordinator;
  }, [coordinator]);
  const emptyRidePointsRef = useRef<RideRecordPoint[]>([]);

  // ─── Panel State ───────────────────────────────────────────────
  const panelState = usePanelState(deviceType);
  const viewMode = useUIStore((s) => s.viewMode);
  const toggleViewMode = useUIStore((s) => s.toggleViewMode);
  const haptic = useHaptic();
  const gpuProbe = useMemo(() => {
    if (typeof window === "undefined") return null;
    try { return probeGpu(); } catch { return null; }
  }, []);
  const canRender3d = gpuProbe ? gpuProbe.recommendedMode === "tron-3d" : true;
  const effectiveIsFocus = viewMode === "focus";
  const handleToggleViewMode = useCallback(() => {
    // Allow override on low-end — VisualizationEngine will auto-degrade back
    // to Focus if FPS stays <25 for 15s, so trying 3D is safe.
    haptic.trigger(canRender3d ? "light" : "warning");
    toggleViewMode();
  }, [canRender3d, haptic, toggleViewMode]);
  const hudMode = useUIStore((s) => s.hudMode);
  const setHudMode = useUIStore((s) => s.setHudMode);
  const toggleQuietHud = useCallback(
    () => setHudMode(hudMode === "minimal" ? "full" : "minimal"),
    [setHudMode, hudMode],
  );

  // Auto-degrade to Focus when VisualizationEngine detects sustained low FPS.
  useEffect(() => {
    const bus = (coordinator as unknown as { bus?: { on: (e: string, h: (d: unknown) => void) => () => void } })?.bus;
    if (!bus) return;
    const unsub = bus.on("visualization:degraded", () => {
      if (useUIStore.getState().viewMode === "immersive") {
        useUIStore.getState().setViewMode("focus");
      }
    });
    return unsub;
  }, [coordinator]);

  // Feed VisualizationEngine FPS sampler so degraded detection actually works.
  // RouteVisualizer is frameloop="demand", so we drive onFrame from a lightweight rAF here.
  useEffect(() => {
    if (!isRiding || effectiveIsFocus) return;
    const viz = (coordinator as unknown as { visualization?: { onFrame: () => void } })?.visualization;
    if (!viz?.onFrame) return;
    let raf = 0;
    const loop = () => {
      viz.onFrame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isRiding, effectiveIsFocus, coordinator]);

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
  // The page owns the BLE metrics stream for the whole ride — DeviceSelector
  // only lives in the pre-ride panel, so it can't be the one forwarding
  // metrics or connection status once the ride starts.
  const trackLiveTelemetryRef = useRef<() => void>(() => {});
  const handleBleMetrics = useCallback((metrics: FitnessMetrics) => {
    coordinator.ingestBleMetrics(metrics);
    if (metrics.heartRate || metrics.power) trackLiveTelemetryRef.current();
  }, [coordinator]);
  const { isConnected: bleConnected } = useBleData({ onSuccess: handleBleMetrics, silent: true });
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

  useEffect(() => {
    if (isRiding && deviceType === "mobile") requestWakeLock();
    else if (!isRiding && wakeLockActive) releaseWakeLock();
  }, [isRiding, deviceType, requestWakeLock, releaseWakeLock, wakeLockActive]);

  // ─── Audio (via coordinator) ───────────────────────────────────
  const playSound = useCallback((type: unknown) => coordinatorRef.current.playSound?.(type as never)?.catch?.(() => {}), []);
  const playCountdown = useCallback((seconds: number) => coordinatorRef.current.playCountdown?.(seconds), []);
  const stopAudio = useCallback(() => coordinatorRef.current.stopAudio?.(), []);
  const speak = useCallback((text: string, emotion?: unknown) => coordinatorRef.current.speak?.(text, emotion as never)?.catch?.(() => {}), []);
  // Stable identity so ModalStack can be memoized and doesn't re-render per page render.
  const handleSimulatorMetrics = useCallback(
    (m: { heartRate: number; power: number; cadence: number; speed: number; effort: number }) =>
      coordinatorRef.current?.ingestSimulatorMetrics({ ...m, distance: 0, timestamp: Date.now() }),
    [],
  );

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
  });

  const simulatorHook = useRideSimulator({
    isRiding,
    isTrainingMode,
    isGuestMode,
    isPracticeMode,
  });

  const analyticsHook = useRideAnalytics({
    classId,
    isPracticeMode,
    isRiding,
    rideProgress,
    bleConnected,
    useSimulator,
    playSound,
  });

  useEffect(() => {
    trackLiveTelemetryRef.current = analyticsHook.trackLiveTelemetry;
  }, [analyticsHook.trackLiveTelemetry]);

  useRideKeyboard({
    isRiding,
    panelState,
    coordinator,
    playSound,
  });

  // Demo/practice mode: keyboard → cadence/power → reactive world is handled by
  // the PedalSimulator (wired to coordinator.ingestSimulatorMetrics via ModalStack).
  // It is the single keyboard→stats source so stats don't flicker between two models.

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
  });

  // Sync completedRideId back to rewards hook
  const completedRideId = useRideModalStore((s) => s.completedRideId);
  const showCompletionScreen = useRideModalStore((s) => s.showCompletionScreen);

  // Snapshot completion-time stats once, when the overlay opens. Previously these
  // were read via useTelemetryStore.getState() during render — correct only while
  // the page re-rendered every commit; they go stale once renders are event-driven.
  const [completionStats, setCompletionStats] = useState<{ avgHr: number; avgPower: number; avgEffort: number } | null>(null);
  useEffect(() => {
    if (showCompletionScreen && !completionStats) {
      const { averages } = useTelemetryStore.getState();
      setCompletionStats({ avgHr: averages.avgHr, avgPower: averages.avgPower, avgEffort: averages.avgEffort });
    } else if (!showCompletionScreen) {
      setCompletionStats(null);
    }
  }, [showCompletionScreen, completionStats]);

  // PR pursuit callouts during ride
  usePrPursuit(isRiding);

  // ─── Flow State Engine (declared early; milestones/flow handlers depend on it) ─
  const [hrResting] = useState(() => {
    // Default ~60 bpm, would come from user profile in production
    return 60;
  });

  // NOTE: flow inputs are pushed via the telemetry-store subscription below,
  // not via re-render — so the page does NOT subscribe to the live snapshot.
  const flow = useFlowState(0, 0, hrResting);

  // Push live power/HR into the flow engine without re-rendering the page.
  // (Subscribing the component to s.snapshot here re-rendered the whole ride
  // page at up to 10Hz on every telemetry commit.)
  const flowSetInputsRef = useRef(flow.setInputs);
  useEffect(() => {
    flowSetInputsRef.current = flow.setInputs;
  }, [flow.setInputs]);
  useEffect(
    () =>
      useTelemetryStore.subscribe((s) => {
        flowSetInputsRef.current(s.snapshot.power, s.snapshot.heartRate);
      }),
    [],
  );

  // ─── Max telemetry tracking (for completion celebration) ─────────
  const maxPowerRef = useRef(0);
  const maxHRRef = useRef(0);
  const peakEffortRef = useRef(0);

  // ─── Milestone Recording ─────────────────────────────────────
  const [rideMilestones, setRideMilestones] = useState<SessionMilestone[]>([]);

  const recordMilestonesOnCompletion = useCallback(() => {
    // Record ride stats for milestone tracking
    milestonesAndStreaks.recordRide({
      durationSec: elapsedTime,
      avgPower: telemetryAverages.avgPower || 0,
      maxPower: maxPowerRef.current,
      avgHR: telemetryAverages.avgHr || 0,
      maxHR: maxHRRef.current,
      avgCadence: 0, // Would need to track cadence history
      distance: 0, // Would calculate from GPS
      calories: Math.round(elapsedTime * 0.15), // Rough estimate
      flowMinutes: flow.totalFlowMinutes,
      peakFlowTier: flow.flowTier,
    });

    // Detect and record session milestones
    const newMilestones = milestonesAndStreaks.detectAndRecordMilestones({
      duration: elapsedTime / 60, // Convert seconds to minutes
      avgPower: telemetryAverages.avgPower || 0,
      maxPower: maxPowerRef.current,
      hr: telemetryAverages.avgHr || 0,
      maxHR: maxHRRef.current,
      cadence: 0,
      distance: 0,
      flowMinutes: flow.totalFlowMinutes,
      peakFlowTier: flow.flowTier,
    });

    // Update local milestone state
    if (newMilestones.length > 0) {
      setRideMilestones(newMilestones);
    }

    // Also update experience level
    experienceManager.recordRide();
  }, [elapsedTime, telemetryAverages, maxPowerRef.current, maxHRRef.current, flow]);

  // Trigger milestone recording when completion screen appears
  useEffect(() => {
    if (showCompletionScreen) {
      recordMilestonesOnCompletion();
      // Mark first ride done so quiz shows on next landing visit (Phase 4.1)
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.quizPostRide, "true");
      }
    }
  }, [showCompletionScreen, recordMilestonesOnCompletion]);

  // ─── Real-time Milestone Detection During Ride ──────────────────
  // Tracks shown milestone IDs to avoid duplicate pop-ups in the same ride
  const shownMilestoneIdsRef = useRef<Set<string>>(new Set());
  const prevRideMinuteRef = useRef<number>(0);
  const setShowMilestone = useRideModalStore((s) => s.setShowMilestone);

  useEffect(() => {
    if (!isRiding) {
      // Reset tracking when ride starts/stops
      shownMilestoneIdsRef.current = new Set();
      prevRideMinuteRef.current = 0;
      return;
    }

    const currentMinute = Math.floor(elapsedTime / 60);

    // Check for milestones at each minute boundary
    if (currentMinute > prevRideMinuteRef.current && currentMinute > 0) {
      prevRideMinuteRef.current = currentMinute;

      // Check for milestones at this time threshold
      const milestoneCheck = milestonesAndStreaks.detectAndRecordMilestones({
        duration: elapsedTime / 60,
        avgPower: telemetryAverages.avgPower || 0,
        maxPower: maxPowerRef.current,
        hr: telemetryAverages.avgHr || 0,
        maxHR: maxHRRef.current,
        cadence: 0,
        distance: 0,
        flowMinutes: flow.totalFlowMinutes,
        peakFlowTier: flow.flowTier,
      });

      // Show the most valuable new milestone
      const newMilestones = milestoneCheck.filter(
        (m) => !shownMilestoneIdsRef.current.has(m.id)
      );

      if (newMilestones.length > 0) {
        // Sort by tier value (show highest first)
        const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;
        newMilestones.sort((a, b) =>
          tierOrder.indexOf(b.tier) - tierOrder.indexOf(a.tier)
        );

        const milestone = newMilestones[0];
        shownMilestoneIdsRef.current.add(milestone.id);

        // Show milestone overlay (auto-dismisses after 2s via modal stack)
        setShowMilestone({
          title: `${milestone.tier === 'diamond' ? '💎' : milestone.tier === 'platinum' ? '💎' : milestone.tier === 'gold' ? '🥇' : milestone.tier === 'silver' ? '🥈' : '🥉'} ${milestone.title}`,
          subtitle: milestone.description,
        });

        // Auto-dismiss after 2s (also handled by modal stack's autoDismissMs)
        setTimeout(() => {
          setShowMilestone(null);
        }, 2000);
      }
    }
  }, [elapsedTime, isRiding, telemetryAverages, maxPowerRef.current, maxHRRef.current, flow, setShowMilestone]);

  // ─── Experience Level Adaptation ─────────────────────────────
  const experience = useExperience();

  // ─── Sensory sync (audio + visual + haptic choreography) ────────
  useSensorySync();

  // Register flow event handler → dispatch to coach channel + sensory sync
  useEffect(() => {
    flow.registerFlowEventHandler((event: FlowStateEvent) => {
      // 1. Send coach message via coaching store
      if (event.message) {
        const coachingStore = useCoachingStore.getState();
        coachingStore.setAiLogs([
          {
            type: "observation",
            message: event.message,
            timestamp: Date.now(),
          },
        ]);
      }

      // 2. Fire sensory sync event (audio + haptic choreography)
      if (event.type === "tier-rise" || event.type === "peak") {
        // Brief haptic burst on tier escalation
        haptic.trigger(event.tier === 4 ? "success" : "warning");
      }

      // 3. Update music engine with flow state
      if (musicEngine) {
        musicEngine.updateFlowState(event.tier);
      }

      // 4. Log analytics event
      // (could integrate with telemetry store or analytics system)
    });
  }, [flow.registerFlowEventHandler, haptic.trigger]);

  // ─── Music Engine Integration ──────────────────────────────────
  const [currentMusicPhase, setCurrentMusicPhase] = useState<string | null>(null);

  // Select music track based on interval phase
  useEffect(() => {
    if (!isRiding || !currentInterval) return;
    
    const phase = currentInterval.phase ?? 'interval';
    if (phase !== currentMusicPhase) {
      setCurrentMusicPhase(phase);
      // Transition to new phase's music
      musicEngine.transitionToPhase(phase);
    }
  }, [currentInterval?.phase, isRiding]);

  // Update music flow state as flow changes
  useEffect(() => {
    if (isRiding) {
      musicEngine.updateFlowState(flow.flowTier);
    }
  }, [flow.flowTier, isRiding]);

  // ─── TTS Ducking ───────────────────────────────────────────────
  const coachIsSpeaking = useCoachingStore((s) => s.isSpeaking);
  const prevSpeakingRef = useRef(false);

  useEffect(() => {
    if (coachIsSpeaking && !prevSpeakingRef.current) {
      // Start ducking when coach begins speaking
      musicEngine.startDucking();
    } else if (!coachIsSpeaking && prevSpeakingRef.current) {
      // Stop ducking when coach stops speaking
      musicEngine.stopDucking();
    }
    prevSpeakingRef.current = coachIsSpeaking;
  }, [coachIsSpeaking]);
  useEffect(() => {
    if (completedRideId) {
      rewardsHook.setCompletedRideId(completedRideId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedRideId, rewardsHook.setCompletedRideId]);

  // ─── Auto-complete at 100% ─────────────────────────────────────
  // Nothing else ends a ride when the route finishes: at real-time speed a
  // rider exits manually, but the compressed practice clock hits 100% in
  // ~45 seconds — without this, the track marker pins at the finish and the
  // ride appears frozen. Persist + show completion instead.
  useEffect(() => {
    if (isRiding && rideProgress >= 100) {
      lifecycle.exitRide();
    }
  }, [isRiding, rideProgress, lifecycle]);

  // ─── BLE Disconnect Auto-Pause ─────────────────────────────────
  // Losing the bike mid-ride should pause, not keep the ride "running" on
  // dead telemetry. The native BLE service auto-reconnects; the rider
  // resumes from the paused screen once it's back.
  const toast = useToast();
  const prevBleConnectedRef = useRef(bleConnected);
  useEffect(() => {
    const wasConnected = prevBleConnectedRef.current;
    prevBleConnectedRef.current = bleConnected;
    if (wasConnected && !bleConnected && !useSimulator && useRideStore.getState().isActive) {
      lifecycle.pauseRide();
      toast.warning("Ride paused", "Your bike disconnected — attempting to reconnect. Resume when it's back.");
    }
  }, [bleConnected, useSimulator, lifecycle, toast]);

  // ─── Visibility Pause (save CPU when tab hidden) ──────────────
  // Go through the real pause flow so the coordinator halts and the rider
  // comes back to the paused screen with a Resume button — not a dead ride.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleVisibility = () => {
      if (document.hidden && useRideStore.getState().isActive) {
        lifecycle.pauseRide();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [lifecycle]);

  const formatTime = useCallback((seconds: number) => {
    const wholeSeconds = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(wholeSeconds / 60);
    const secs = wholeSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // ─── Activation sequence state ──────────────────────────────────
  const [showActivation, setShowActivation] = useState(false);
  const [activationComplete, setActivationComplete] = useState(false);

  useEffect(() => {
    if (isRiding && !activationComplete) {
      // Start activation sequence right before ride begins
      setShowActivation(true);
    }
  }, [isRiding, activationComplete]);

  // The page re-renders continuously (useFlowState ticks every 100ms,
  // sensory-sync, etc.), and `lifecycle` is a fresh object each render. If the
  // activation callbacks depend on it, `RideTransitionOverlay`'s countdown
  // effect re-subscribes on every render and the interval never fires — the
  // countdown gets stuck on "3" (and the Skip button never appears). Keep a
  // ref to the latest lifecycle so these callbacks are referentially stable.
  const lifecycleRef = useRef(lifecycle);
  useEffect(() => {
    lifecycleRef.current = lifecycle;
  });

  const handleActivationComplete = useCallback(() => {
    setShowActivation(false);
    setActivationComplete(true);
    lifecycleRef.current.startRide();
  }, []);

  const handleActivationSkip = useCallback(() => {
    setShowActivation(false);
    setActivationComplete(true);
    lifecycleRef.current.startRide();
  }, []);

  // "Ride Again" must actually ride again: close the completion screen,
  // reset the ride clock + telemetry + celebration refs so startRide treats
  // it as a fresh ride (not a resume), and replay the activation ceremony.
  // The ceremony's complete handler calls lifecycle.startRide(), which
  // disposes the old coordinator and starts a fresh one.
  const handleRideAgain = useCallback(() => {
    const modals = useRideModalStore.getState();
    modals.setShowCompletionScreen(false);
    modals.setWalrusAnchorInfo(null);
    modals.setShowMilestone(null);
    useRideStore.setState({ rideProgress: 0, elapsedTime: 0, isActive: false, isPaused: false, isStarting: false });
    useTelemetryStore.getState().reset();
    maxPowerRef.current = 0;
    maxHRRef.current = 0;
    peakEffortRef.current = 0;
    analyticsHook.trackedCompletionRef.current = false;
    setActivationComplete(false);
    setShowActivation(true);
  }, [analyticsHook]);

  // ─── Max telemetry tracking (for completion celebration) ─────────
  // Poll at 1Hz instead of subscribing to the live history array (which is
  // rebuilt on every telemetry commit, so subscribing re-rendered the page and
  // re-ran this effect up to 10x/sec). 1Hz granularity is plenty for maxima.
  useEffect(() => {
    if (!isRiding) return;
    const id = setInterval(() => {
      const s = useTelemetryStore.getState().snapshot;
      if (s.power > maxPowerRef.current) maxPowerRef.current = s.power;
      if (s.heartRate > maxHRRef.current) maxHRRef.current = s.heartRate;
      if (s.effort > peakEffortRef.current) peakEffortRef.current = s.effort;
    }, 1000);
    return () => clearInterval(id);
  }, [isRiding]);

  const handleExitClick = useCallback(() => {
    if (useRideStore.getState().isActive) {
      useRideModalStore.getState().setShowExitConfirm(true);
    } else {
      lifecycle.exitRide();
    }
  }, [lifecycle]);

  // ─── Tutorial ──────────────────────────────────────────────────
  const { nextStep: nextTutorial, dismiss: dismissTutorial } = useRideTutorial({ isPracticeMode, walletConnected });

  const showKeyboardHints = useRideModalStore((s) => s.showKeyboardHints);

  // Show keyboard controls hint when a simulator/practice ride starts
  useEffect(() => {
    if (isRiding && useSimulator) {
      useRideModalStore.getState().setShowKeyboardHints(true);
    }
  }, [isRiding, useSimulator]);

  // ─── Swipe gesture support (mobile) ─────────────────────────────
  const swipe = useSwipeGesture({
    onSwipeDown: () => {
      // Dismiss transient modals on swipe down
      if (useRideModalStore.getState().showKeyboardHints) {
        useRideModalStore.getState().setShowKeyboardHints(false);
      }
    },
    disabled: deviceType !== "mobile",
  });

  // ─── Transition state ──────────────────────────────────────────
  // Tracks where we are in the ride lifecycle for smooth transitions
  const transitionState = (() => {
    if (isLoading && !isPracticeMode) return "loading";
    if (showActivation && !showCompletionScreen) return "activation";
    if (showCompletionScreen) return "completion";
    return "riding";
  })();

  // Keyboard hints: no page-level auto-dismiss — they persist until the user
  // dismisses them (Esc / button) so controls stay discoverable. The overlay
  // itself handles its own intro fade; we don't fight it with a second timer.

  // ─── Modal store reads (hoisted before early returns — rules of hooks) ─
  const showExitConfirm = useRideModalStore((s) => s.showExitConfirm);
  const showNoBikeModal = useRideModalStore((s) => s.showNoBikeModal);
  const showTutorialModal = useRideModalStore((s) => s.showTutorial);
  const tutorialStep = useRideModalStore((s) => s.tutorialStep);
  const tutorialSteps = useRideModalStore((s) => s.tutorialSteps);
  const showMilestone = useRideModalStore((s) => s.showMilestone);
  const showDemoModal = useRideModalStore((s) => s.showDemoModal);
  const demoStats = useRideModalStore((s) => s.demoStats);
  const isExitingRide = useRideModalStore((s) => s.isExitingRide);

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
    <div
      ref={swipe.ref}
      className="fixed inset-0 bg-black"
      style={{ height: deviceType === "mobile" ? `${viewportHeight}px` : "100vh" }}
    >
      <RideAiTelemetryBridge
        isRiding={isRiding}
        isPracticeMode={isPracticeMode}
        classId={classId}
        classData={classData}
        currentInterval={currentInterval}
        elapsedTime={elapsedTime}
        coordinatorRef={coordinatorRef}
      />

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
          flowTier={flow.flowTier}
        />
      </SectionErrorBoundary>

      {/* ─── Coach channel (replaces full-screen overlay) ─────────── */}
      {/* Practice mode on mobile: raise it above the tall pedal-sheet bar.
          Hidden on the completion screen — the completion debrief speaks for
          the coach there (with optional vocal replay). */}
      {hudMode !== "minimal" && !showCompletionScreen && (
        <CoachChannel
          className={
            isRiding && useSimulator && deviceType === "mobile" ? "bottom-[22rem]" : ""
          }
        />
      )}

      {/* ─── Simplified reactive HUD (v2) ──────────────────────────── */}
      <SectionErrorBoundary title="ride HUD v2">
        <RideHUDOverlayV2
          hudMode={hudMode}
          isRiding={isRiding}
          showCompletionScreen={showCompletionScreen}
          flowTier={flow.flowTier}
          suppressBottomStack={isRiding && useSimulator}
          rideDurationSec={(classData?.metadata?.duration ?? 45) * 60}
        />
      </SectionErrorBoundary>

      {/* ─── Start ride (preview) — visible before the ride is active ───── */}
      {!isRiding && !isStarting && !isPaused && !showCompletionScreen && !showActivation && classData && (
        <div className="fixed inset-0 z-[65] flex flex-col items-center justify-center gap-6 pointer-events-none px-4">
          {/* Class context — a floating button on a void tells the rider
              nothing; name/duration/instructor earn the tap. */}
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl px-6 py-5 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300/80 mb-2">
              {isPracticeMode ? "Practice Ride" : "Class"}
            </p>
            <h2 className="text-lg font-black text-white tracking-tight leading-snug">
              {classData.metadata?.name ?? "Untitled Class"}
            </h2>
            <p className="mt-1.5 text-xs text-white/50">
              {classData.metadata?.instructor ? `${classData.metadata.instructor} · ` : ""}
              {classData.metadata?.duration ?? 45} min
            </p>
          </div>

          {/* View switcher — obvious before ride (same state as mid-ride pill).
              Segmented Focus/Immersive with live preview crossfade underneath. */}
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-black/60 backdrop-blur-xl p-1">
            <button
              onClick={() => { if (!effectiveIsFocus) handleToggleViewMode(); }}
              className={`rounded-full px-4 py-1.5 text-xs font-black transition-colors ${effectiveIsFocus ? "bg-white text-black shadow" : "text-white/60 hover:text-white"}`}
              aria-pressed={effectiveIsFocus}
              aria-label="Switch to 2D Focus view"
            >
              2D Focus
            </button>
            <button
              onClick={() => { if (effectiveIsFocus) handleToggleViewMode(); }}
              className={`rounded-full px-4 py-1.5 text-xs font-black transition-colors flex items-center gap-1.5 ${!effectiveIsFocus ? "bg-white text-black shadow" : "text-white/60 hover:text-white"}`}
              aria-pressed={!effectiveIsFocus}
              aria-label="Switch to immersive 3D view"
            >
              3D Immersive
              {!canRender3d && <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">Low GPU</span>}
            </button>
          </div>
          <p className="pointer-events-none text-[10px] font-bold uppercase tracking-[0.3em] text-white/25">Press V to toggle • Preview updates instantly</p>

          <button
            onClick={() => setShowActivation(true)}
            className="pointer-events-auto group relative rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-10 py-4 text-base font-black text-white shadow-[0_0_60px_rgba(245,158,11,0.5)] hover:scale-105 active:scale-95 transition-transform"
            aria-label="Start ride"
          >
            Start Ride
            <span className="block text-[10px] font-bold uppercase tracking-[0.3em] text-white/60 mt-0.5">
              Keyboard: ← → to pedal
            </span>
          </button>
        </div>
      )}

      {/* ─── Ride controls cluster (visible, always available) ──────── */}
      {isRiding && !showCompletionScreen && (
        <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-auto">
          {/* Hide / show UI (quiet mode) */}
          <button
            onClick={toggleQuietHud}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 backdrop-blur-xl px-3 py-1.5 text-[10px] font-bold text-white/60 hover:text-white transition-colors"
            title="Cycle HUD visibility (also: H)"
            aria-label="Toggle HUD visibility"
          >
            {hudMode === "minimal" ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Show UI
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                Hide UI
              </>
            )}
          </button>
          {/* Keyboard shortcuts help (persistent, re-openable) — hidden in zen mode */}
          {hudMode !== "minimal" && (
            <button
              onClick={() => useRideModalStore.getState().setShowKeyboardHints(true)}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 backdrop-blur-xl px-3 py-1.5 text-[10px] font-bold text-white/60 hover:text-white transition-colors"
              title="Keyboard controls"
              aria-label="Show keyboard controls"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
              Keys
            </button>
          )}
          {/* 2D/3D view toggle — crossfades stacked renderers (RideVisualization
              keeps both mounted after probe). Always enabled; low-end gets
              a warning haptic and auto-degrades back if FPS suffers. */}
          {hudMode !== "minimal" && (
            <button
              onClick={handleToggleViewMode}
              className={`flex items-center gap-1.5 rounded-full border backdrop-blur-xl px-3 py-1.5 text-[10px] font-bold transition-colors ${
                !canRender3d && effectiveIsFocus
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200/70 hover:text-amber-100"
                  : "border-white/15 bg-black/60 text-white/60 hover:text-white"
              }`}
              title={!canRender3d ? "Try immersive 3D anyway — will auto-switch back if slow (V)" : `Switch to ${effectiveIsFocus ? "immersive 3D" : "2D focus"} (V)`}
              aria-label={`Switch to ${effectiveIsFocus ? "immersive 3D" : "2D focus"} view`}
            >
              {effectiveIsFocus ? "3D" : "2D"}
              {!canRender3d && effectiveIsFocus && <span className="text-[8px] opacity-60">• Low GPU</span>}
            </button>
          )}
        </div>
      )}

      {/* ─── Transition overlay (replaces raw activation) ──────────── */}
      <RideTransitionOverlay
        state={transitionState}
        onActivationComplete={handleActivationComplete}
        onSkipActivation={handleActivationSkip}
        activationPhase={currentInterval?.phase ?? undefined}
        hasData={!!classData}
        loadProgress={Math.min(1, (Date.now() - loadStartedAt) / 5000)}
        loadTotal={5000}
        reducedMotion={false}
      />

      {/* ─── Completion celebration (v2) ───────────────────────────── */}
      {showCompletionScreen && (
        <RideCompletionV2
          isPracticeMode={isPracticeMode}
          walletConnected={walletConnected}
          elapsedTime={elapsedTime}
          avgHeartRate={completionStats?.avgHr ?? telemetryAverages.avgHr}
          avgPower={completionStats?.avgPower ?? telemetryAverages.avgPower}
          avgEffort={completionStats?.avgEffort ?? telemetryAverages.avgEffort}
          telemetrySource={useSimulator ? "simulator" : (bleConnected ? "live-bike" : "estimated")}
          onExit={lifecycle.handleCompletionExit}
          onRideAgain={handleRideAgain}
          onClaimRewards={rewardsHook.handleClaimRewards}
          onConnectWallet={() => openConnectModal?.()}
          onSpeakDebrief={(text) => void speak(text, "data")}
          rewardClaimStatus={rewardsHook.rewardClaimStatus}
          spinEarned={rewardsHook.rewards.formattedReward}
          agentName={agentName}
          agentPersonality={aiPersonality as "zen" | "drill-sergeant" | "data"}  
          walrusAnchorInfo={null}
          classId={classId}
          completedRideId={completedRideId ?? undefined}
          settlementStatus={undefined}
          maxHeartRate={maxHRRef.current}
          maxPower={maxPowerRef.current}
          peakEffort={peakEffortRef.current}
          rideMilestones={rideMilestones}
        />
      )}

      {/* ─── Modal stack (disciplined, single modal at a time) ─────── */}
      <SectionErrorBoundary title="ride modals">
      <ModalStack
        exitConfirm={showExitConfirm}
        noBike={showNoBikeModal}
        tutorial={showTutorialModal}
        tutorialStep={tutorialStep}
        tutorialSteps={tutorialSteps}
        milestone={showMilestone}
        keyboardHints={showKeyboardHints}
        demoModal={showDemoModal}
        demoStats={demoStats}
        isExitingRide={isExitingRide}
        useSimulator={useSimulator}
        isRiding={isRiding}
        hideSimulator={hudMode === "minimal"}
        showRideMetrics={useSimulator}
        onSimulatorMetrics={handleSimulatorMetrics}

        // Callbacks
        onExitConfirm={() => {
          useRideModalStore.getState().setShowExitConfirm(false);
          lifecycle.exitRide();
        }}
        onExitCancel={() => useRideModalStore.getState().setShowExitConfirm(false)}
        onNoBikeSimulator={() => {
          setUseSimulator(true);
          useRideModalStore.getState().setShowNoBikeModal(false);
        }}
        onNoBikeDismiss={() => useRideModalStore.getState().setShowNoBikeModal(false)}
        onTutorialNext={nextTutorial}
        onTutorialDismiss={dismissTutorial}
        onDemoClose={lifecycle.handleDemoModalClose}
        onKeyboardDismiss={() => useRideModalStore.getState().setShowKeyboardHints(false)}
      />
      </SectionErrorBoundary>
    </div>
  );
}
