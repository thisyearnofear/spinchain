"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useClass } from "../../../hooks/evm/use-class-data";
import { usePracticeConfig } from "../../../hooks/ride/use-practice-config";
import { useRideLifecycle } from "../../../hooks/ride/use-ride-lifecycle";
import { useAccount } from "wagmi";
import { usePanelState } from "../../../hooks/ui/use-panel-state";
import {
  useRideTutorial,
} from "../../../components/features/ride/ride-tutorial";
import {
  RideLoading,
  RideNotFound,
} from "../../../components/features/ride/ride-loading";
import { RideVisualization } from "../../../components/features/ride/ride-visualization";
import { RideHUDOverlay } from "../../../components/features/ride/ride-hud-overlay";
import { RideModals } from "../../../components/features/ride/ride-modals";
import type { RewardClaimStatus } from "../../../components/features/ride/ride-completion";
import type { StoryBeat } from "../../../components/features/route/route-visualizer";
import { useSimulatedRewards } from "../../../hooks/ride/use-simulated-rewards";
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
import { useHaptic } from "../../../hooks/use-haptic";
import {
  type WorkoutPlan,
  PHASE_TO_THEME,
  PRESET_WORKOUTS,
  getCurrentInterval,
  getIntervalProgress,
  getIntervalRemaining,
} from "../../../lib/workout-plan";
import {
  calculateNextWBal,
  DEFAULT_WBAL_CONFIG,
  getWBalPercentage,
  getGearRatio,
  calculateVirtualSpeed,
  DEFAULT_ROAD_GEARS,
  type WBalConfig,
} from "../../../lib/analytics/physiological-models";
import {
  type RideRecordPoint,
} from "../../../lib/analytics/ride-recorder";
import {
  calculateGhostState,
  fetchGhostWithFallback,
  type GhostPerformance,
  type GhostState,
} from "../../../lib/analytics/ghost-service";
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

