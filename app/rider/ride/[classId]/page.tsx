"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTelemetryStore } from "../../../hooks/ride/use-telemetry-store";
import { useClass } from "../../../hooks/evm/use-class-data";
import { usePracticeConfig } from "../../../hooks/ride/use-practice-config";
import { useRideLifecycle } from "../../../hooks/ride/use-ride-lifecycle";
import { useRideTelemetry } from "../../../hooks/ride/use-ride-telemetry";
import { useAccount } from "wagmi";
import { usePanelState } from "../../../hooks/ui/use-panel-state";
import { useRideTutorial } from "../../../components/features/ride/ride-tutorial";
import {
  RideLoading,
  RideNotFound,
} from "../../../components/features/ride/ride-loading";
import { RideVisualization } from "../../../components/features/ride/ride-visualization";
import { RideHUDOverlay } from "../../../components/features/ride/ride-hud-overlay";
import {
  useRideFocusMode,
  useRideFocusKeyboard,
} from "@/app/hooks/ui/use-ride-focus-mode";
import { RideModals } from "../../../components/features/ride/ride-modals";

import { RideGestureZone } from "../../../components/features/ride/ride-gesture-zone";
import type { RewardClaimStatus } from "../../../components/features/ride/ride-completion";
import type { StoryBeat } from "../../../components/features/route/route-visualizer";
import { useSimulatedRewards } from "../../../hooks/ride/use-simulated-rewards";
import { useMultiGhost } from "../../../hooks/ride/use-multi-ghost";
import {
  useDeviceType,
  useOrientation,
  useActualViewportHeight,
  usePerformanceTier,
} from "../../../lib/responsive";
import { useWorkoutAudio } from "../../../hooks/ai/use-workout-audio";
import { useCoachVoice } from "../../../hooks/common/use-coach-voice";
import { useRideCoach } from "../../../hooks/ride/use-ride-coach";
import { useWorkoutAgent } from "../../../hooks/ai/use-workout-agent";
import { RiderSocialFeed } from "../../../components/features/ride/social-feed";
import { CoachMessageOverlay } from "../../../components/features/ride/coach-message-overlay";
import { FlowBackground } from "../../../components/features/ride/flow-background";
import { PerformanceGraph } from "../../../components/features/ride/performance-graph";
import { SettlementStream } from "../../../components/features/ride/settlement-stream";
import {
  useRewards,
  type RewardMode,
} from "../../../hooks/rewards/use-rewards";
import { useUnifiedBle } from "../../../lib/mobile-bridge";
import { useChainlinkVerification } from "../../../hooks/evm/use-chainlink-verification";
import { useZKClaim } from "../../../hooks/evm/use-zk-claim";
import { REWARD_VERIFICATION } from "../../../config";
import { ANALYTICS_EVENTS, trackEvent } from "../../../lib/analytics/events";
import { useWakeLock } from "../../../hooks/use-wake-lock";
import { NetworkStatusBanner } from "../../../components/features/common/yellow-status-indicator";
import { useHaptic } from "../../../hooks/use-haptic";
import {
  type WorkoutPlan,
  PHASE_TO_THEME,
  PRESET_WORKOUTS,
  getCurrentInterval,
  getIntervalProgress,
  getIntervalRemaining,
} from "../../../lib/workout-plan";
import { DEFAULT_ROAD_GEARS } from "../../../lib/analytics/physiological-models";
import type { EnhancedClassMetadata } from "../../../lib/contracts";
import {
  createCanonicalRideSummary,
  enqueueRideSync,
  getRetentionSignals,
  processRideSyncQueue,
  saveRideSummary,
  updateRideRewardState,
  type RideSyncStatus,
} from "../../../lib/analytics/ride-history";
import { persistRideSummaryToWalrus } from "../../../lib/walrus/ride-persistence";
import { SectionErrorBoundary } from "../../../components/layout/error-boundary";

const MAX_RIDE_POINTS = 10_800;
const MAX_TELEMETRY_SAMPLES = 5_400;
const DISABLE_RIDE_AUDIO_AND_VOICE = true;

function getSystemViewMode(
  deviceType: "mobile" | "tablet" | "desktop",
  performanceTier: "high" | "medium" | "low",
  prefersReducedMotion: boolean,
): "immersive" | "focus" {
  if (prefersReducedMotion) return "focus";
  return deviceType === "desktop" || performanceTier === "high"
    ? "immersive"
    : "focus";
}

