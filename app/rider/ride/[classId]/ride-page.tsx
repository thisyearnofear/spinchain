"use client";

/**
 * Ride Page Orchestrator
 *
 * Initializes hooks and wires state to the centralized Zustand store.
 * Sub-components subscribe to only the slices they need, so a telemetry
 * update (2-4Hz) only re-renders the HUD, not the entire page.
 *
 * This replaces the 1750-line God Component that caused React #185.
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useRideStore } from "@/app/stores/ride-store";
import { usePracticeConfig } from "@/app/hooks/ride/use-practice-config";
import { useClass } from "@/app/hooks/evm/use-class-data";
import { useRideLifecycle } from "@/app/hooks/ride/use-ride-lifecycle";
import { useRideTelemetry } from "@/app/hooks/ride/use-ride-telemetry";
import { useTelemetryStore } from "@/app/hooks/ride/use-telemetry-store";
import { usePanelState } from "@/app/hooks/ui/use-panel-state";
import { useRideTutorial } from "@/app/components/features/ride/ride-tutorial";
import { useRewards } from "@/app/hooks/rewards/use-rewards";
import { useWorkoutAudio } from "@/app/hooks/ai/use-workout-audio";
import { useCoachVoice } from "@/app/hooks/common/use-coach-voice";
import { useRideCoach } from "@/app/hooks/ride/use-ride-coach";
import { useWorkoutAgent } from "@/app/hooks/ai/use-workout-agent";
import { useSimulatedRewards } from "@/app/hooks/ride/use-simulated-rewards";
import { useMultiGhost } from "@/app/hooks/ride/use-multi-ghost";
import { useUnifiedBle } from "@/app/lib/mobile-bridge";
import { useZKClaim } from "@/app/hooks/evm/use-zk-claim";
import { useChainlinkVerification } from "@/app/hooks/evm/use-chainlink-verification";
import { useWakeLock } from "@/app/hooks/use-wake-lock";
import { useHaptic } from "@/app/hooks/use-haptic";
import {
  useDeviceType,
  useOrientation,
  useActualViewportHeight,
  usePerformanceTier,
} from "@/app/lib/responsive";
import {
  type WorkoutPlan,
  PHASE_TO_THEME,
  PRESET_WORKOUTS,
  getCurrentInterval,
  getIntervalProgress,
  getIntervalRemaining,
} from "@/app/lib/workout-plan";
import { DEFAULT_ROAD_GEARS } from "@/app/lib/analytics/physiological-models";
import { REWARD_VERIFICATION } from "@/app/config";
import { ANALYTICS_EVENTS, trackEvent } from "@/app/lib/analytics/events";
import {
  createCanonicalRideSummary,
  enqueueRideSync,
  getRetentionSignals,
  processRideSyncQueue,
  saveRideSummary,
  updateRideRewardState,
} from "@/app/lib/analytics/ride-history";
import type { RewardClaimStatus } from "@/app/components/features/ride/ride-completion";
import { persistRideSummaryToWalrus } from "@/app/lib/walrus/ride-persistence";

// Sub-components
import { RideScene } from "./ride-scene";
import { RideControls } from "./ride-controls";
import { RideOverlays } from "./ride-overlays";

// ============================================================================
// Constants
// ============================================================================

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

// ============================================================================
// Component
// ============================================================================

export default function RidePage() {
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

  const store = useRideStore;
  const s = useRideStore();

  const deviceType = useDeviceType();
  const orientation = useOrientation();
  const viewportHeight = useActualViewportHeight();
  const performanceTier = usePerformanceTier();
  const { isConnected: walletConnected, address } = useAccount();

  // Panel state
  const panelState = usePanelState(deviceType);
  const panelStateRef = useRef(panelState);
  panelStateRef.current = panelState;

  // Tutorial
  const { showTutorial, tutorialStep, nextStep, dismiss: dismissTutorial } =
    useRideTutorial();

  // Lifecycle
  const {
    isRiding,
    setIsRiding,
    isRidingRef,
    classDataRef,
    isStarting,
    setIsStarting,
    isExiting,
    setIsExiting,
    rideProgress,
    setRideProgress,
    elapsedTime,
    setElapsedTime,
  } = useRideLifecycle({
    classData,
    bleConnected: s.bleConnected,
    useSimulator: s.useSimulator,
  });

  // Sync lifecycle state to store
  useEffect(() => { store.setState({ isRiding }); }, [isRiding]);
  useEffect(() => { store.setState({ isStarting }); }, [isStarting]);
  useEffect(() => { store.setState({ isExiting }); }, [isExiting]);
  useEffect(() => { store.setState({ rideProgress }); }, [rideProgress]);
  useEffect(() => { store.setState({ elapsedTime }); }, [elapsedTime]);

  // Telemetry
  const routeCoordinates = useMemo(
    () => classData?.route?.route.coordinates ?? [],
    [classData?.route?.route.coordinates],
  );
  const routeElevationProfile = useMemo(
    () => routeCoordinates.map((c) => c.ele || 0),
    [routeCoordinates],
  );
  const routeProgress =
    isRiding || rideProgress > 0 ? rideProgress / 100 : 0;
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
    bleConnected: s.bleConnected,
    useSimulator: s.useSimulator,
    routeCoordinates,
    currentRouteCoordinate,
    elapsedTimeSeconds: elapsedTime,
    ghostBlobId: classData?.metadata?.route?.walrusBlobId,
    riderAddress: address,
    classId,
    historyUpdateIntervalMs: 2000,
    maxRidePoints: MAX_RIDE_POINTS,
  });

  // Rewards
  const rewards = useRewards({
    mode: s.rewardMode,
    classId: classId as string,
    instructor: (classData?.instructor as `0x${string}`) || "0x0",
    depositAmount: classData?.currentPrice
      ? BigInt(Math.floor(parseFloat(classData.currentPrice) * 1e18))
      : BigInt(0),
  });
  const rewardsRef = useRef(rewards);
  rewardsRef.current = rewards;

  // Audio
  const aiPersonality = classData?.metadata?.ai?.personality;
  const coachPersonality =
    aiPersonality === "drill-sergeant"
      ? "drill"
      : aiPersonality === "zen"
        ? "zen"
        : "data";
  const { playSound, playCountdown, stopAll: stopAudio, setMusicSpeed } =
    useWorkoutAudio();
  const { speak, stop: stopVoice, isSpeaking } = useCoachVoice({
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
    (text: string, emotion?: Parameters<typeof speak>[1]) => {
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

  // BLE
  const { setResistance } = useUnifiedBle();
  const stableSetResistance = useCallback(
    async (level: number) => setResistance(level),
    [setResistance],
  );

  // ZK / Chainlink
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

  // AI
  const aiActive =
    !DISABLE_RIDE_AUDIO_AND_VOICE &&
    isRiding &&
    ((isPracticeMode && Boolean(practiceConfig?.aiEnabled)) ||
      Boolean(classData?.metadata?.ai?.enabled));
  const agentName = classData?.instructor || "Coach";

  const telemetryForAgentRef = useRef(telemetryRawRef.current);
  telemetryForAgentRef.current = telemetryRawRef.current;
  const agentMetrics = useMemo(
    () => ({
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
    }),
    [],
  );

  const instructorProfile = useMemo(
    () =>
      classData?.metadata
        ? { name: classData.metadata.instructor, specialties: [] as string[] }
        : undefined,
    [classData?.metadata],
  );

  const currentIntervalIndex = s.workoutPlan
    ? getCurrentInterval(s.workoutPlan.intervals, elapsedTime)
    : -1;
  const currentInterval =
    s.workoutPlan?.intervals[currentIntervalIndex] ?? null;
  const intervalProgress = s.workoutPlan
    ? getIntervalProgress(s.workoutPlan.intervals, elapsedTime)
    : 0;
  const intervalRemaining = s.workoutPlan
    ? getIntervalRemaining(s.workoutPlan.intervals, elapsedTime)
    : 0;

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
    marketStats: s.marketStats,
  });

  const stableStoryBeats = useMemo(
    () => classData?.route?.route.storyBeats || [],
    [classData?.route?.route.storyBeats],
  );

  const { lastCoachMessage: consolidatedCoachMessage } = useRideCoach({
    isRiding,
    aiActive,
    workoutPlan: s.workoutPlan,
    currentIntervalIndex,
    currentInterval,
    intervalRemaining,
    telemetryCadence: telemetryRawRef.current.cadence,
    aiLogs,
    isSpeaking: DISABLE_RIDE_AUDIO_AND_VOICE ? false : isSpeaking,
    playSound: safePlaySound,
    speak: safeSpeak,
    rideProgress,
    storyBeats: stableStoryBeats,
    lastDecision,
  });

  // Ghost / social
  const { multiGhostState } = useMultiGhost(
    classId as string,
    classData?.route?.route?.coordinates || [],
    telemetryRawRef.current.distance,
    elapsedTime,
    isRiding,
  );

  // Simulated rewards
  const isGuestMode =
    typeof window !== "undefined" &&
    localStorage.getItem("spin-guest-mode") === "true" &&
    !walletConnected;
  const isTrainingMode = s.useSimulator && !isPracticeMode && walletConnected;
  const simulatedRewards = useSimulatedRewards({
    isRiding,
    isTrainingMode,
    isGuestMode,
    effortScore: telemetryRawRef.current.effort,
  });

  // Wake lock
  const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();
  const wakeLockActiveRef = useRef(false);
  useEffect(() => {
    if (isRiding && deviceType === "mobile") {
      requestWakeLock();
      wakeLockActiveRef.current = true;
    } else if (!isRiding && wakeLockActiveRef.current) {
      releaseWakeLock();
      wakeLockActiveRef.current = false;
    }
  }, [isRiding, deviceType]);

  // Haptic
  const haptic = useHaptic();

  // Reward claim status
  const rewardClaimStatus: RewardClaimStatus | undefined = useMemo(() => {
    if (isPracticeMode || isTrainingMode) return undefined;
    if (useChainlinkRewards) {
      return {
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
      };
    }
    return {
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
    };
  }, [
    isPracticeMode, isTrainingMode, useChainlinkRewards,
    isChainlinkClaiming, isChainlinkVerifying, chainlinkSuccess,
    isChainlinkVerified, chainlinkError, isChainlinkRequestSuccess,
    chainlinkVerifiedScore, isGeneratingProof, zkSuccess, zkError,
    privacyScore, privacyLevel,
  ]);

  // Route theme
  const routeTheme = currentInterval
    ? PHASE_TO_THEME[currentInterval.phase]
    : (classData?.metadata?.route.theme as
        | "neon"
        | "alpine"
        | "mars"
        | "anime"
        | "rainbow") || "neon";

  // ============================================================================
  // Effects (minimal — most rendering logic is in sub-components)
  // ============================================================================

  // Panel layout on ride start/end
  const previousIsRidingRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (previousIsRidingRef.current === isRiding) return;
    previousIsRidingRef.current = isRiding;
    if (isRiding) {
      panelState.startRideLayout();
    } else {
      panelState.endRideLayout();
    }
  }, [isRiding]);

  // Keyboard gear shifting
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

  // Simulate telemetry for demo/guest mode
  useEffect(() => {
    if (
      !isRiding ||
      s.bleConnected ||
      s.useSimulator ||
      (!isPracticeMode && !isGuestMode)
    )
      return;
    const interval = setInterval(() => {
      const prev = telemetryRawRef.current;
      telemetryRawRef.current = {
        ...prev,
        heartRate: prev.heartRate || 120 + Math.floor(Math.random() * 40),
        power: prev.power || 150 + Math.floor(Math.random() * 100),
        cadence: prev.cadence || 80 + Math.floor(Math.random() * 20),
        speed: prev.speed || 25 + Math.random() * 10,
        effort: prev.effort || 140 + Math.floor(Math.random() * 30),
      };
      telemetrySamples.current.push({
        hr: telemetryRawRef.current.heartRate,
        power: telemetryRawRef.current.power,
        effort: telemetryRawRef.current.effort,
      });
      if (telemetrySamples.current.length > MAX_TELEMETRY_SAMPLES) {
        telemetrySamples.current.splice(
          0,
          telemetrySamples.current.length - MAX_TELEMETRY_SAMPLES,
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isRiding, s.bleConnected, s.useSimulator, isPracticeMode, isGuestMode]);

  // Collect BLE/simulator telemetry samples
  useEffect(() => {
    if (!isRiding || (!s.bleConnected && !s.useSimulator)) return;
    const id = setInterval(() => {
      const t = telemetryRawRef.current;
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
  }, [isRiding, s.bleConnected, s.useSimulator, refreshTelemetryAverages]);

  // Flow intensity
  const flowIntensityMemosRef = useRef({
    cadence: telemetryRawRef.current.cadence,
    effort: telemetryRawRef.current.effort,
    interval: currentInterval,
  });
  flowIntensityMemosRef.current = {
    cadence: telemetryRawRef.current.cadence,
    effort: telemetryRawRef.current.effort,
    interval: currentInterval,
  };
  useEffect(() => {
    if (!isRiding) return;
    const id = setInterval(() => {
      const { cadence, effort, interval } = flowIntensityMemosRef.current;
      if (!interval?.targetRpm) {
        store.setState({ flowIntensity: effort / 100 });
      } else {
        const [min] = interval.targetRpm;
        store.setState({ flowIntensity: Math.min(1, cadence / min) });
      }
    }, 500);
    return () => clearInterval(id);
  }, [isRiding]);

  // Music sync
  const telemetryCadenceRef = useRef(telemetryRawRef.current.cadence);
  telemetryCadenceRef.current = telemetryRawRef.current.cadence;
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

  // Milestone check
  const telemetryEffortRef = useRef(telemetryRawRef.current.effort);
  telemetryEffortRef.current = telemetryRawRef.current.effort;
  const milestoneHapticRef = useRef(haptic);
  milestoneHapticRef.current = haptic;
  const milestonePlaySoundRef = useRef(safePlaySound);
  milestonePlaySoundRef.current = safePlaySound;
  useEffect(() => {
    if (!isRiding) return;
    const id = setInterval(() => {
      if (telemetryEffortRef.current > 900) {
        store.setState({
          showMilestone: {
            title: "ELITE EFFORT",
            subtitle: "You just crossed 900 effort points!",
          },
        });
        milestoneHapticRef.current.success();
        milestonePlaySoundRef.current("achievement");
        setTimeout(() => store.setState({ showMilestone: null }), 5000);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [isRiding]);

  // Market stats simulation
  useEffect(() => {
    if (!isRiding || (!isPracticeMode && !isGuestMode)) return;
    const interval = setInterval(() => {
      const intensityFactor = telemetryEffortRef.current / 100;
      const newTickets =
        Math.random() < 0.1 + intensityFactor * 0.2 ? 1 : 0;
      store.setState((prev) => ({
        marketStats: {
          ...prev.marketStats,
          ticketsSold: Math.min(
            prev.marketStats.capacity,
            prev.marketStats.ticketsSold + newTickets,
          ),
          revenue: prev.marketStats.revenue + newTickets * 15,
        },
      }));
    }, 15000);
    return () => clearInterval(interval);
  }, [isRiding, isPracticeMode, isGuestMode]);

  // Reward state update
  useEffect(() => {
    if (!s.completedRideId || !rewardClaimStatus) return;
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
      s.completedRideId,
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
  }, [s.completedRideId, rewardClaimStatus]);

  // Analytics: ride entry viewed
  const trackedEntryViewRef = useRef(false);
  useEffect(() => {
    if (isRiding || rideProgress > 0 || trackedEntryViewRef.current) return;
    trackedEntryViewRef.current = true;
    trackEvent(ANALYTICS_EVENTS.RIDE_ENTRY_VIEWED, {
      classId,
      practiceMode: isPracticeMode,
    });
  }, [classId, isPracticeMode, isRiding, rideProgress]);

  // Analytics: ride completed
  const trackedCompletionRef = useRef(false);
  useEffect(() => {
    if (rideProgress < 100 || trackedCompletionRef.current) return;
    trackedCompletionRef.current = true;
    trackEvent(ANALYTICS_EVENTS.RIDE_COMPLETED, {
      classId,
      source: s.bleConnected
        ? "live-bike"
        : isPracticeMode && s.useSimulator
          ? "simulator"
          : "estimated",
      practiceMode: isPracticeMode,
    });
  }, [s.bleConnected, classId, isPracticeMode, rideProgress, s.useSimulator]);

  // Body class
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

  // ============================================================================
  // Callbacks
  // ============================================================================

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
        if (!s.bleConnected) store.setState({ bleConnected: true });
      }
      const currentRewards = rewardsRef.current;
      if (
        isRidingRef.current &&
        currentRewards.isActive &&
        (metrics.heartRate || metrics.power) &&
        !isTrainingMode
      ) {
        const now = Date.now();
        const minIntervalMs = deviceType === "mobile" ? 500 : 250;
        void currentRewards
          .recordEffort({
            timestamp: now,
            heartRate: metrics.heartRate || telemetryRawRef.current.heartRate,
            power: metrics.power || telemetryRawRef.current.power,
            cadence: metrics.cadence || telemetryRawRef.current.cadence,
          })
          .catch(() => {});
      }
    },
    [handleBleMetricsInternal, deviceType, isPracticeMode, isTrainingMode],
  );

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
      const currentClassData = classDataRef.current;
      if (isRidingRef.current && currentClassData && metrics.cadence > 0) {
        const TARGET_CADENCE = 80;
        const cadenceRatio = Math.min(metrics.cadence / TARGET_CADENCE, 1.5);
        const tickSeconds = 0.5 * cadenceRatio;
        const SIMULATOR_DURATION_SECONDS = 3 * 60;
        const realDuration = (currentClassData.metadata?.duration || 45) * 60;
        const timeScale = realDuration / SIMULATOR_DURATION_SECONDS;
        const scaledTick = tickSeconds * timeScale;
        setElapsedTime((prev) => prev + scaledTick);
      }
    },
    [handleSimulatorMetricsInternal, classDataRef, isRidingRef, setElapsedTime],
  );

  // Derive ride progress for simulator
  useEffect(() => {
    if (!isRiding || !s.useSimulator) return;
    const currentClassData = classDataRef.current;
    if (!currentClassData) return;
    const realDuration = (currentClassData.metadata?.duration || 45) * 60;
    const newProgress = Math.min((elapsedTime / realDuration) * 100, 100);
    setRideProgress(newProgress);
    if (newProgress >= 100) {
      isRidingRef.current = false;
      setIsRiding(false);
    }
  }, [isRiding, s.useSimulator, elapsedTime]);

  const startRide = useCallback(async () => {
    const telemetryReady = s.bleConnected || s.useSimulator;
    if (!telemetryReady) {
      store.setState({ showNoBikeModal: true });
      trackEvent(ANALYTICS_EVENTS.RIDE_START_BLOCKED_NO_TELEMETRY, {
        classId,
        practiceMode: isPracticeMode,
      });
      return;
    }
    trackEvent(ANALYTICS_EVENTS.RIDE_STARTED, {
      classId,
      source: s.bleConnected ? "live-bike" : "simulator",
      practiceMode: isPracticeMode,
    });
    safePlayCountdown(3);
    if (!isTrainingMode) {
      try {
        await rewards.startEarning();
      } catch (err) {
        console.warn("[Ride] Rewards init skipped:", err);
      }
    }
    setTimeout(() => {
      store.getState().resetForRideStart();
      resetTelemetry();
      safeSpeak("Let's go!", "intense");
    }, 3000);
  }, [
    classId, isPracticeMode, safePlayCountdown, resetTelemetry, safeSpeak,
    isTrainingMode, rewards,
  ]);

  const pauseRide = useCallback(() => {
    isRidingRef.current = false;
    setIsRiding(false);
    safePlaySound("recover");
  }, [safePlaySound]);

  const rideProgressRef = useRef(rideProgress);
  rideProgressRef.current = rideProgress;
  const togglePauseResume = useCallback(() => {
    if (isRidingRef.current) {
      pauseRide();
    } else if (
      rideProgressRef.current > 0 &&
      rideProgressRef.current < 100
    ) {
      isRidingRef.current = true;
      setIsRiding(true);
      safePlaySound("resistanceUp");
    }
  }, [pauseRide, safePlaySound]);

  const exitRide = useCallback(async () => {
    setIsExiting(true);
    safeStopAudio();
    safeStopVoice();
    const samples = telemetrySamples.current;
    const avgHR =
      samples.length > 0
        ? Math.round(
            samples.reduce((sum, s) => sum + s.hr, 0) / samples.length,
          )
        : 0;
    const maxHR =
      samples.length > 0 ? Math.max(...samples.map((s) => s.hr)) : 0;
    let spinEarned = "0";
    const effortScore = Math.min(1000, Math.round((avgHR / 200) * 1000));
    const potentialReward = 10 + (effortScore * 90) / 1000;
    if (rewards.isActive) {
      try {
        const result = await rewards.finalizeRewards();
        spinEarned = result.amount
          ? (Number(result.amount) / 1e18).toFixed(1)
          : "0";
      } catch (err) {
        console.warn("[Ride] Failed to finalize rewards:", err);
      }
    }
    const displaySpin =
      spinEarned !== "0" ? spinEarned : potentialReward.toFixed(1);
    const telemetrySource = s.bleConnected
      ? "live-bike"
      : isPracticeMode && s.useSimulator
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
        mode: s.rewardMode === "sui-native" ? "none" : s.rewardMode,
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
    store.setState({
      completedRideId: summaryId,
      completionSyncStatus: queued.sync.status,
      completionPrimaryAction: getRetentionSignals(saved).ctaPrimary,
    });
    void processRideSyncQueue();
    if (isPracticeMode) {
      store.setState({
        demoStats: {
          duration: elapsedTime,
          avgHeartRate: avgHR,
          maxHeartRate: maxHR,
          effortScore,
          spinEarned: displaySpin,
          rewardsWereActive: true,
        },
        isExiting: false,
        showDemoModal: true,
      });
    } else {
      router.push("/rider/journey?completed=true");
    }
  }, [
    isPracticeMode, router, classData, classId, address, practiceConfig,
    agentName, elapsedTime, telemetryAverages, rewards, s.bleConnected,
    s.useSimulator, s.rewardMode, rewardClaimStatus, useChainlinkRewards,
    chainlinkSuccess, zkSuccess, privacyScore, privacyLevel, walletConnected,
    safeStopAudio, safeStopVoice, setIsExiting,
  ]);

  const handleClaimRewards = useCallback(async () => {
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
        heartRate: telemetryAverages.avgHr || telemetryRawRef.current.heartRate,
        threshold,
        durationSeconds,
        heartRateSamples: telemetrySamples.current.map((sample) => sample.hr),
        avgPower: telemetryAverages.avgPower,
      },
    );
  }, [
    isPracticeMode, address, classData, classId, elapsedTime,
    useChainlinkRewards, finalizeChainlinkRewards, claimWithZK,
    telemetryAverages,
  ]);

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading && !isPracticeMode) {
    return (
      <RideControls
        classId={classId}
        isPracticeMode={isPracticeMode}
        practiceConfig={practiceConfig}
        rewardMode={s.rewardMode}
        isLoading
        router={router}
      />
    );
  }

  if (!classData || !classData.route) {
    return (
      <RideControls
        classId={classId}
        isPracticeMode={isPracticeMode}
        practiceConfig={practiceConfig}
        rewardMode={s.rewardMode}
        isNotFound
        onExitRide={exitRide}
        router={router}
      />
    );
  }

  return (
    <>
      <RideScene
        classId={classId}
        classData={classData}
        isPracticeMode={isPracticeMode}
        routeCoordinates={routeCoordinates}
        routeElevationProfile={routeElevationProfile}
        currentRouteCoordinate={currentRouteCoordinate}
        routeTheme={routeTheme}
        currentInterval={currentInterval}
        currentIntervalIndex={currentIntervalIndex}
        intervalProgress={intervalProgress}
        workoutPlan={s.workoutPlan}
        avatarId={searchParams.get("avatarId") || undefined}
        equipmentId={searchParams.get("equipmentId") || undefined}
        panelState={panelState}
        haptic={haptic}
        recentPowerHistory={recentPowerHistory}
        telemetryHistory={telemetryHistory}
        multiGhostState={multiGhostState}
        ghostState={ghostState}
      />

      <RideOverlays
        consolidatedCoachMessage={consolidatedCoachMessage}
        currentInterval={currentInterval}
        socialEvents={socialEvents}
        handleHighFive={handleHighFive}
        rewards={rewards}
      />

      <RideControls
        classId={classId}
        classData={classData}
        isPracticeMode={isPracticeMode}
        practiceConfig={practiceConfig}
        rewardMode={s.rewardMode}
        deviceType={deviceType}
        orientation={orientation}
        viewportHeight={viewportHeight}
        performanceTier={performanceTier}
        panelState={panelState}
        walletConnected={walletConnected}
        address={address}
        router={router}
        haptic={haptic}
        rewards={rewards}
        simulatedRewards={simulatedRewards}
        telemetryHistory={telemetryHistory}
        ghostState={ghostState}
        multiGhostState={multiGhostState}
        currentInterval={currentInterval}
        aiLogs={aiLogs}
        aiActive={aiActive}
        agentName={agentName}
        reasonerState={reasonerState}
        lastDecision={lastDecision}
        thoughtLog={thoughtLog}
        isSpeaking={isSpeaking}
        workoutPlan={s.workoutPlan}
        currentIntervalIndex={currentIntervalIndex}
        intervalProgress={intervalProgress}
        intervalRemaining={intervalRemaining}
        showTutorial={showTutorial}
        tutorialStep={tutorialStep}
        rewardClaimStatus={rewardClaimStatus}
        telemetryAverages={telemetryAverages}
        telemetrySamples={telemetrySamples}
        ridePointsRef={ridePointsRef}
        useChainlinkRewards={useChainlinkRewards}
        chainlinkSuccess={chainlinkSuccess}
        zkSuccess={zkSuccess}
        privacyScore={privacyScore}
        privacyLevel={privacyLevel}
        isTrainingMode={isTrainingMode}
        isGuestMode={isGuestMode}
        onStartRide={startRide}
        onPauseRide={pauseRide}
        onTogglePauseResume={togglePauseResume}
        onExitRide={exitRide}
        onClaimRewards={handleClaimRewards}
        onBleMetrics={handleBleMetrics}
        onSimulatorMetrics={handleSimulatorMetrics}
        onNextTutorial={nextStep}
        onDismissTutorial={dismissTutorial}
        onSetWorkoutPlan={(p: WorkoutPlan | null) =>
          store.setState({ workoutPlan: p })
        }
        telemetryRawRef={telemetryRawRef}
        classDataRef={classDataRef}
        isRidingRef={isRidingRef}
      />
    </>
  );
}