function getSystemHudMode(
  deviceType: "mobile" | "tablet" | "desktop",
  orientation: "portrait" | "landscape",
  prefersReducedMotion: boolean,
): "full" | "compact" | "minimal" {
  if (prefersReducedMotion) return "minimal";
  if (deviceType === "mobile") return "compact";
  if (deviceType === "tablet")
    return orientation === "portrait" ? "compact" : "full";
  return "full";
}

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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "c" || e.key === "C") {
        // Only toggle if not in an input field
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
          return;
        e.preventDefault();
        if (panelState.isAllCollapsed) {
          panelState.expandAll();
        } else {
          panelState.collapseAll();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panelState]);

  // Persisted HUD preference (client-only)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("spinchain:ride:hudMode");
      if (stored === "full" || stored === "compact" || stored === "minimal") {
        hudModePreferenceRef.current = "stored";
        setHudMode(stored);
      }
    } catch {
      // ignore
    }
  }, []);
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

  const applyViewMode = (
    next: "immersive" | "focus",
    source: "system" | "manual",
  ) => {
    setViewMode(next);
    viewModePreferenceRef.current = source;
    if (source === "manual") {
      try {
        window.localStorage.setItem("spinchain:ride:viewMode", next);
      } catch {
        // ignore
      }
    }
  };

  const applyHudMode = (
    next: "full" | "compact" | "minimal",
    source: "system" | "manual",
  ) => {
    setHudMode(next);
    hudModePreferenceRef.current = source;
    if (source === "manual") {
      try {
        window.localStorage.setItem("spinchain:ride:hudMode", next);
      } catch {
        // ignore
      }
    }
  };

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

  const [hudMode, setHudMode] = useState<"full" | "compact" | "minimal">(
    "full",
  );
  const hudModePreferenceRef = useRef<"system" | "stored" | "manual">("system");
  const viewModePreferenceRef = useRef<"system" | "stored" | "manual">(
    "system",
  );

  // Mobile accordion: when expanding a panel on mobile, collapse others (one at a time)
  const handleTogglePanel = useCallback(
    (key: Parameters<typeof panelState.toggle>[0]) => {
      if (deviceType === "mobile") {
        const isCurrentlyExpanded = panelState.state[key] === "expanded";
        if (isCurrentlyExpanded) {
          panelState.collapse(key);
        } else {
          panelState.expandOne(key);
        }
      } else {
        panelState.toggle(key);
      }
    },
    [deviceType, panelState],
  );

  useEffect(() => {
    if (isRiding) {
      panelState.startRideLayout();
    } else {
      panelState.endRideLayout();
    }
  }, [isRiding, panelState]);

  const widgetsVisible =
    !isRiding || panelState.state.mobileRideWidgets !== "minimized";
  const widgetsMode = panelState.state.mobileRideWidgets;

  const trackWidgetInteraction = useCallback(
    (
      action: "toggle" | "minimize" | "restore" | "drag",
      panel: keyof typeof panelState.state,
    ) => {
      const phase = isRiding
        ? "in_ride"
        : rideProgress > 0
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
        viewMode,
        deviceType,
        panelMode: panelState.state[panel],
      });
    },
    [deviceType, isRiding, panelState, rideProgress, viewMode],
  );

  const cycleRideWidgetsMode = useCallback(() => {
    const nextMode =
      widgetsMode === "expanded"
        ? "collapsed"
        : widgetsMode === "collapsed"
          ? "minimized"
          : "expanded";
    panelState.setMobileRideWidgetsMode(nextMode);
    trackWidgetInteraction(
      nextMode === "minimized"
        ? "minimize"
        : nextMode === "expanded"
          ? "restore"
          : "toggle",
      "mobileRideWidgets",
    );
  }, [panelState, trackWidgetInteraction, widgetsMode]);

  // Onboarding Tutorial (extracted to reusable hook + component)
  const {
    showTutorial,
    tutorialStep,
    nextStep: nextTutorial,
    dismiss: dismissTutorial,
  } = useRideTutorial();

  // Auto-start ride in demo mode
  useEffect(() => {
    if (bleConnected || useSimulator) {
      setConnectionHint(null);
    }
  }, [bleConnected, isPracticeMode, useSimulator]);

  // Telemetry (buffer raw updates in refs; commit to React state at a UI rate for mobile perf)
  const [telemetry, setTelemetry] = useState({
    heartRate: 0,
    power: 0,
    cadence: 0,
    speed: 0,
    effort: 0,
    wBal: DEFAULT_WBAL_CONFIG.wPrime,
    wBalPercentage: 100,
    currentGear: 10,
    gearRatio: 1.0,
    distance: 0,
    resistance: 0,
    timestamp: Date.now(),
  });
  const [telemetryHistory, setTelemetryHistory] = useState<{
    power: number[];
    cadence: number[];
    heartRate: number[];
  }>({
    power: [],
    cadence: [],
    heartRate: [],
  });
  const [recentPowerHistory, setRecentPowerHistory] = useState<number[]>([]);
  const telemetryRawRef = useRef({
    heartRate: 0,
    power: 0,
    cadence: 0,
    speed: 0,
    effort: 0,
    wBal: DEFAULT_WBAL_CONFIG.wPrime,
    wBalPercentage: 100,
    currentGear: 10,
    gearRatio: 1.0,
    distance: 0,
    resistance: 0,
    timestamp: Date.now(),
  });

  // Physiological Model Refs
  const wBalRef = useRef<number>(DEFAULT_WBAL_CONFIG.wPrime);
  const wBalConfigRef = useRef<WBalConfig>(DEFAULT_WBAL_CONFIG);
  const [currentGear, setCurrentGear] = useState(10); // Start in middle gear
  const lastWBalUpdateMsRef = useRef<number>(0);

  // Ghost Rider State
  const [ghostPerformance, setGhostPerformance] =
    useState<GhostPerformance | null>(null);
  const [ghostState, setGhostState] = useState<GhostState>({
    leadLagTime: 0,
    distanceGap: 0,
    ghostPoint: null,
  });

  const lastTelemetryCommitMsRef = useRef(0);
  const trackedEntryViewRef = useRef(false);
  const trackedLiveTelemetryRef = useRef(false);
  const trackedCompletionRef = useRef(false);

  // Telemetry averages for completion screen
  const telemetrySamples = useRef<
    { hr: number; power: number; effort: number }[]
  >([]);
  const ridePointsRef = useRef<RideRecordPoint[]>([]);
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
  const { isConnected: walletConnected, address } = useAccount();
  const [rewardMode, setRewardMode] = useState<RewardMode>("zk-batch");

  // Ghost performance fetch - load real historical data or fall back to mock
  useEffect(() => {
    if (routeCoordinates.length > 0 && !ghostPerformance) {
      fetchGhostWithFallback(
        routeCoordinates,
        {
          classId:
            classData?.metadata?.route?.walrusBlobId ??
            (typeof params.classId === "string" ? params.classId : ""),
          riderAddress: address,
          routeBlobId: classData?.metadata?.route?.walrusBlobId,
          ghostType: "personal_best",
        },
        25, // target speed km/h
      ).then((ghost) => setGhostPerformance(ghost));
    }
  }, [
    routeCoordinates,
    ghostPerformance,
    classData?.metadata?.route?.walrusBlobId,
    params.classId,
    address,
  ]);

  // Guest mode — reward selector is disabled; user must connect wallet to earn
  const isGuestMode =
    typeof window !== "undefined" &&
    localStorage.getItem("spin-guest-mode") === "true" &&
    !walletConnected;

  // Training mode: simulator is active in a paid class (rewards disabled but can test experience)
  const isTrainingMode = useSimulator && !isPracticeMode && walletConnected;
  const rewardClaimStatus: RewardClaimStatus | undefined =
    !isPracticeMode && !isTrainingMode
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

  // Rewards — mode selectable, defaults to zk-batch
  const rewards = useRewards({
    mode: rewardMode,
    classId: classId as string,
    instructor: (classData?.instructor as `0x${string}`) || "0x0",
    depositAmount: BigInt(0), // Demo mode - no real deposit required
  });

  // Mobile experience hooks - wake lock, fullscreen, haptic
  const {
    request: requestWakeLock,
    release: releaseWakeLock,
    isActive: wakeLockActive,
  } = useWakeLock();
  const haptic = useHaptic();

  // Activate wake lock when riding starts on mobile
  useEffect(() => {
    if (isRiding && deviceType === "mobile") {
      requestWakeLock();
    } else if (!isRiding && wakeLockActive) {
      releaseWakeLock();
    }
  }, [isRiding, deviceType, requestWakeLock, releaseWakeLock, wakeLockActive]);

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
  const [telemetryAverages, setTelemetryAverages] = useState({
    avgHr: 0,
    avgPower: 0,
    avgEffort: 0,
  });

  // Track last spoken beat to avoid repeats
  const lastSpokenBeatRef = useRef<string | null>(null);

  // Track interval transitions for audio cues
  const lastIntervalRef = useRef<number>(-1);

  // Coach message overlay — last spoken text, cleared after 4s
  const [lastCoachMessage, setLastCoachMessage] = useState<string | null>(null);

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
  }, [isRiding, playSound]);

  // Commit buffered telemetry into React state at a fixed rate to reduce rerenders
  useEffect(() => {
    if (!isRiding) return;

    // Adaptive rate: use performance tier + device type for optimal UX
    // Low/medium tier devices need lower rates to avoid frame drops
    // High-tier mobile still needs responsive HUD at 2Hz
    let uiHz: number;
    if (deviceType === "mobile") {
      uiHz =
        performanceTier === "low" ? 1 : performanceTier === "medium" ? 1.5 : 2;
    } else {
      uiHz =
        performanceTier === "low" ? 2 : performanceTier === "medium" ? 3 : 4;
    }
    const intervalMs = Math.floor(1000 / uiHz);

    const id = setInterval(() => {
      const now = Date.now();
      if (now - lastTelemetryCommitMsRef.current < intervalMs) return;

      const deltaSeconds =
        lastWBalUpdateMsRef.current > 0
          ? (now - lastWBalUpdateMsRef.current) / 1000
          : intervalMs / 1000;

      lastWBalUpdateMsRef.current = now;
      lastTelemetryCommitMsRef.current = now;

      // Update Physiological Model (W'bal)
      const power = telemetryRawRef.current.power;
      const nextWBal = calculateNextWBal(
        wBalRef.current,
        power,
        deltaSeconds,
        wBalConfigRef.current,
      );

      wBalRef.current = nextWBal;
      const percentage = getWBalPercentage(
        nextWBal,
        wBalConfigRef.current.wPrime,
      );

      // Calculate Virtual Speed based on Gear
      const { ratio } = getGearRatio(currentGear);
      const virtualSpeed = calculateVirtualSpeed(
        telemetryRawRef.current.cadence,
        ratio,
      );

      // Sync with raw ref for consistent display
      telemetryRawRef.current = {
        ...telemetryRawRef.current,
        speed: virtualSpeed > 0 ? virtualSpeed : telemetryRawRef.current.speed,
        distance:
          telemetryRawRef.current.distance +
          (virtualSpeed * deltaSeconds) / 3600,
        wBal: nextWBal,
        wBalPercentage: percentage,
        currentGear,
        gearRatio: ratio,
        timestamp: now,
      };

      // Record point for TCX export (at ~1Hz)
      if (
        Math.round(now / 1000) !==
        Math.round(lastTelemetryCommitMsRef.current / 1000)
      ) {
        const currentCoord = currentRouteCoordinate;
        ridePointsRef.current.push({
          timestamp: now,
          heartRate: telemetryRawRef.current.heartRate,
          power: telemetryRawRef.current.power,
          cadence: telemetryRawRef.current.cadence,
          speed: telemetryRawRef.current.speed,
          distance: telemetryRawRef.current.distance,
          latitude: currentCoord?.lat,
          longitude: currentCoord?.lng,
          altitude: currentCoord?.ele,
        });
      }

      // Update Ghost Rider position and lead/lag
      if (ghostPerformance) {
        const nextGhost = calculateGhostState(
          ghostPerformance.points,
          telemetryRawRef.current.distance * 1000,
          elapsedTime,
        );
        setGhostState(nextGhost);
      }

      setTelemetry(telemetryRawRef.current);
      setTelemetryHistory((prev) => ({
        power: [...prev.power, telemetryRawRef.current.power].slice(-30),
        cadence: [...prev.cadence, telemetryRawRef.current.cadence].slice(-30),
        heartRate: [...prev.heartRate, telemetryRawRef.current.heartRate].slice(
          -30,
        ),
      }));
    }, intervalMs);

    return () => clearInterval(id);
  }, [
    isRiding,
    deviceType,
    performanceTier,
    currentGear,
    currentRouteCoordinate,
    ghostPerformance,
    elapsedTime,
  ]);

  useEffect(() => {
    if (telemetry.power <= 0) return;
    setRecentPowerHistory((previous) => [
      ...previous.slice(-19),
      telemetry.power,
    ]);
  }, [telemetry.power]);

  // Handle BLE metrics updates
  const handleBleMetrics = async (metrics: {
    heartRate?: number;
    power?: number;
    cadence?: number;
    speed?: number;
    effort?: number;
    distance?: number;
    timestamp?: number;
  }) => {
    // Buffer raw telemetry (do not trigger React rerender here)
    telemetryRawRef.current = {
      ...telemetryRawRef.current,
      heartRate: metrics.heartRate ?? telemetryRawRef.current.heartRate,
      power: metrics.power ?? telemetryRawRef.current.power,
      cadence: metrics.cadence ?? telemetryRawRef.current.cadence,
      speed: metrics.speed ?? telemetryRawRef.current.speed,
      effort: metrics.effort ?? telemetryRawRef.current.effort,
      distance: metrics.distance ?? telemetryRawRef.current.distance,
      timestamp: metrics.timestamp ?? Date.now(),
    };
    if (metrics.heartRate || metrics.power) {
      setBleConnected(true);
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
    if (
      isRiding &&
      rewards.isActive &&
      (metrics.heartRate || metrics.power) &&
      !isTrainingMode
    ) {
      const now = Date.now();
      const minIntervalMs = deviceType === "mobile" ? 500 : 250; // 2Hz mobile, 4Hz desktop

      if (
        !pendingRewardRecordRef.current &&
        now - lastRewardRecordMsRef.current >= minIntervalMs
      ) {
        pendingRewardRecordRef.current = true;
        lastRewardRecordMsRef.current = now;

        void rewards
          .recordEffort({
            timestamp: now,
            heartRate: metrics.heartRate || telemetry.heartRate,
            power: metrics.power || telemetry.power,
            cadence: metrics.cadence || telemetry.cadence,
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
  };

  // Handle simulator metrics updates
  const handleSimulatorMetrics = (metrics: {
    heartRate: number;
    power: number;
    cadence: number;
    speed: number;
    effort: number;
    distance?: number;
    timestamp?: number;
  }) => {
    telemetryRawRef.current = {
      ...telemetryRawRef.current,
      ...metrics,
      distance: metrics.distance ?? telemetryRawRef.current.distance,
      timestamp: metrics.timestamp ?? Date.now(),
    };
    // Simulator is a user-driven control; update UI immediately for responsiveness
    setTelemetry(telemetryRawRef.current);

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
  };

  // Auto-adjust HUD and view mode only while following system defaults.
  useEffect(() => {
    if (hudModePreferenceRef.current === "system") {
      setHudMode(
        getSystemHudMode(deviceType, orientation, prefersReducedMotion),
      );
    }

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

  // Simulate telemetry when BLE not connected and not using simulator
  useEffect(() => {
    if (!isRiding || bleConnected || useSimulator) return;

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
    }, 1000);

    return () => clearInterval(interval);
  }, [isRiding, bleConnected, useSimulator]);

  // Also collect BLE and simulator telemetry samples
  useEffect(() => {
    if (isRiding && (bleConnected || useSimulator) && telemetry.heartRate > 0) {
      telemetrySamples.current.push({
        hr: telemetry.heartRate,
        power: telemetry.power,
        effort: telemetry.effort,
      });
    }
  }, [
    isRiding,
    bleConnected,
    useSimulator,
    isPracticeMode,
    telemetry.heartRate,
    telemetry.power,
    telemetry.effort,
  ]);

  const refreshTelemetryAverages = useCallback(() => {
    const samples = telemetrySamples.current;
    if (samples.length === 0) {
      setTelemetryAverages({ avgHr: 0, avgPower: 0, avgEffort: 0 });
      return;
    }
    const sum = samples.reduce(
      (acc, s) => ({
        hr: acc.hr + s.hr,
        power: acc.power + s.power,
        effort: acc.effort + s.effort,
      }),
      { hr: 0, power: 0, effort: 0 },
    );
    setTelemetryAverages({
      avgHr: Math.round(sum.hr / samples.length),
      avgPower: Math.round(sum.power / samples.length),
      avgEffort: Math.round(sum.effort / samples.length),
    });
  }, []);

  useEffect(() => {
    refreshTelemetryAverages();
  }, [telemetry.heartRate, telemetry.power, telemetry.effort, refreshTelemetryAverages]);

  // 1. Unified AI Coaching Agent (Phase 1/2/3)
  const [marketStats, setMarketStats] = useState({
    ticketsSold: 0,
    revenue: 0,
    capacity: 50,
  });

  // Simulate market activity for Phase 3 autonomy
  useEffect(() => {
    if (!isRiding) return;
    const interval = setInterval(() => {
      setMarketStats((prev) => {
        // More "intense" classes drive more late-ticket sales
        const intensityFactor = telemetry.effort / 100;
        const newTickets = Math.random() < 0.1 + intensityFactor * 0.2 ? 1 : 0;
        return {
          ...prev,
          ticketsSold: Math.min(prev.capacity, prev.ticketsSold + newTickets),
          revenue: prev.revenue + newTickets * 15, // $15 per ticket
        };
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [isRiding, telemetry.effort]);

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
      ((classData?.metadata?.ai?.personality as
        | "zen"
        | "drill-sergeant"
        | "data") ?? "drill-sergeant"),
    sessionObjectId: classId,
    metrics: {
      ...telemetry,
      wBalPercentage: telemetry.wBalPercentage || 100,
    },
    currentInterval,
    isEnabled: aiActive,
    setResistance: async (level) => {
      // Hardware actuation via unified BLE
      return await setResistance(level);
    },
    playSound,
    instructorProfile: classData?.metadata
      ? {
          name: classData.metadata.instructor,
          specialties: [],
        }
      : undefined,
    marketStats, // Phase 3: Revenue optimization
  });

  const flowIntensity = useMemo(() => {
    if (!currentInterval?.targetRpm) return telemetry.effort / 100;
    const [min] = currentInterval.targetRpm;
    return Math.min(1, telemetry.cadence / min);
  }, [telemetry.cadence, telemetry.effort, currentInterval]);

  const flowColor = useMemo(() => {
    if (currentInterval?.phase === "sprint") return "bg-rose-500";
    if (currentInterval?.phase === "recovery") return "bg-sky-500";
    return "bg-yellow-500";
  }, [currentInterval?.phase]);

  // Biometric Music Sync
  useEffect(() => {
    if (!isRiding || !telemetry.cadence || !currentInterval?.targetRpm) return;
    const [minRpm] = currentInterval.targetRpm;
    // Calculate playback rate based on cadence vs target
    // 1.0 is normal speed, range [0.85, 1.2]
    const rate = Math.max(0.85, Math.min(1.2, telemetry.cadence / minRpm));
    setMusicSpeed(rate);
  }, [isRiding, telemetry.cadence, currentInterval, setMusicSpeed]);

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
    isSpeaking,
    playSound,
    speak,
    rideProgress,
    storyBeats: classData?.route?.route.storyBeats || [],
    lastDecision,
  });

  const [showMilestone, setShowMilestone] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);

  // Milestone Celebration logic
  useEffect(() => {
    if (!isRiding) return;

    if (telemetry.effort > 900 && !trackedCompletionRef.current) {
      setShowMilestone({
        title: "ELITE EFFORT",
        subtitle: "You just crossed 900 effort points!",
      });
      haptic.success();
      playSound("achievement");
      setTimeout(() => setShowMilestone(null), 5000);
    }
  }, [telemetry.effort, isRiding, haptic, playSound]);

  // Handle message display sync
  useEffect(() => {
    if (consolidatedCoachMessage) {
      setLastCoachMessage(consolidatedCoachMessage);
    }
  }, [consolidatedCoachMessage]);

  // Simplified UI Trigger: Activation of AI instructor when riding
  useEffect(() => {
    setAiActive(isRiding && (isPracticeMode || Boolean(classData?.metadata?.ai?.enabled)));
  }, [isRiding, isPracticeMode, classData?.metadata?.ai, setAiActive]);

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
    playCountdown(3);

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
      setRecentPowerHistory([]);
      telemetrySamples.current = [];
      setTelemetryAverages({ avgHr: 0, avgPower: 0, avgEffort: 0 });
      lastSpokenBeatRef.current = null;
      lastIntervalRef.current = -1;
      trackedCompletionRef.current = false;
      speak("Let's go!", "intense");
    }, 3000);
  };

  const pauseRide = () => {
    isRidingRef.current = false;
    setIsRiding(false);
    playSound("recover");
  };
  const exitRide = async () => {
    setIsExiting(true);
    stopAudio();
    stopVoice();
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const cycleHudMode = () => {
    const next =
      hudMode === "full"
        ? "compact"
        : hudMode === "compact"
          ? "minimal"
          : "full";
    applyHudMode(next, "manual");
  };

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
    <div
      className="fixed inset-0 bg-black"
      style={{
        height: deviceType === "mobile" ? `${viewportHeight}px` : "100vh",
      }}
    >
      <RideVisualization
        viewMode={viewMode}
        deviceType={deviceType}
        isRiding={isRiding}
        rideProgress={rideProgress}
        elapsedTime={elapsedTime}
        telemetry={telemetry}
        routeElevationProfile={routeElevationProfile}
        routeCoordinates={routeCoordinates}
        currentRouteCoordinate={currentRouteCoordinate}
        classData={(classData as {
          name: string;
          instructor: string;
          route?: { route?: { storyBeats?: StoryBeat[] } } | null;
          metadata?: EnhancedClassMetadata | null;
        }) ?? {
          name: practiceConfig?.name || "SpinChain Ride",
          instructor: practiceConfig?.instructor || agentName,
        }}
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
        onSnapPanel={(key) =>
          panelState.snapPanelToEdge(key, {
            width: window.innerWidth,
            height: window.innerHeight,
          })
        }
        onTrackWidgetInteraction={trackWidgetInteraction}
        onExpandOne={panelState.expandOne}
        onHaptic={haptic.trigger}
        isPracticeMode={isPracticeMode}
        recentPowerHistory={recentPowerHistory}
      />

      <RideHUDOverlay
        classData={classData}
        isPracticeMode={isPracticeMode}
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
        viewMode={viewMode}
        hudMode={hudMode}
        deviceType={deviceType}
        simulatedReward={simulatedRewards}
        telemetry={telemetry}
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
        widgetsMode={widgetsMode}
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
        onToggleViewMode={() =>
          applyViewMode(
            viewMode === "immersive" ? "focus" : "immersive",
            "manual",
          )
        }
        onCycleHudMode={cycleHudMode}
        onExitRide={exitRide}
        onResetPrefs={() => {
          try {
            window.localStorage.removeItem("spinchain:ride:viewMode");
            window.localStorage.removeItem("spinchain:ride:hudMode");
          } catch {
            /* ignore */
          }
          hudModePreferenceRef.current = "system";
          viewModePreferenceRef.current = "system";
          applyHudMode(
            getSystemHudMode(deviceType, orientation, prefersReducedMotion),
            "system",
          );
          applyViewMode(
            getSystemViewMode(
              deviceType,
              performanceTier,
              prefersReducedMotion,
            ),
            "system",
          );
          panelState.resetLayout();
          trackEvent(ANALYTICS_EVENTS.WIDGET_LAYOUT_RESET, {
            phase: isRiding
              ? "in_ride"
              : rideProgress > 0
                ? "post_ride"
                : "pre_ride",
            viewMode,
            deviceType,
          });
        }}
        onCollapseToggle={() => {
          if (isRiding && viewMode === "immersive") {
            cycleRideWidgetsMode();
            return;
          }
          if (panelState.isAllCollapsed) panelState.expandAll();
          else panelState.collapseAll();
        }}
        isAllCollapsed={
          isRiding && viewMode === "immersive"
            ? widgetsMode !== "expanded"
            : panelState.isAllCollapsed
        }
        onTogglePanel={handleTogglePanel}
        onSetWidgetsMode={panelState.setMobileRideWidgetsMode}
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
      {isRiding && viewMode === "immersive" && (
        <div className="fixed top-32 left-6 z-40 flex flex-col gap-3">
          {[
            { id: "1", name: "Vitalik.eth", power: 245, active: true },
            { id: "2", name: "Satoshi_N", power: 180, active: false },
            { id: "3", name: "CyclingSam", power: 210, active: true },
          ].map((rider) => (
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
                  {rider.power}W
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
        message={isRiding ? lastCoachMessage : null}
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
  );
}