export default function LiveRidePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = params.classId as string;

  const { isPracticeMode, practiceConfig, practiceClassData } =
    usePracticeConfig(classId);

  const { classData: fetchedClassData, isLoading } = useClass(
    classId as `0x${string}`,
  );
  const classData = isPracticeMode ? practiceClassData : fetchedClassData;
  const [loadStartedAt] = useState(() => Date.now());
  const deviceType = useDeviceType();
  const orientation = useOrientation();
  const viewportHeight = useActualViewportHeight();
  const performanceTier = usePerformanceTier();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Collapsible panel state
  const panelState = usePanelState(deviceType);

  // Keyboard shortcut for collapse all (C key)
  const {
    isAllCollapsed: panelIsAllCollapsed,
    expandAll: panelExpandAll,
    collapseAll: panelCollapseAll,
  } = panelState;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "c" || e.key === "C") {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
          return;
        e.preventDefault();
        if (panelIsAllCollapsed) {
          panelExpandAll();
        } else {
          panelCollapseAll();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panelIsAllCollapsed, panelExpandAll, panelCollapseAll]);

  const [viewMode, setViewMode] = useState<"immersive" | "focus">(
    getSystemViewMode(deviceType, performanceTier, false),
  );

  // Persisted preference (client-only)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("spinchain:ride:viewMode");
      if (stored === "focus" || stored === "immersive") {
        viewModePreferenceRef.current = "stored";
        setViewMode(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  // Accessibility: prefer reduced motion => default to focus mode + minimal HUD
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;

    const apply = () => {
      setPrefersReducedMotion(mq.matches);
    };

    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // BLE Device Connection
  const [bleConnected, setBleConnected] = useState(false);
  // Simulator mode defaults on for practice/demo rides to reduce onboarding friction.
  const [useSimulator, setUseSimulator] = useState(() => {
    if (typeof window === "undefined") return false;
    const urlParams = new URLSearchParams(window.location.search);
    return (
      isPracticeMode ||
      urlParams.get("demo") === "true" ||
      urlParams.get("sim") === "true"
    );
  });
  const [connectionHint, setConnectionHint] = useState<string | null>(null);
  const [showNoBikeModal, setShowNoBikeModal] = useState(false);
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);

  // Ride lifecycle (extracted to hook)
  const {
    isRiding,
    setIsRiding,
    isRidingRef,
    classDataRef,
    isStarting: _isStarting,
    setIsStarting,
    isExiting,
    setIsExiting,
    rideProgress,
    setRideProgress,
    elapsedTime,
    setElapsedTime,
  } = useRideLifecycle({
    classData,
    bleConnected,
    useSimulator,
  });

  const viewModePreferenceRef = useRef<"system" | "stored" | "manual">(
    "system",
  );

  // Mobile accordion: when expanding a panel on mobile, collapse others (one at a time)
  // Uses a ref for panelState so the callback identity stays stable across panel state changes.
  const panelStateRef = useRef(panelState);
  panelStateRef.current = panelState;

  const handleTogglePanel = useCallback(
    (key: Parameters<typeof panelState.toggle>[0]) => {
      const ps = panelStateRef.current;
      if (deviceType === "mobile") {
        const isCurrentlyExpanded = ps.state[key] === "expanded";
        if (isCurrentlyExpanded) {
          ps.collapse(key);
        } else {
          ps.expandOne(key);
        }
      } else {
        ps.toggle(key);
      }
    },
    [deviceType],
  );

  const { startRideLayout, endRideLayout } = panelState;
  // Track the previous isRiding state to prevent unnecessary re-renders
  const previousIsRidingRef = useRef<boolean | null>(null);
  
  useEffect(() => {
    // Only trigger layout changes when isRiding actually changes
    if (previousIsRidingRef.current === isRiding) return;
    previousIsRidingRef.current = isRiding;
    
    if (isRiding) {
      startRideLayout();
    } else {
      endRideLayout();
    }
  }, [isRiding, startRideLayout, endRideLayout]);

  const widgetsVisible =
    !isRiding || panelState.state.mobileRideWidgets !== "minimized";
  const widgetsMode = panelState.state.mobileRideWidgets;

  // Analytics callback — reads all rapidly-changing values from refs to stay stable.
  const isRidingRefForAnalytics = useRef(isRiding);
  isRidingRefForAnalytics.current = isRiding;
  const rideProgressRefForAnalytics = useRef(rideProgress);
  rideProgressRefForAnalytics.current = rideProgress;
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const trackWidgetInteraction = useCallback(
    (
      action: "toggle" | "minimize" | "restore" | "drag",
      panel: keyof typeof panelState.state,
    ) => {
      const ps = panelStateRef.current;
      const riding = isRidingRefForAnalytics.current;
      const progress = rideProgressRefForAnalytics.current;
      const phase = riding
        ? "in_ride"
        : progress > 0
          ? "post_ride"
          : "pre_ride";
      const eventName =
        action === "minimize"
          ? ANALYTICS_EVENTS.WIDGET_MINIMIZED
          : action === "restore"
            ? ANALYTICS_EVENTS.WIDGET_RESTORED
            : action === "drag"
              ? ANALYTICS_EVENTS.WIDGET_DRAGGED
              : ANALYTICS_EVENTS.WIDGET_TOGGLED;

      trackEvent(eventName, {
        panel,
        phase,
        viewMode: viewModeRef.current,
        deviceType,
        panelMode: ps.state[panel],
      });
    },
    [deviceType],
  );

  const cycleRideWidgetsMode = useCallback(() => {
    const ps = panelStateRef.current;
    const wm = ps.state.mobileRideWidgets;
    const nextMode =
      wm === "expanded"
        ? "collapsed"
        : wm === "collapsed"
          ? "minimized"
          : "expanded";
    ps.setMobileRideWidgetsMode(nextMode);
    trackWidgetInteraction(
      nextMode === "minimized"
        ? "minimize"
        : nextMode === "expanded"
          ? "restore"
          : "toggle",
      "mobileRideWidgets",
    );
  }, [trackWidgetInteraction]);

  // Onboarding Tutorial (extracted to reusable hook + component)
  const {
    showTutorial,
    tutorialStep,
    nextStep: nextTutorial,
    dismiss: dismissTutorial,
  } = useRideTutorial();

  // Wallet state (used for rewards + ghost history)
  const { isConnected: walletConnected, address } = useAccount();
  const [rewardMode, setRewardMode] = useState<RewardMode>("zk-batch");

  // Auto-start ride in demo mode
  useEffect(() => {
    if (bleConnected || useSimulator) {
      setConnectionHint(null);
    }
  }, [bleConnected, isPracticeMode, useSimulator]);

  // Compatibility: Create telemetry object from store for components that haven't been refactored yet
  const telemetry = useTelemetryStore(
    useShallow((state) => ({
      heartRate: state.heartRate,
      power: state.power,
      cadence: state.cadence,
      speed: state.speed,
      effort: state.effort,
      wBal: state.wBal,
      wBalPercentage: state.wBalPercentage,
      distance: state.distance,
      currentGear: state.currentGear,
      gearRatio: state.gearRatio,
      resistance: state.resistance,
      timestamp: state.timestamp,
    })),
  );

  const trackedEntryViewRef = useRef(false);
  const trackedLiveTelemetryRef = useRef(false);
  const trackedCompletionRef = useRef(false);
  const trackedMilestoneRef = useRef(false); // Separate from completion to avoid blocking ride-completed analytics

  const routeCoordinates = useMemo(
    () => classData?.route?.route.coordinates ?? [],
    [classData?.route?.route.coordinates],
  );

  const routeElevationProfile = useMemo(
    () => routeCoordinates.map((coordinate) => coordinate.ele || 0),
    [routeCoordinates],
  );
  const routeProgress = isRiding || rideProgress > 0 ? rideProgress / 100 : 0;
  const currentRouteCoordinate = useMemo(() => {
    if (routeCoordinates.length === 0) return null;
    const index = Math.min(
      routeCoordinates.length - 1,
      Math.max(
        0,
        Math.round(routeProgress * Math.max(0, routeCoordinates.length - 1)),
      ),
    );
    return routeCoordinates[index] ?? null;
  }, [routeCoordinates, routeProgress]);

  // Single source of truth for ride telemetry (consolidates RAF loop + history + ghost state)
  const {
    telemetryHistory,
    recentPowerHistory,
    setCurrentGear,
    ghostState,
    ridePointsRef,
    telemetrySamples,
    telemetryAverages,
    refreshTelemetryAverages,
    resetTelemetry,
    telemetryRawRef,
    handleBleMetrics: handleBleMetricsInternal,
    handleSimulatorMetrics: handleSimulatorMetricsInternal,
  } = useRideTelemetry({
    isRiding,
    deviceType,
    performanceTier,
    bleConnected,
    useSimulator,
    routeCoordinates,
    currentRouteCoordinate,
    elapsedTimeSeconds: elapsedTime,
    ghostBlobId: classData?.metadata?.route?.walrusBlobId,
    riderAddress: address,
    classId,
    historyUpdateIntervalMs: 2000, // reduce jank (0.5Hz history)
    maxRidePoints: MAX_RIDE_POINTS,
  });

  // Rate-limit reward recording to avoid async pressure on mobile
  const lastRewardRecordMsRef = useRef(0);
  const pendingRewardRecordRef = useRef(false);

  // Workout plan state
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(
    () => PRESET_WORKOUTS[1], // Default to HIIT 45 for demo; will be selectable
  );

  // Current interval tracking (derived from elapsed time)
  const currentIntervalIndex = workoutPlan
    ? getCurrentInterval(workoutPlan.intervals, elapsedTime)
    : -1;
  const currentInterval = workoutPlan?.intervals[currentIntervalIndex] ?? null;
  const intervalProgress = workoutPlan
    ? getIntervalProgress(workoutPlan.intervals, elapsedTime)
    : 0;
  const intervalRemaining = workoutPlan
    ? getIntervalRemaining(workoutPlan.intervals, elapsedTime)
    : 0;
  const routeTheme = currentInterval
    ? PHASE_TO_THEME[currentInterval.phase]
    : (classData?.metadata?.route.theme as
        | "neon"
        | "alpine"
        | "mars"
        | "anime"
        | "rainbow") || "neon";

  // Audio hooks
  const aiPersonality = classData?.metadata?.ai?.personality;
  const coachPersonality =
    aiPersonality === "drill-sergeant"
      ? "drill"
      : aiPersonality === "zen"
        ? "zen"
        : "data";
  const {
    playSound,
    playCountdown,
    stopAll: stopAudio,
    setMusicSpeed,
  } = useWorkoutAudio();
  const {
    speak,
    stop: stopVoice,
    isSpeaking,
  } = useCoachVoice({
    personality: coachPersonality,
    intensity: rideProgress / 100,
  });
  const safePlaySound = useCallback(
    (sound: Parameters<typeof playSound>[0]) => {
      if (DISABLE_RIDE_AUDIO_AND_VOICE) return Promise.resolve();
      return playSound(sound);
    },
    [playSound],
  );
  const safePlayCountdown = useCallback(
    (seconds: number) => {
      if (DISABLE_RIDE_AUDIO_AND_VOICE) return;
      playCountdown(seconds);
    },
    [playCountdown],
  );
  const safeSpeak = useCallback(
    (
      text: string,
      emotion?: Parameters<typeof speak>[1],
    ) => {
      if (DISABLE_RIDE_AUDIO_AND_VOICE) return Promise.resolve();
      return speak(text, emotion);
    },
    [speak],
  );
  const safeStopAudio = useCallback(() => {
    if (DISABLE_RIDE_AUDIO_AND_VOICE) return;
    stopAudio();
  }, [stopAudio]);
  const safeStopVoice = useCallback(() => {
    if (DISABLE_RIDE_AUDIO_AND_VOICE) return;
    stopVoice();
  }, [stopVoice]);
  const safeSetMusicSpeed = useCallback(
    (rate: number) => {
      if (DISABLE_RIDE_AUDIO_AND_VOICE) return;
      setMusicSpeed(rate);
    },
    [setMusicSpeed],
  );

  // AI Instructor State
  const { setResistance } = useUnifiedBle();
  const [aiActive, setAiActive] = useState(false);
  const agentName = classData?.instructor || "Coach";

  // ZK Proof + Privacy
  const {
    claimWithZK,
    isGeneratingProof,
    isSuccess: zkSuccess,
    privacyScore,
    privacyLevel,
    error: zkError,
  } = useZKClaim();
  const {
    finalizeRewards: finalizeChainlinkRewards,
    isVerifying: isChainlinkVerifying,
    isRequestSuccess: isChainlinkRequestSuccess,
    isClaiming: isChainlinkClaiming,
    isVerified: isChainlinkVerified,
    verifiedScore: chainlinkVerifiedScore,
    isSuccess: chainlinkSuccess,
    error: chainlinkError,
  } = useChainlinkVerification();
  const rewardVerificationMode = REWARD_VERIFICATION.mode;
  const useChainlinkRewards = rewardVerificationMode === "chainlink";
  const [completedRideId, setCompletedRideId] = useState<string | null>(null);

  const handleClaimRewards = async () => {
    if (isPracticeMode || !address) return;
    const threshold = classData?.metadata?.rewards?.threshold ?? 150;
    const durationSeconds = Math.max(1, Math.floor(elapsedTime));

    if (useChainlinkRewards) {
      await finalizeChainlinkRewards({
        classId: classId as `0x${string}`,
        threshold,
        duration: durationSeconds,
      });
      return;
    }

    await claimWithZK(
      {
        spinClass: classId as `0x${string}`,
        rider: address,
        rewardAmount: String(classData?.metadata?.rewards?.amount ?? 0),
        classId: classId as `0x${string}`,
      },
      {
        heartRate: telemetryAverages.avgHr || telemetry.heartRate,
        threshold,
        durationSeconds,
        heartRateSamples: telemetrySamples.current.map((sample) => sample.hr),
        avgPower: telemetryAverages.avgPower,
      },
    );
  };

  // Reward mode selection — default to zk-batch, yellow-stream available as beta for wallet users

  // Guest mode — reward selector is disabled; user must connect wallet to earn
  const isGuestMode =
    typeof window !== "undefined" &&
    localStorage.getItem("spin-guest-mode") === "true" &&
    !walletConnected;

  // Training mode: simulator is active in a paid class (rewards disabled but can test experience)
  const isTrainingMode = useSimulator && !isPracticeMode && walletConnected;
  const rewardClaimStatus: RewardClaimStatus | undefined = useMemo(() => {
    return !isPracticeMode && !isTrainingMode
      ? useChainlinkRewards
        ? {
            mode: "chainlink",
            phase: (isChainlinkClaiming
              ? "claiming"
              : isChainlinkVerifying
                ? "requesting"
                : chainlinkSuccess
                  ? "claimed"
                  : isChainlinkVerified
                    ? "ready"
                    : chainlinkError
                      ? "error"
                      : isChainlinkRequestSuccess
                        ? "requested"
                        : "idle") as RewardClaimStatus["phase"],
            privacyScore: 0,
            privacyLevel: "low",
            verifiedScore: chainlinkVerifiedScore,
            error: chainlinkError,
          }
        : {
            mode: "zk",
            phase: (isGeneratingProof
              ? "claiming"
              : zkSuccess
                ? "claimed"
                : zkError
                  ? "error"
                  : "idle") as RewardClaimStatus["phase"],
            privacyScore,
            privacyLevel,
            error: zkError,
          }
      : undefined;
  }, [
    isPracticeMode,
    isTrainingMode,
    useChainlinkRewards,
    isChainlinkClaiming,
    isChainlinkVerifying,
    chainlinkSuccess,
    isChainlinkVerified,
    chainlinkError,
    isChainlinkRequestSuccess,
    chainlinkVerifiedScore,
    isGeneratingProof,
    zkSuccess,
    zkError,
    privacyScore,
    privacyLevel,
  ]);

  useEffect(() => {
    if (!completedRideId || !rewardClaimStatus) return;

    const proofStatus =
      rewardClaimStatus.phase === "claimed"
        ? "claimed"
        : rewardClaimStatus.phase === "ready"
          ? "ready"
          : rewardClaimStatus.phase === "requested"
            ? "requested"
            : rewardClaimStatus.phase === "error"
              ? "failed"
              : "idle";

    updateRideRewardState(
      completedRideId,
      {
        status: proofStatus,
        isVerified:
          rewardClaimStatus.phase === "ready" ||
          rewardClaimStatus.phase === "claimed",
        privacyScore: rewardClaimStatus.privacyScore,
        privacyLevel: rewardClaimStatus.privacyLevel,
        verifiedScore: rewardClaimStatus.verifiedScore,
      },
      {
        attempted: rewardClaimStatus.phase !== "idle",
        status:
          rewardClaimStatus.phase === "claimed"
            ? "confirmed"
            : rewardClaimStatus.phase === "error"
              ? "failed"
              : rewardClaimStatus.phase === "idle"
                ? "skipped"
                : "pending",
      },
    );
  }, [completedRideId, rewardClaimStatus]);

  // Simulated reward ticker for training/guest mode (incentivizes wallet connection)
  const simulatedRewards = useSimulatedRewards({
    isRiding,
    isTrainingMode,
    isGuestMode,
    effortScore: telemetry.effort,
  });

  const { multiGhostState } = useMultiGhost(
    classId as string,
    classData?.route?.route?.coordinates || [],
    telemetry.distance,
    elapsedTime,
    isRiding,
  );

  const socialRiders = multiGhostState;

  // Rewards — mode selectable, defaults to zk-batch
  const rewards = useRewards({
    mode: rewardMode,
    classId: classId as string,
    instructor: (classData?.instructor as `0x${string}`) || "0x0",
    depositAmount: classData?.currentPrice
      ? BigInt(Math.floor(parseFloat(classData.currentPrice) * 1e18))
      : BigInt(0),
  });

  // Mobile experience hooks - wake lock, fullscreen, haptic
  const {
    request: requestWakeLock,
    release: releaseWakeLock,
    isActive: wakeLockActive,
  } = useWakeLock();
  const haptic = useHaptic();

  // Activate wake lock when riding starts on mobile
  // Uses a ref for wakeLockActive to prevent the effect from re-running when
  // the wake lock is acquired (which would create an infinite loop).
  const wakeLockActiveRef = useRef(wakeLockActive);
  wakeLockActiveRef.current = wakeLockActive;
  useEffect(() => {
    if (isRiding && deviceType === "mobile") {
      requestWakeLock();
    } else if (!isRiding && wakeLockActiveRef.current) {
      releaseWakeLock();
    }
  }, [isRiding, deviceType, requestWakeLock, releaseWakeLock]);

  // Demo complete modal state
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [completionSyncStatus, setCompletionSyncStatus] =
    useState<RideSyncStatus>("local_only");
  const [completionPrimaryAction, setCompletionPrimaryAction] = useState<
    "view_history" | "ride_again"
  >("view_history");
  const [demoStats, setDemoStats] = useState({
    duration: 0,
    avgHeartRate: 0,
    maxHeartRate: 0,
    effortScore: 0,
    spinEarned: "0",
    rewardsWereActive: false,
  });

  // Track last spoken beat to avoid repeats
  const lastSpokenBeatRef = useRef<string | null>(null);

  // Track interval transitions for audio cues
  const lastIntervalRef = useRef<number>(-1);

  // Keyboard Shifting (Virtual Gears)
  useEffect(() => {
    if (typeof window === "undefined" || !isRiding) return;

    const totalGears =
      DEFAULT_ROAD_GEARS.front.length * DEFAULT_ROAD_GEARS.rear.length;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        setCurrentGear((prev) => Math.min(totalGears, prev + 1));
        playSound?.("resistanceUp");
      } else if (e.key === "ArrowDown") {
        setCurrentGear((prev) => Math.max(1, prev - 1));
        playSound?.("resistanceDown");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRiding, playSound, setCurrentGear]);

  // Telemetry RAF loop + history + ghost updates are consolidated in useRideTelemetry.

  // Handle BLE metrics updates
  // Uses refs for rewards and telemetry to prevent callback recreation on every
  // telemetry update, which would trigger infinite re-render loops (React #185).
  const rewardsRef = useRef(rewards);
  rewardsRef.current = rewards;
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;
  const isTrainingModeRef = useRef(isTrainingMode);
  isTrainingModeRef.current = isTrainingMode;
  const bleConnectedRef = useRef(bleConnected);
  bleConnectedRef.current = bleConnected;

  const handleBleMetrics = useCallback(
    async (metrics: {
      heartRate?: number;
      power?: number;
      cadence?: number;
      speed?: number;
      effort?: number;
      distance?: number;
      timestamp?: number;
    }) => {
      handleBleMetricsInternal(metrics);

      if (metrics.heartRate || metrics.power) {
        if (!bleConnectedRef.current) setBleConnected(true); // Guard to avoid no-op re-renders
        if (!trackedLiveTelemetryRef.current) {
          trackedLiveTelemetryRef.current = true;
          trackEvent(ANALYTICS_EVENTS.TELEMETRY_LIVE_READY, {
            classId,
            practiceMode: isPracticeMode,
          });
        }
      }

      // Record effort for Yellow rewards (rate-limited; do not block UI)
      // Skip recording in training mode (simulator in paid class) - rewards disabled
      const currentRewards = rewardsRef.current;
      const currentTelemetry = telemetryRef.current;
      if (
        isRidingRef.current &&
        currentRewards.isActive &&
        (metrics.heartRate || metrics.power) &&
        !isTrainingModeRef.current
      ) {
        const now = Date.now();
        const minIntervalMs = deviceType === "mobile" ? 500 : 250; // 2Hz mobile, 4Hz desktop

        if (
          !pendingRewardRecordRef.current &&
          now - lastRewardRecordMsRef.current >= minIntervalMs
        ) {
          pendingRewardRecordRef.current = true;
          lastRewardRecordMsRef.current = now;

          void currentRewards
            .recordEffort({
              timestamp: now,
              heartRate: metrics.heartRate || currentTelemetry.heartRate,
              power: metrics.power || currentTelemetry.power,
              cadence: metrics.cadence || currentTelemetry.cadence,
            })
            .catch((err) => {
              // Best-effort
              console.debug("[Ride] Failed to record effort:", err);
            })
            .finally(() => {
              pendingRewardRecordRef.current = false;
            });
        }
      }
    },
    [
      classId,
      deviceType,
      handleBleMetricsInternal,
      isPracticeMode,
    ],
  );

  // Handle simulator metrics updates
  const handleSimulatorMetrics = useCallback(
    (metrics: {
      heartRate: number;
      power: number;
      cadence: number;
      speed: number;
      effort: number;
      distance?: number;
      timestamp?: number;
    }) => {
      handleSimulatorMetricsInternal(metrics);

      // Advance ride progress cadence-weighted: no pedaling = no progress.
      // Use refs for isRiding/classData to avoid stale closures in the metrics callback.
      // Simulator uses compressed time (3-min effective duration) so progress is visually meaningful.
      const currentClassData = classDataRef.current;
      if (isRidingRef.current && currentClassData && metrics.cadence > 0) {
        const TARGET_CADENCE = 80;
        const cadenceRatio = Math.min(metrics.cadence / TARGET_CADENCE, 1.5);
        const tickSeconds = 0.5 * cadenceRatio;

        // Compress ride duration for simulator: map real elapsed time to full ride duration
        // so a ~3 minute pedaling session completes the route visually.
        const SIMULATOR_DURATION_SECONDS = 3 * 60; // 3 minutes of pedaling = full route
        const realDuration = (currentClassData.metadata?.duration || 45) * 60;
        const timeScale = realDuration / SIMULATOR_DURATION_SECONDS;
        const scaledTick = tickSeconds * timeScale;

        setElapsedTime((prev) => {
          const newTime = prev + scaledTick;
          const newProgress = Math.min((newTime / realDuration) * 100, 100);
          setRideProgress(newProgress);

          if (newProgress >= 100) {
            isRidingRef.current = false;
            setIsRiding(false);
          }

          return newTime;
        });
      }
    },
    [
      classDataRef,
      handleSimulatorMetricsInternal,
      isRidingRef,
      setElapsedTime,
      setIsRiding,
      setRideProgress,
    ],
  );

  // Auto-adjust view mode only while following system defaults.
  useEffect(() => {
    if (viewModePreferenceRef.current === "system") {
      setViewMode(
        getSystemViewMode(deviceType, performanceTier, prefersReducedMotion),
      );
    }
  }, [deviceType, orientation, performanceTier, prefersReducedMotion]);

  useEffect(() => {
    if (isRiding || rideProgress > 0 || trackedEntryViewRef.current) return;
    trackedEntryViewRef.current = true;
    trackEvent(ANALYTICS_EVENTS.RIDE_ENTRY_VIEWED, {
      classId,
      practiceMode: isPracticeMode,
    });
  }, [classId, isPracticeMode, isRiding, rideProgress]);

  // Simulate telemetry when BLE not connected and not using simulator (Demo/Guest mode only)
  useEffect(() => {
    if (
      !isRiding ||
      bleConnected ||
      useSimulator ||
      (!isPracticeMode && !isGuestMode)
    )
      return;

    const interval = setInterval(() => {
      const prev = telemetryRawRef.current;
      const newTelemetry = {
        ...prev,
        heartRate: prev.heartRate || 120 + Math.floor(Math.random() * 40),
        power: prev.power || 150 + Math.floor(Math.random() * 100),
        cadence: prev.cadence || 80 + Math.floor(Math.random() * 20),
        speed: prev.speed || 25 + Math.random() * 10,
        effort: prev.effort || 140 + Math.floor(Math.random() * 30),
      };
      telemetryRawRef.current = newTelemetry;

      // Collect samples for averages
      telemetrySamples.current.push({
        hr: newTelemetry.heartRate,
        power: newTelemetry.power,
        effort: newTelemetry.effort,
      });
      if (telemetrySamples.current.length > MAX_TELEMETRY_SAMPLES) {
        telemetrySamples.current.splice(
          0,
          telemetrySamples.current.length - MAX_TELEMETRY_SAMPLES,
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    isRiding,
    bleConnected,
    useSimulator,
    isPracticeMode,
    isGuestMode,
    telemetryRawRef,
    telemetrySamples,
  ]);

  // Also collect BLE and simulator telemetry samples
  // Uses refs to read telemetry so the effect doesn't re-run on every telemetry change,
  // preventing the infinite re-render loop (React #185).
  const telemetryRefForSamples = useRef(telemetry);
  telemetryRefForSamples.current = telemetry;
  useEffect(() => {
    if (!isRiding || (!bleConnected && !useSimulator)) return;
    const id = setInterval(() => {
      const t = telemetryRefForSamples.current;
      if (t.heartRate <= 0) return;
      telemetrySamples.current.push({
        hr: t.heartRate,
        power: t.power,
        effort: t.effort,
      });
      if (telemetrySamples.current.length > MAX_TELEMETRY_SAMPLES) {
        telemetrySamples.current.splice(
          0,
          telemetrySamples.current.length - MAX_TELEMETRY_SAMPLES,
        );
      }
      refreshTelemetryAverages();
    }, 1000);
    return () => clearInterval(id);
  }, [
    isRiding,
    bleConnected,
    useSimulator,
    refreshTelemetryAverages,
    telemetrySamples,
  ]);

  const [marketStats, setMarketStats] = useState({
    ticketsSold: 0,
    revenue: 0,
    capacity: 50,
  });

  // Simulate market activity for Phase 3 autonomy (Demo/Guest mode only)
  // Uses a ref to read telemetry.effort inside the interval so the effect
  // doesn't re-run on every telemetry change, preventing the infinite re-render loop.
  const telemetryEffortRef = useRef(telemetry.effort);
  telemetryEffortRef.current = telemetry.effort;
  useEffect(() => {
    if (!isRiding || (!isPracticeMode && !isGuestMode)) return;
    const interval = setInterval(() => {
      setMarketStats((prev) => {
        // More "intense" classes drive more late-ticket sales
        const intensityFactor = telemetryEffortRef.current / 100;
        const newTickets = Math.random() < 0.1 + intensityFactor * 0.2 ? 1 : 0;
        return {
          ...prev,
          ticketsSold: Math.min(prev.capacity, prev.ticketsSold + newTickets),
          revenue: prev.revenue + newTickets * 15, // $15 per ticket
        };
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [isRiding, isPracticeMode, isGuestMode]);

  // agentMetrics is passed to useWorkoutAgent/useAiInstructor.
  // Previously depended on `telemetry` which changes 2-4x/sec from the RAF loop,
  // creating a new object every update and cascading into infinite re-render loops (React #185).
  // Now we use a ref and only update the object when the component actually reads it.
  const telemetryForAgentRef = useRef(telemetry);
  telemetryForAgentRef.current = telemetry;
  // Stable object identity — hooks read metrics via their own metricsRef internally.
  // WARNING: Do NOT pass this to React.memo-wrapped components — they will never
  // detect changes since the object reference is always the same.
  const agentMetrics = useMemo(() => ({
    get heartRate() { return telemetryForAgentRef.current.heartRate; },
    get power() { return telemetryForAgentRef.current.power; },
    get cadence() { return telemetryForAgentRef.current.cadence; },
    get speed() { return telemetryForAgentRef.current.speed; },
    get effort() { return telemetryForAgentRef.current.effort; },
    get wBal() { return telemetryForAgentRef.current.wBal; },
    get wBalPercentage() { return telemetryForAgentRef.current.wBalPercentage || 100; },
    get distance() { return telemetryForAgentRef.current.distance; },
    get currentGear() { return telemetryForAgentRef.current.currentGear; },
    get gearRatio() { return telemetryForAgentRef.current.gearRatio; },
    get resistance() { return telemetryForAgentRef.current.resistance; },
    get timestamp() { return telemetryForAgentRef.current.timestamp; },
  }), []);

  const stableSetResistance = useCallback(
    async (level: number) => {
      return await setResistance(level);
    },
    [setResistance],
  );

  const instructorProfile = useMemo(
    () =>
      classData?.metadata
        ? { name: classData.metadata.instructor, specialties: [] as string[] }
        : undefined,
    [classData?.metadata],
  );

  const {
    aiLogs,
    reasonerState,
    lastDecision,
    thoughtLog,
    socialEvents,
    handleHighFive,
  } = useWorkoutAgent({
    agentName: classData?.metadata?.instructor || "Coach Atlas",
    personality:
      (classData?.metadata?.ai?.personality as
        | "zen"
        | "drill-sergeant"
        | "data") ?? "drill-sergeant",
    sessionObjectId: classId,
    metrics: agentMetrics,
    currentInterval,
    isEnabled: aiActive && !DISABLE_RIDE_AUDIO_AND_VOICE,
    setResistance: stableSetResistance,
    playSound: safePlaySound,
    instructorProfile,
    marketStats, // Phase 3: Revenue optimization
  });

  // flowIntensity uses refs to read telemetry so it doesn't recalculate on every
  // telemetry update. Instead, it's driven by a state update from a low-frequency interval.
  const flowIntensityMemosRef = useRef({ cadence: telemetry.cadence, effort: telemetry.effort, interval: currentInterval });
  flowIntensityMemosRef.current = { cadence: telemetry.cadence, effort: telemetry.effort, interval: currentInterval };
  const [flowIntensity, setFlowIntensity] = useState(0);
  useEffect(() => {
    if (!isRiding) return;
    // Set initial value immediately to avoid 500ms flash at zero intensity
    const init = flowIntensityMemosRef.current;
    setFlowIntensity(!init.interval?.targetRpm ? init.effort / 100 : Math.min(1, init.cadence / init.interval.targetRpm[0]));
    const id = setInterval(() => {
      const { cadence, effort, interval } = flowIntensityMemosRef.current;
      if (!interval?.targetRpm) {
        setFlowIntensity(effort / 100);
      } else {
        const [min] = interval.targetRpm;
        setFlowIntensity(Math.min(1, cadence / min));
      }
    }, 500);
    return () => clearInterval(id);
  }, [isRiding]);

  const flowColor = useMemo(() => {
    if (currentInterval?.phase === "sprint") return "bg-rose-500";
    if (currentInterval?.phase === "recovery") return "bg-sky-500";
    return "bg-yellow-500";
  }, [currentInterval?.phase]); // stable — phase only changes on interval transitions

  // Biometric Music Sync
  // Uses a ref to read telemetry.cadence inside an interval so the effect
  // doesn't re-run on every cadence change, preventing the infinite re-render loop.
  const telemetryCadenceRef = useRef(telemetry.cadence);
  telemetryCadenceRef.current = telemetry.cadence;
  const currentIntervalRef2 = useRef(currentInterval);
  currentIntervalRef2.current = currentInterval;
  useEffect(() => {
    if (!isRiding) return;
    const id = setInterval(() => {
      const ci = currentIntervalRef2.current;
      const cadence = telemetryCadenceRef.current;
      if (!cadence || !ci?.targetRpm) return;
      const [minRpm] = ci.targetRpm;
      const rate = Math.max(0.85, Math.min(1.2, cadence / minRpm));
      safeSetMusicSpeed(rate);
    }, 2000);
    return () => clearInterval(id);
  }, [isRiding, safeSetMusicSpeed]);

  const stableStoryBeats = useMemo(
    () => classData?.route?.route.storyBeats || [],
    [classData?.route?.route.storyBeats],
  );

  // 2. Consolidated Workout Coaching Logic (Phase 1/3)
  const { lastCoachMessage: consolidatedCoachMessage } = useRideCoach({
    isRiding,
    aiActive,
    workoutPlan,
    currentIntervalIndex,
    currentInterval,
    intervalRemaining,
    telemetryCadence: telemetry.cadence,
    aiLogs,
    isSpeaking: DISABLE_RIDE_AUDIO_AND_VOICE ? false : isSpeaking,
    playSound: safePlaySound,
    speak: safeSpeak,
    rideProgress,
    storyBeats: stableStoryBeats,
    lastDecision,
  });

  const [showMilestone, setShowMilestone] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);

  // Milestone Celebration logic
  // Uses a ref to read telemetry.effort inside an interval so the effect
  // doesn't re-run on every effort change, preventing the infinite re-render loop.
  const milestoneHapticRef = useRef(haptic);
  milestoneHapticRef.current = haptic;
  const milestonePlaySoundRef = useRef(safePlaySound);
  milestonePlaySoundRef.current = safePlaySound;
  useEffect(() => {
    if (!isRiding) return;
    const id = setInterval(() => {
      if (telemetryEffortRef.current > 900 && !trackedMilestoneRef.current) {
        trackedMilestoneRef.current = true;
        setShowMilestone({
          title: "ELITE EFFORT",
          subtitle: "You just crossed 900 effort points!",
        });
        milestoneHapticRef.current.success();
        milestonePlaySoundRef.current("achievement");
        setTimeout(() => setShowMilestone(null), 5000);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [isRiding]);

  useEffect(() => {
    const practiceAiEnabled =
      isPracticeMode && Boolean(practiceConfig?.aiEnabled);
    setAiActive(
      !DISABLE_RIDE_AUDIO_AND_VOICE &&
        isRiding &&
        (practiceAiEnabled || Boolean(classData?.metadata?.ai?.enabled)),
    );
  }, [
    isRiding,
    isPracticeMode,
    practiceConfig?.aiEnabled,
    classData?.metadata?.ai?.enabled,
    setAiActive,
  ]);

  const handleEnableSimulatorFromModal = useCallback(() => {
    setShowNoBikeModal(false);
    setUseSimulator(true);
    setShowKeyboardHints(true);
    setConnectionHint(null);
  }, []);

  const startRide = async () => {
    const telemetryReady = bleConnected || useSimulator;
    if (!telemetryReady) {
      setShowNoBikeModal(true);
      trackEvent(ANALYTICS_EVENTS.RIDE_START_BLOCKED_NO_TELEMETRY, {
        classId,
        practiceMode: isPracticeMode,
      });
      return;
    }

    trackEvent(ANALYTICS_EVENTS.RIDE_STARTED, {
      classId,
      source: bleConnected ? "live-bike" : "simulator",
      practiceMode: isPracticeMode,
    });

    setIsStarting(true);
    safePlayCountdown(3);

    // Pre-ride ClearNode connectivity check for Yellow mode
    if (rewardMode === "yellow-stream" && !rewards.clearNodeConnected) {
      // Non-blocking warning — ride can still start but rewards may not stream
      console.warn(
        "[Ride] Yellow mode selected but ClearNode is not connected. Rewards may not stream.",
      );
    }

    // Initialize rewards (gracefully handles no-wallet for zk-batch)
    // Skip in training mode - simulator in paid class doesn't earn rewards
    if (!isTrainingMode) {
      try {
        await rewards.startEarning();
        console.log("[Ride] Rewards channel opened, mode:", rewardMode);
      } catch (err) {
        // Non-blocking — guest users can still ride without earning
        console.warn("[Ride] Rewards init skipped:", err);
      }
    } else {
      console.log("[Ride] Training mode - rewards disabled");
    }

    // Start ride after countdown finishes
    setTimeout(() => {
      isRidingRef.current = true;
      setIsRiding(true);
      setIsStarting(false);
      setRideProgress(0);
      setElapsedTime(0);
      resetTelemetry();
      lastSpokenBeatRef.current = null;
      lastIntervalRef.current = -1;
      trackedCompletionRef.current = false;
      safeSpeak("Let's go!", "intense");
    }, 3000);
  };

  const pauseRide = useCallback(() => {
    isRidingRef.current = false;
    setIsRiding(false);
    safePlaySound("recover");
  }, [safePlaySound]);

  // Memoize togglePauseResume to prevent keyboard handler from being recreated
  // on every render, which would cause the keydown effect to re-run every render
  // and contribute to React #185 infinite re-render loops.
  // Uses refs for isRiding/rideProgress so the callback identity stays stable.
  const rideProgressRef = useRef(rideProgress);
  rideProgressRef.current = rideProgress;
  const togglePauseResume = useCallback(() => {
    if (isRidingRef.current) {
      pauseRide();
    } else if (rideProgressRef.current > 0 && rideProgressRef.current < 100) {
      // Resume ride
      isRidingRef.current = true;
      setIsRiding(true);
      safePlaySound("resistanceUp");
    }
  }, [pauseRide, safePlaySound]);

  const exitRide = async () => {
    setIsExiting(true);
    safeStopAudio();
    safeStopVoice();
    setAiActive(false);

    // Calculate demo stats
    const samples = telemetrySamples.current;
    const avgHR =
      samples.length > 0
        ? Math.round(samples.reduce((sum, s) => sum + s.hr, 0) / samples.length)
        : 0;
    const maxHR =
      samples.length > 0 ? Math.max(...samples.map((s) => s.hr)) : 0;

    // Finalize rewards logic
    let spinEarned = "0";
    const effortScore = Math.min(1000, Math.round((avgHR / 200) * 1000));

    // Calculate potential reward based on IncentiveEngine.sol logic:
    // Base: 10 SPIN, Bonus: (effortScore * 90) / 1000
    const potentialReward = 10 + (effortScore * 90) / 1000;

    if (rewards.isActive) {
      try {
        const result = await rewards.finalizeRewards();
        console.log("[Ride] Rewards finalized:", result);
        spinEarned = result.amount
          ? (Number(result.amount) / 1e18).toFixed(1)
          : "0";
      } catch (err) {
        console.warn("[Ride] Failed to finalize rewards:", err);
      }
    }

    // Use actual reward if earned, otherwise show potential for guest/practice mode
    const displaySpin =
      spinEarned !== "0" ? spinEarned : potentialReward.toFixed(1);

    // Show demo complete modal for practice mode
    const telemetrySource = bleConnected
      ? "live-bike"
      : isPracticeMode && useSimulator
        ? "simulator"
        : "estimated";

    const threshold = classData?.metadata?.rewards?.threshold ?? 180;
    const summaryId = `${classId}-${Date.now()}`;
    const zoneThreshold = Math.max(160, Math.round(threshold * 0.8));
    const zoneSprint = Math.max(190, Math.round(threshold * 1.05));
    const hrValues = samples.map((sample) => sample.hr);
    const zoneCounts = hrValues.reduce(
      (acc, hr) => {
        if (hr >= zoneSprint) acc.sprint += 1;
        else if (hr >= zoneThreshold) acc.threshold += 1;
        else if (hr >= 120) acc.endurance += 1;
        else acc.recovery += 1;
        return acc;
      },
      { recovery: 0, endurance: 0, threshold: 0, sprint: 0 },
    );
    const totalSamples = Math.max(1, samples.length);

    const canonicalSummary = createCanonicalRideSummary({
      id: summaryId,
      riderId: address ?? "guest",
      classId,
      className: classData?.name || practiceConfig?.name || "SpinChain Ride",
      instructor:
        classData?.instructor || practiceConfig?.instructor || agentName,
      completedAt: Date.now(),
      durationSec: elapsedTime,
      avgHeartRate: avgHR,
      avgPower: telemetryAverages.avgPower,
      avgEffort: telemetryAverages.avgEffort,
      spinEarned: Number(displaySpin),
      telemetrySource,
      effortTier:
        telemetryAverages.avgEffort >= 800
          ? "platinum"
          : telemetryAverages.avgEffort >= 650
            ? "gold"
            : telemetryAverages.avgEffort >= 500
              ? "silver"
              : "bronze",
      zones: {
        recovery: Math.round((zoneCounts.recovery / totalSamples) * 100),
        endurance: Math.round((zoneCounts.endurance / totalSamples) * 100),
        threshold: Math.round((zoneCounts.threshold / totalSamples) * 100),
        sprint: Math.round((zoneCounts.sprint / totalSamples) * 100),
      },
      proof: {
        mode: rewardMode === "sui-native" ? "none" : rewardMode,
        status:
          rewardClaimStatus?.phase === "claimed"
            ? "claimed"
            : rewardClaimStatus?.phase === "ready"
              ? "ready"
              : rewardClaimStatus?.phase === "requested"
                ? "requested"
                : rewardClaimStatus?.phase === "error"
                  ? "failed"
                  : "idle",
        isVerified: useChainlinkRewards ? chainlinkSuccess : zkSuccess,
        privacyScore,
        privacyLevel,
        verifiedScore: rewardClaimStatus?.verifiedScore,
      },
      settlement: {
        attempted: walletConnected,
        status: walletConnected
          ? useChainlinkRewards
            ? chainlinkSuccess
              ? "confirmed"
              : "pending"
            : zkSuccess
              ? "confirmed"
              : "pending"
          : "skipped",
      },
    });
    const saved = saveRideSummary(canonicalSummary);
    void persistRideSummaryToWalrus(canonicalSummary);
    const latest =
      saved.find((ride) => ride.id === canonicalSummary.id) ?? canonicalSummary;
    const queued = enqueueRideSync(latest);
    setCompletedRideId(summaryId);
    setCompletionSyncStatus(queued.sync.status);
    setCompletionPrimaryAction(getRetentionSignals(saved).ctaPrimary);
    void processRideSyncQueue();

    if (isPracticeMode) {
      setDemoStats({
        duration: elapsedTime,
        avgHeartRate: avgHR,
        maxHeartRate: maxHR,
        effortScore,
        spinEarned: displaySpin,
        rewardsWereActive: true, // Show "You would have earned" with the calculated amount
      });
      setIsExiting(false);
      setShowDemoModal(true);
    } else {
      router.push("/rider/journey?completed=true");
    }
  };

  const handleDemoModalClose = () => {
    setShowDemoModal(false);
    router.push("/rider");
  };

  // Keyboard shortcuts for focus mode and ride controls
  const handleFocusKeyboard = useRideFocusKeyboard({
    onPauseResume: togglePauseResume,
  });

  useEffect(() => {
    window.addEventListener("keydown", handleFocusKeyboard);
    return () => window.removeEventListener("keydown", handleFocusKeyboard);
  }, [handleFocusKeyboard]);

  // Add ride-active class to body for Tab key behavior
  useEffect(() => {
    if (isRiding) {
      document.body.classList.add("ride-active");
    } else {
      document.body.classList.remove("ride-active");
    }
    return () => {
      document.body.classList.remove("ride-active");
    };
  }, [isRiding]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Stable callbacks extracted from inline arrows to prevent new function identity every render
  const handleSnapPanel = useCallback(
    (key: Parameters<typeof panelState.snapPanelToEdge>[0]) =>
      panelStateRef.current.snapPanelToEdge(key, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    [],
  );

  const handleResetPrefs = useCallback(() => {
    try {
      window.localStorage.removeItem("spinchain:ride:viewMode");
      window.localStorage.removeItem("spinchain:ride:hudMode");
      useRideFocusMode
        .getState()
        .initForDevice(deviceType === "tablet" ? "desktop" : deviceType);
    } catch {
      /* ignore */
    }
    viewModePreferenceRef.current = "system";
    panelStateRef.current.resetLayout();
    trackEvent(ANALYTICS_EVENTS.WIDGET_LAYOUT_RESET, {
      phase: isRidingRefForAnalytics.current
        ? "in_ride"
        : rideProgressRefForAnalytics.current > 0
          ? "post_ride"
          : "pre_ride",
      viewMode: viewModeRef.current,
      deviceType,
    });
  }, [deviceType]);

  const handleCollapseToggle = useCallback(() => {
    const ps = panelStateRef.current;
    if (isRidingRefForAnalytics.current && viewModeRef.current === "immersive") {
      cycleRideWidgetsMode();
      return;
    }
    if (ps.isAllCollapsed) ps.expandAll();
    else ps.collapseAll();
  }, [cycleRideWidgetsMode]);

  // Memoize classData fallback to avoid new object literal every render
  const classDataForViz = useMemo(
    () =>
      (classData as {
        name: string;
        instructor: string;
        route?: { route?: { storyBeats?: StoryBeat[] } } | null;
        metadata?: EnhancedClassMetadata | null;
      }) ?? {
        name: practiceConfig?.name || "SpinChain Ride",
        instructor: practiceConfig?.instructor || agentName,
      },
    [classData, practiceConfig?.name, practiceConfig?.instructor, agentName],
  );

  useEffect(() => {
    if (rideProgress < 100 || trackedCompletionRef.current) return;
    trackedCompletionRef.current = true;
    trackEvent(ANALYTICS_EVENTS.RIDE_COMPLETED, {
      classId,
      source: bleConnected
        ? "live-bike"
        : isPracticeMode && useSimulator
          ? "simulator"
          : "estimated",
      practiceMode: isPracticeMode,
    });
  }, [bleConnected, classId, isPracticeMode, rideProgress, useSimulator]);

  if (isLoading && !isPracticeMode) {
    return (
      <RideLoading
        classId={classId}
        isPracticeMode={isPracticeMode}
        practiceClassName={practiceConfig?.name}
        rewardModeLabel={
          rewardMode === "yellow-stream"
            ? "Yellow Stream"
            : rewardMode === "zk-batch"
              ? "ZK Batch"
              : "Sui Native"
        }
        loadStartedAt={loadStartedAt}
        onPracticeMode={() => router.push("/rider?mode=practice")}
        onBack={() => router.push("/rider")}
      />
    );
  }

  if (!classData || !classData.route) {
    return <RideNotFound onExit={exitRide} />;
  }

  return (
    <RideGestureZone
      enabled={deviceType === "mobile" && isRiding}
      onHaptic={haptic.trigger}
    >
      <div
        className="fixed inset-0 bg-black"
        style={{
          height: deviceType === "mobile" ? `${viewportHeight}px` : "100vh",
        }}
      >
        <div className="absolute top-2 left-2 right-2 z-50">
          <NetworkStatusBanner />
        </div>

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
            classData={classDataForViz}
            workoutPlan={workoutPlan}
            currentIntervalIndex={currentIntervalIndex}
            currentInterval={currentInterval}
            intervalProgress={intervalProgress}
            routeTheme={routeTheme}
            searchParams={searchParams}
            panelState={panelState.state}
            panelPositions={panelState.positions}
            onTogglePanel={handleTogglePanel}
            onSetPanelPosition={panelState.setPanelPosition}
            onSnapPanel={handleSnapPanel}
            onTrackWidgetInteraction={trackWidgetInteraction}
            onExpandOne={panelState.expandOne}
            onHaptic={haptic.trigger}
            isPracticeMode={isPracticeMode}
            recentPowerHistory={recentPowerHistory}
          />
        </SectionErrorBoundary>

        <RideHUDOverlay
          classData={classData}
          isPracticeMode={isPracticeMode}
          routeIsGenerated={classData?.routeIsGenerated}
          isRiding={isRiding}
          isExiting={isExiting}
          rideProgress={rideProgress}
          isTrainingMode={isTrainingMode}
          isGuestMode={isGuestMode}
          useSimulator={useSimulator}
          bleConnected={bleConnected}
          walletConnected={walletConnected}
          rewardMode={rewardMode}
          rewardsFormattedReward={rewards.formattedReward}
          rewardsIsActive={rewards.isActive}
          rewardsClearNodeConnected={rewards.clearNodeConnected}
          deviceType={deviceType}
          simulatedReward={simulatedRewards}
          telemetryHistory={telemetryHistory}
          ghostState={ghostState}
          currentInterval={currentInterval}
          aiLogs={aiLogs}
          aiActive={aiActive}
          agentName={agentName}
          reasonerState={reasonerState}
          lastDecision={lastDecision}
          thoughtLog={thoughtLog}
          isSpeaking={isSpeaking}
          widgetsVisible={widgetsVisible}
          panelState={panelState.state}
          elapsedTime={elapsedTime}
          connectionHint={connectionHint}
          telemetryEffort={telemetry.effort}
          telemetryCadence={telemetry.cadence}
          workoutPlan={workoutPlan}
          currentIntervalIndex={currentIntervalIndex}
          intervalProgress={intervalProgress}
          intervalRemaining={intervalRemaining}
          rewardsStreamState={rewards.streamState ?? null}
          rewardsMode={rewards.mode}
          orientation={orientation}
          onSetUseSimulator={setUseSimulator}
          onSetRewardMode={setRewardMode}
          onExitRide={exitRide}
          onResetPrefs={handleResetPrefs}
          onCollapseToggle={handleCollapseToggle}
          isAllCollapsed={
            isRiding && viewMode === "immersive"
              ? widgetsMode !== "expanded"
              : panelState.isAllCollapsed
          }
          onTogglePanel={handleTogglePanel}
          onStartRide={startRide}
          onPauseRide={pauseRide}
          onSetWorkoutPlan={setWorkoutPlan}
          onSetUseSimulator2={setUseSimulator}
          onBleMetrics={handleBleMetrics}
          onSimulatorMetrics={handleSimulatorMetrics}
          onHaptic={haptic.trigger}
          formatTime={formatTime}
          trackWidgetInteraction={trackWidgetInteraction}
          cycleRideWidgetsMode={cycleRideWidgetsMode}
          multiGhostState={multiGhostState}
          socialRiders={socialRiders}
        />

        <RiderSocialFeed events={socialEvents} onHighFive={handleHighFive} />

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

        {/* Live Settlement Stream visualizer */}
        <SettlementStream
          isActive={
            isRiding && rewards.mode === "yellow-stream" && rewards.isActive
          }
          accumulated={Number(rewards.accumulatedReward)}
          rate={rewards.streamingRate ? Number(rewards.streamingRate) : 0}
        />

        <CoachMessageOverlay
          message={isRiding ? consolidatedCoachMessage : null}
          phase={currentInterval?.phase}
        />

        {/* Sprint flash border — pulses red on sprint phase entry */}
        {isRiding && currentInterval?.phase === "sprint" && (
          <div className="absolute inset-0 pointer-events-none rounded-none border-4 border-red-500/60 animate-pulse" />
        )}

        <RideModals
          rideProgress={rideProgress}
          isPracticeMode={isPracticeMode}
          isTrainingMode={isTrainingMode}
          isRiding={isRiding}
          elapsedTime={elapsedTime}
          telemetryAverages={telemetryAverages}
          bleConnected={bleConnected}
          useSimulator={useSimulator}
          classId={classId}
          classData={classData}
          practiceConfig={practiceConfig}
          rewardsFormattedReward={rewards.formattedReward}
          handleClaimRewards={handleClaimRewards}
          rewardClaimStatus={rewardClaimStatus}
          completionSyncStatus={completionSyncStatus}
          completionPrimaryAction={completionPrimaryAction}
          showMilestone={showMilestone}
          showNoBikeModal={showNoBikeModal}
          showKeyboardHints={showKeyboardHints}
          showDemoModal={showDemoModal}
          demoStats={demoStats}
          showTutorial={showTutorial}
          tutorialStep={tutorialStep}
          agentName={agentName}
          aiPersonality={aiPersonality || "data"}
          _rewardMode={rewardMode}
          _walletConnected={walletConnected}
          ridePointsRef={ridePointsRef}
          router={router}
          onExitRide={exitRide}
          onEnableSimulatorFromModal={handleEnableSimulatorFromModal}
          onDismissNoBike={() => setShowNoBikeModal(false)}
          onDismissKeyboardHints={() => setShowKeyboardHints(false)}
          onDemoModalClose={handleDemoModalClose}
          onNextTutorial={nextTutorial}
          onDismissTutorial={dismissTutorial}
          onSimulatorMetrics={handleSimulatorMetrics}
        />
      </div>
    </RideGestureZone>
  );
}
