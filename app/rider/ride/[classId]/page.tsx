"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useClass } from "../../../hooks/evm/use-class-data";
import { usePracticeConfig } from "../../../hooks/ride/use-practice-config";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useUIStore } from "@/app/stores/ui-store";
import { useAccount } from "wagmi";
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { usePanelState } from "../../../hooks/ui/use-panel-state";
import { useRideTutorial } from "../../../components/features/ride/ride-tutorial";
import { RideLoading, RideNotFound } from "../../../components/features/ride/ride-loading";
import { RideVisualization } from "../../../components/features/ride/ride-visualization";
import { RideHUDOverlay } from "../../../components/features/ride/ride-hud-overlay";
import { RideModals } from "../../../components/features/ride/ride-modals";
import type { RewardClaimStatus } from "../../../components/features/ride/ride-completion";
import type { RideRecordPoint } from "../../../lib/analytics/ride-recorder";
import {
  useDeviceType,
  useOrientation,
  useActualViewportHeight,
  usePerformanceTier,
} from "../../../lib/responsive";
import { RiderSocialFeed } from "../../../components/features/ride/social-feed";
import { CoachMessageOverlay } from "../../../components/features/ride/coach-message-overlay";
import { FlowBackground } from "../../../components/features/ride/flow-background";
import { PerformanceGraph } from "../../../components/features/ride/performance-graph";
import { SettlementStream } from "../../../components/features/ride/settlement-stream";
import { useRewards, type RewardMode } from "../../../hooks/rewards/use-rewards";
import { useChainlinkVerification } from "../../../hooks/evm/use-chainlink-verification";
import { useZKClaim } from "../../../hooks/evm/use-zk-claim";
import { REWARD_VERIFICATION } from "../../../config";
import { ANALYTICS_EVENTS, trackEvent } from "../../../lib/analytics/events";
import { useWakeLock } from "../../../hooks/use-wake-lock";
import { useRideCoordinator } from "@/app/engines/use-ride-coordinator";
import { NetworkStatusBanner } from "../../../components/features/common/yellow-status-indicator";
import { useHaptic } from "../../../hooks/use-haptic";
import {
  type WorkoutPlan,
  PHASE_TO_THEME,
  PRESET_WORKOUTS,
} from "../../../lib/workout-plan";
import { DEFAULT_ROAD_GEARS } from "../../../lib/analytics/physiological-models";
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

type SocialEvent = { id: string; type: "shoutout" | "recommendation" | "nudge" | "highfive"; message: string; timestamp: number; from?: string };

// Stable empty reference — social events are driven via the CoachingEngine/EventBus,
// not local state. Hoisting this out of render keeps the prop identity stable so
// RiderSocialFeed doesn't re-render on every parent render.
const EMPTY_SOCIAL_EVENTS: SocialEvent[] = [];

export default function LiveRidePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // ─── Store Reads (replaces 20+ useState hooks) ─────────────────
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
  coordinatorRef.current = coordinator;
  const isRidingRef = useRef(false);
  const emptyRidePointsRef = useRef<RideRecordPoint[]>([]);

  // ─── Sui Wallet (for Walrus-as-memory anchoring at ride end) ───
  // Hooks declared unconditionally at top level (Rules of Hooks).
  const suiClient = useSuiClient();
  const suiAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteSui } = useSignAndExecuteTransaction();

  const suiExecuteTransaction = useCallback(
    async (tx: unknown): Promise<{ digest: string } | null> => {
      try {
        const result = await signAndExecuteSui({
          transaction: tx as Parameters<typeof signAndExecuteSui>[0]["transaction"],
        });
        return result?.digest ? { digest: result.digest } : null;
      } catch (err) {
        console.error("[Ride] Sui transaction failed:", err);
        return null;
      }
    },
    [signAndExecuteSui],
  );

  // Inject the wallet signer into the SuiEngine once it (or the signer) changes.
  useEffect(() => {
    coordinatorRef.current?.updateSuiConfig({
      executeTransaction: suiExecuteTransaction,
      suiClient: suiClient as unknown as Parameters<
        typeof coordinatorRef.current.updateSuiConfig
      >[0]["suiClient"],
    });
  }, [suiExecuteTransaction, suiClient]);


  // ─── Panel State ───────────────────────────────────────────────
  const panelState = usePanelState(deviceType);
  const viewMode = useUIStore((s) => s.viewMode);

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

  const handleDismissNoBike = useCallback(() => setShowNoBikeModal(false), []);
  const handleDismissKeyboardHints = useCallback(() => setShowKeyboardHints(false), []);

  // ─── BLE / Simulator State ─────────────────────────────────────
  const [bleConnected, setBleConnected] = useState(false);
  const [useSimulator, setUseSimulator] = useState(() => {
    if (typeof window === "undefined") return false;
    const urlParams = new URLSearchParams(window.location.search);
    return isPracticeMode || urlParams.get("demo") === "true" || urlParams.get("sim") === "true";
  });
  const [connectionHint, setConnectionHint] = useState<string | null>(null);
  const [showNoBikeModal, setShowNoBikeModal] = useState(false);
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);

  // Sync local state → ui-store so child components can read directly
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

  // ─── Rewards (wagmi integration — kept until RewardsEngine has full on-chain support) ──
  const rewards = useRewards({
    mode: rewardMode,
    classId: classId as string,
    instructor: (classData?.instructor as `0x${string}`) || "0x0",
    depositAmount: classData?.currentPrice ? BigInt(Math.floor(parseFloat(classData.currentPrice) * 1e18)) : BigInt(0),
  });

  // ─── ZK / Chainlink Verification ──────────────────────────────
  const { claimWithZK, isGeneratingProof, isSuccess: zkSuccess, privacyScore, privacyLevel, error: zkError } = useZKClaim();
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
  const useChainlinkRewards = REWARD_VERIFICATION.mode === "chainlink";
  const [completedRideId, setCompletedRideId] = useState<string | null>(null);

  const rewardClaimStatus: RewardClaimStatus | undefined = useMemo(() => {
    if (isPracticeMode || isTrainingMode) return undefined;
    if (useChainlinkRewards) {
      return {
        mode: "chainlink",
        phase: (isChainlinkClaiming ? "claiming" : isChainlinkVerifying ? "requesting" : chainlinkSuccess ? "claimed" : isChainlinkVerified ? "ready" : chainlinkError ? "error" : isChainlinkRequestSuccess ? "requested" : "idle") as RewardClaimStatus["phase"],
        privacyScore: 0, privacyLevel: "low", verifiedScore: chainlinkVerifiedScore, error: chainlinkError,
      };
    }
    return {
      mode: "zk",
      phase: (isGeneratingProof ? "claiming" : zkSuccess ? "claimed" : zkError ? "error" : "idle") as RewardClaimStatus["phase"],
      privacyScore, privacyLevel, error: zkError,
    };
  }, [isPracticeMode, isTrainingMode, useChainlinkRewards, isChainlinkClaiming, isChainlinkVerifying, chainlinkSuccess, isChainlinkVerified, chainlinkError, isChainlinkRequestSuccess, chainlinkVerifiedScore, isGeneratingProof, zkSuccess, zkError, privacyScore, privacyLevel]);

  useEffect(() => {
    if (!completedRideId || !rewardClaimStatus) return;
    updateRideRewardState(completedRideId, {
      status: rewardClaimStatus.phase === "claimed" ? "claimed" : rewardClaimStatus.phase === "ready" ? "ready" : rewardClaimStatus.phase === "requested" ? "requested" : rewardClaimStatus.phase === "error" ? "failed" : "idle",
      isVerified: rewardClaimStatus.phase === "ready" || rewardClaimStatus.phase === "claimed",
      privacyScore: rewardClaimStatus.privacyScore, privacyLevel: rewardClaimStatus.privacyLevel, verifiedScore: rewardClaimStatus.verifiedScore,
    }, {
      attempted: rewardClaimStatus.phase !== "idle",
      status: rewardClaimStatus.phase === "claimed" ? "confirmed" : rewardClaimStatus.phase === "error" ? "failed" : rewardClaimStatus.phase === "idle" ? "skipped" : "pending",
    });
  }, [completedRideId, rewardClaimStatus]);

  // ─── Demo/Completion State ─────────────────────────────────────
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [completionSyncStatus, setCompletionSyncStatus] = useState<RideSyncStatus>("local_only");
  const [completionPrimaryAction, setCompletionPrimaryAction] = useState<"view_history" | "ride_again">("view_history");
  const [demoStats, setDemoStats] = useState({ duration: 0, avgHeartRate: 0, maxHeartRate: 0, effortScore: 0, spinEarned: "0", rewardsWereActive: false });

  // ─── Tutorial ──────────────────────────────────────────────────
  const { showTutorial, tutorialStep, nextStep: nextTutorial, dismiss: dismissTutorial } = useRideTutorial();

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

  // ─── Keyboard Shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "c" || e.key === "C") {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        if (panelState.isAllCollapsed) panelState.expandAll();
        else panelState.collapseAll();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panelState]);

  useEffect(() => {
    if (typeof window === "undefined" || !isRiding) return;
    const totalGears = DEFAULT_ROAD_GEARS.front.length * DEFAULT_ROAD_GEARS.rear.length;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        useTelemetryStore.setState((s) => ({ currentGear: Math.min(totalGears, s.currentGear + 1) }));
        playSound?.("resistanceUp");
        coordinator.setCurrentGear(useTelemetryStore.getState().currentGear);
      } else if (e.key === "ArrowDown") {
        useTelemetryStore.setState((s) => ({ currentGear: Math.max(1, s.currentGear - 1) }));
        playSound?.("resistanceDown");
        coordinator.setCurrentGear(useTelemetryStore.getState().currentGear);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRiding, playSound, coordinator]);

  // ─── Analytics Tracking ────────────────────────────────────────
  const trackedEntryViewRef = useRef(false);
  const trackedCompletionRef = useRef(false);

  useEffect(() => {
    if (isRiding || rideProgress > 0 || trackedEntryViewRef.current) return;
    trackedEntryViewRef.current = true;
    trackEvent(ANALYTICS_EVENTS.RIDE_ENTRY_VIEWED, { classId, practiceMode: isPracticeMode });
  }, [classId, isPracticeMode, isRiding, rideProgress]);

  useEffect(() => {
    if (rideProgress < 100 || trackedCompletionRef.current) return;
    trackedCompletionRef.current = true;
    trackEvent(ANALYTICS_EVENTS.RIDE_COMPLETED, {
      classId,
      source: bleConnected ? "live-bike" : isPracticeMode && useSimulator ? "simulator" : "estimated",
      practiceMode: isPracticeMode,
    });
  }, [bleConnected, classId, isPracticeMode, rideProgress, useSimulator]);

  // ─── BLE Metrics Handler (delegates to coordinator) ────────────
  const trackedLiveTelemetryRef = useRef(false);

  const handleBleMetrics = useCallback((metrics: { heartRate?: number; power?: number; cadence?: number; speed?: number; effort?: number; distance?: number; timestamp?: number }) => {
    coordinator.ingestBleMetrics(metrics);
    if (metrics.heartRate || metrics.power) {
      setBleConnected(true);
      if (!trackedLiveTelemetryRef.current) {
        trackedLiveTelemetryRef.current = true;
        trackEvent(ANALYTICS_EVENTS.TELEMETRY_LIVE_READY, { classId, practiceMode: isPracticeMode });
      }
    }
  }, [coordinator, classId, isPracticeMode]);

  // ─── Simulator Metrics Handler (delegates to coordinator + progress) ──
  const handleSimulatorMetrics = useCallback((metrics: { heartRate: number; power: number; cadence: number; speed: number; effort: number; distance?: number; timestamp?: number }) => {
    coordinator.ingestSimulatorMetrics(metrics);

    const currentClassData = classDataRef.current;
    if (isRidingRef.current && currentClassData && metrics.cadence > 0) {
      const TARGET_CADENCE = 80;
      const cadenceRatio = Math.min(metrics.cadence / TARGET_CADENCE, 1.5);
      const tickSeconds = 0.5 * cadenceRatio;
      const SIMULATOR_DURATION_SECONDS = 3 * 60;
      const realDuration = (currentClassData.metadata?.duration || 45) * 60;
      const timeScale = realDuration / SIMULATOR_DURATION_SECONDS;
      const scaledTick = tickSeconds * timeScale;

      useRideStore.setState((s) => {
        const newTime = s.elapsedTime + scaledTick;
        const newProgress = Math.min((newTime / realDuration) * 100, 100);
        if (newProgress >= 100) {
          isRidingRef.current = false;
          useRideStore.setState({ isActive: false, rideProgress: 100 });
        }
        return { elapsedTime: newTime, rideProgress: newProgress };
      });
    }
  }, [coordinator]);

  // ─── Start Ride ────────────────────────────────────────────────
  const startRide = useCallback(async () => {
    const telemetryReady = bleConnected || useSimulator;
    if (!telemetryReady) {
      setShowNoBikeModal(true);
      trackEvent(ANALYTICS_EVENTS.RIDE_START_BLOCKED_NO_TELEMETRY, { classId, practiceMode: isPracticeMode });
      return;
    }
    trackEvent(ANALYTICS_EVENTS.RIDE_STARTED, { classId, source: bleConnected ? "live-bike" : "simulator", practiceMode: isPracticeMode });
    useRideStore.setState({ isStarting: true });
    playCountdown(3);

    if (!isTrainingMode) {
      try { await rewards.startEarning(); } catch { /* non-blocking */ }
    }

    coordinator.startRide({
      classId,
      classData: classData as never,
      deviceType,
      performanceTier,
      isPracticeMode,
      walletConnected: !!walletConnected,
      address: address as string | undefined,
      rewardMode,
      coachingConfig: {
        agentName,
        personality: (classData?.metadata?.ai?.personality as "zen" | "drill-sergeant" | "data") || "data",
        workoutPlan,
        instructorProfile: null,
        marketStats: { ticketsSold: 0, revenue: 0, capacity: 50 },
        aiActive: isRiding || isPracticeMode || Boolean(classData?.metadata?.ai?.enabled),
      },
      ghostBlobId: classData?.metadata?.route?.walrusBlobId as string | undefined,
    }).catch((err: unknown) => console.warn("[Ride] Coordinator start failed:", err));

    setTimeout(() => {
      isRidingRef.current = true;
      useRideStore.setState({ isActive: true, isStarting: false, rideProgress: 0, elapsedTime: 0 });
      useTelemetryStore.getState().reset();
      trackedCompletionRef.current = false;
      speak("Let's go!", "intense");
    }, 3000);
  }, [bleConnected, useSimulator, classId, isPracticeMode, isTrainingMode, rewards, coordinator, classData, deviceType, performanceTier, walletConnected, address, rewardMode, agentName, workoutPlan, playCountdown, speak, isRiding]);

  // ─── Pause / Exit Ride ─────────────────────────────────────────
  const pauseRide = useCallback(() => {
    isRidingRef.current = false;
    useRideStore.setState({ isActive: false });
    playSound("recover");
  }, [playSound]);

  const exitRide = useCallback(async () => {
    useRideStore.setState({ isExiting: true });
    stopAudio();

    const averages = telemetryAverages;
    const samples = useTelemetryStore.getState().snapshot;
    const avgHR = averages.avgHr || samples.heartRate;
    const maxHR = avgHR;
    const effortScore = Math.min(1000, Math.round((avgHR / 200) * 1000));
    const potentialReward = 10 + (effortScore * 90) / 1000;

    let spinEarned = "0";
    if (rewards.isActive) {
      try {
        const result = await rewards.finalizeRewards();
        spinEarned = result.amount ? (Number(result.amount) / 1e18).toFixed(1) : "0";
      } catch { /* non-blocking */ }
    }
    const displaySpin = spinEarned !== "0" ? spinEarned : potentialReward.toFixed(1);

    const telemetrySource = bleConnected ? "live-bike" as const : isPracticeMode && useSimulator ? "simulator" as const : "estimated" as const;
    const _threshold = classData?.metadata?.rewards?.threshold ?? 180;
    const summaryId = `${classId}-${Date.now()}`;

    const canonicalSummary = createCanonicalRideSummary({
      id: summaryId,
      riderId: address ?? "guest",
      classId,
      className: classData?.name || practiceConfig?.name || "SpinChain Ride",
      instructor: classData?.instructor || practiceConfig?.instructor || agentName,
      completedAt: Date.now(),
      durationSec: elapsedTime,
      avgHeartRate: avgHR,
      avgPower: averages.avgPower,
      avgEffort: averages.avgEffort,
      spinEarned: Number(displaySpin),
      telemetrySource,
      effortTier: averages.avgEffort >= 800 ? "platinum" : averages.avgEffort >= 650 ? "gold" : averages.avgEffort >= 500 ? "silver" : "bronze",
      zones: { recovery: 25, endurance: 35, threshold: 25, sprint: 15 },
      proof: {
        mode: rewardMode === "sui-native" ? "none" : rewardMode,
        status: rewardClaimStatus?.phase === "claimed" ? "claimed" : rewardClaimStatus?.phase === "ready" ? "ready" : rewardClaimStatus?.phase === "error" ? "failed" : "idle",
        isVerified: useChainlinkRewards ? chainlinkSuccess : zkSuccess,
        privacyScore, privacyLevel,
        verifiedScore: rewardClaimStatus?.verifiedScore,
      },
      settlement: {
        attempted: walletConnected,
        status: walletConnected ? (useChainlinkRewards ? (chainlinkSuccess ? "confirmed" : "pending") : (zkSuccess ? "confirmed" : "pending")) : "skipped",
      },
    });
    const saved = saveRideSummary(canonicalSummary);
    // Walrus-as-memory: upload the ride to Walrus, then anchor the blob ID on
    // Sui. Detached so it never blocks completion/navigation; the summary is
    // re-saved (idempotent on id) with the anchoring result.
    void (async () => {
      const blobId = await persistRideSummaryToWalrus(canonicalSummary);
      if (!blobId || !suiAccount) return;
      const pointCount = useTelemetryStore.getState().ridePoints.length;
      const anchorResult = await coordinatorRef.current?.anchorSuiTelemetry({
        classId,
        blobId,
        epoch: 90,
        pointCount,
      });
      saveRideSummary({
        ...canonicalSummary,
        anchoring: {
          attempted: true,
          txHash: anchorResult?.digest as `0x${string}` | undefined,
          status: anchorResult ? "confirmed" : "failed",
          commitmentEpoch: 90,
        },
      });
    })();
    const latest = saved.find((ride) => ride.id === canonicalSummary.id) ?? canonicalSummary;
    const queued = enqueueRideSync(latest);
    setCompletedRideId(summaryId);
    setCompletionSyncStatus(queued.sync.status);
    setCompletionPrimaryAction(getRetentionSignals(saved).ctaPrimary);
    void processRideSyncQueue();

    if (isPracticeMode) {
      setDemoStats({ duration: elapsedTime, avgHeartRate: avgHR, maxHeartRate: maxHR, effortScore, spinEarned: displaySpin, rewardsWereActive: true });
      useRideStore.setState({ isExiting: false });
      setShowDemoModal(true);
    } else {
      router.push("/rider/journey?completed=true");
    }
  }, [stopAudio, telemetryAverages, rewards, bleConnected, isPracticeMode, useSimulator, classData, practiceConfig, classId, agentName, address, elapsedTime, rewardMode, rewardClaimStatus, useChainlinkRewards, chainlinkSuccess, zkSuccess, privacyScore, privacyLevel, walletConnected, router, suiAccount]);

  const handleClaimRewards = useCallback(async () => {
    if (isPracticeMode || !address) return;
    const threshold = classData?.metadata?.rewards?.threshold ?? 150;
    const durationSeconds = Math.max(1, Math.floor(elapsedTime));
    if (useChainlinkRewards) {
      await finalizeChainlinkRewards({ classId: classId as `0x${string}`, threshold, duration: durationSeconds });
      return;
    }
    await claimWithZK(
      { spinClass: classId as `0x${string}`, rider: address, rewardAmount: String(classData?.metadata?.rewards?.amount ?? 0), classId: classId as `0x${string}` },
      { heartRate: telemetryAverages.avgHr || telemetryHeartRate, threshold, durationSeconds, heartRateSamples: [], avgPower: telemetryAverages.avgPower },
    );
  }, [isPracticeMode, address, classData, elapsedTime, useChainlinkRewards, finalizeChainlinkRewards, classId, claimWithZK, telemetryAverages, telemetryHeartRate]);

  const handleEnableSimulatorFromModal = useCallback(() => {
    setShowNoBikeModal(false);
    setUseSimulator(true);
    setShowKeyboardHints(true);
    setConnectionHint(null);
  }, []);

  const handleDemoModalClose = useCallback(() => {
    setShowDemoModal(false);
    router.push("/rider");
  }, [router]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // ─── Simulated Rewards (for training/guest mode display) ───────
  const [simulatedSpin, setSimulatedSpin] = useState(0);
  const shouldSimulate = isRiding && (isTrainingMode || isGuestMode);
  useEffect(() => {
    if (!shouldSimulate) { if (!isRiding) setSimulatedSpin(0); return; }
    const id = setInterval(() => {
      setSimulatedSpin((prev) => prev + (10 + (Math.min(1000, telemetryEffort) * 90) / 1000) / (45 * 60));
    }, 1000);
    return () => clearInterval(id);
  }, [shouldSimulate, isRiding, telemetryEffort]);

  const resetSimulatedSpin = useCallback(() => setSimulatedSpin(0), []);
  const simulatedRewards = useMemo(() => ({
    simulatedReward: simulatedSpin,
    isSimulating: shouldSimulate,
    formattedReward: simulatedSpin.toFixed(1),
    reset: resetSimulatedSpin,
  }), [simulatedSpin, shouldSimulate, resetSimulatedSpin]);

  // ─── Social Events (placeholder — CoachingEngine handles via EventBus) ──
  const socialEvents = EMPTY_SOCIAL_EVENTS;
  const handleHighFive = useCallback(() => {}, []);

  // ─── Milestone Logic ───────────────────────────────────────────
  const [showMilestone, setShowMilestone] = useState<{ title: string; subtitle: string } | null>(null);
  const trackedMilestoneRef = useRef(false);
  useEffect(() => {
    if (!isRiding || trackedMilestoneRef.current) return;
    if (telemetryEffort > 900) {
      trackedMilestoneRef.current = true;
      setShowMilestone({ title: "ELITE EFFORT", subtitle: "You just crossed 900 effort points!" });
      haptic.success();
      playSound("achievement");
      setTimeout(() => setShowMilestone(null), 5000);
    }
  }, [telemetryEffort, isRiding, haptic, playSound]);

  // ─── Loading / Not Found Gates ─────────────────────────────────
  if (isLoading && !isPracticeMode) {
    return (
      <RideLoading
        classId={classId}
        isPracticeMode={isPracticeMode}
        practiceClassName={practiceConfig?.name}
        rewardModeLabel={rewardMode === "yellow-stream" ? "Yellow Stream" : rewardMode === "zk-batch" ? "ZK Batch" : "Sui Native"}
        loadStartedAt={loadStartedAt}
        onPracticeMode={() => router.push("/rider?mode=practice")}
        onBack={() => router.push("/rider")}
      />
    );
  }
  if (!classData || !classData.route) return <RideNotFound onExit={exitRide} />;

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black" style={{ height: deviceType === "mobile" ? `${viewportHeight}px` : "100vh" }}>
      <div className="absolute top-2 left-2 right-2 z-50">
        <NetworkStatusBanner />
      </div>

      <SectionErrorBoundary title="ride visualization">
        <RideVisualization
          routeElevationProfile={routeElevationProfile}
          routeCoordinates={routeCoordinates}
          currentRouteCoordinate={currentRouteCoordinate}
          classData={classData}
          workoutPlan={workoutPlan}
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

      <RideHUDOverlay
        classData={classData}
        routeIsGenerated={classData?.routeIsGenerated}
        walletConnected={walletConnected}
        workoutPlan={workoutPlan}
        connectionHint={connectionHint}
        simulatedReward={simulatedRewards}
        panelState={panelState.state}
        rewardMode={rewardMode}
        onSetUseSimulator={setUseSimulator}
        onSetRewardMode={setRewardMode}
        onExitRide={exitRide}
        onResetPrefs={handleResetPrefs}
        onCollapseToggle={handleCollapseToggle}
        isAllCollapsed={panelState.isAllCollapsed}
        onTogglePanel={handleTogglePanel}
        onSetWidgetsMode={panelState.setMobileRideWidgetsMode}
        onStartRide={startRide}
        onPauseRide={pauseRide}
        onSetWorkoutPlan={setWorkoutPlan}
        onBleMetrics={handleBleMetrics}
        onSimulatorMetrics={handleSimulatorMetrics}
        onHaptic={haptic.trigger}
        formatTime={formatTime}
      />

      <RiderSocialFeed events={socialEvents} onHighFive={handleHighFive} />

      {isRiding && viewMode === "immersive" && (
        <div className="fixed top-32 right-6 z-40 flex flex-col gap-4">
          <PerformanceGraph data={telemetryHistory.power} color="text-yellow-400" label="Power" max={400} />
          <PerformanceGraph data={telemetryHistory.cadence} color="text-blue-400" label="Cadence" max={140} />
        </div>
      )}

      {isRiding && viewMode === "immersive" && multiGhostState.length > 0 && (
        <div className="fixed top-32 left-6 z-40 flex flex-col gap-3">
          {multiGhostState.map((rider) => (
            <div key={rider.id} className="flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full pl-1.5 pr-4 py-1.5 animate-in fade-in slide-in-from-left-5 duration-500">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[10px] font-black text-indigo-300">
                  {rider.name.substring(0, 2).toUpperCase()}
                </div>
                {rider.active && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-black animate-pulse" />}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white/80 leading-none">{rider.name}</span>
                <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest mt-0.5">
                  {rider.power}W | {rider.leadLagTime > 0 ? "+" : ""}{rider.leadLagTime.toFixed(1)}s
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <FlowBackground />
      <SettlementStream />
      <CoachMessageOverlay />

      {isRiding && currentInterval?.phase === "sprint" && (
        <div className="absolute inset-0 pointer-events-none rounded-none border-4 border-red-500/60 animate-pulse" />
      )}

      <RideModals
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
        ridePointsRef={emptyRidePointsRef}
        router={router}
        onExitRide={exitRide}
        onEnableSimulatorFromModal={handleEnableSimulatorFromModal}
        onDismissNoBike={handleDismissNoBike}
        onDismissKeyboardHints={handleDismissKeyboardHints}
        onDemoModalClose={handleDemoModalClose}
        onNextTutorial={nextTutorial}
        onDismissTutorial={dismissTutorial}
        onSimulatorMetrics={handleSimulatorMetrics}
      />
    </div>
  );
}
