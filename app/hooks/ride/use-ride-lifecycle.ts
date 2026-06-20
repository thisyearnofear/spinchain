"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { ANALYTICS_EVENTS, trackEvent } from "@/app/lib/analytics/events";
import {
  createCanonicalRideSummary,
  enqueueRideSync,
  getRetentionSignals,
  processRideSyncQueue,
  saveRideSummary,
  type RideSyncStatus,
} from "@/app/lib/analytics/ride-history";
import { persistRideSummaryToWalrus } from "@/app/lib/walrus/ride-persistence";
import type { RewardMode } from "@/app/hooks/rewards/use-rewards";
import type { RewardClaimStatus } from "@/app/components/features/ride/ride-completion";
import type { useRideCoordinator } from "@/app/engines/use-ride-coordinator";
import type { WorkoutPlan } from "@/app/lib/workout-plan";
import type { DeviceType, PerformanceTier } from "@/app/engines/types";

interface UseRideLifecycleParams {
  classId: string;
  classData?: any;
  practiceConfig: { name?: string; instructor?: string } | null;
  isPracticeMode: boolean;
  isTrainingMode: boolean;
  bleConnected: boolean;
  useSimulator: boolean;
  walletConnected: boolean;
  address?: string;
  rewardMode: RewardMode;
  agentName: string;
  workoutPlan: WorkoutPlan | null;
  deviceType: DeviceType;
  performanceTier: PerformanceTier;
  telemetryAverages: { avgHr: number; avgPower: number; avgEffort: number };
  elapsedTime: number;
  rewardClaimStatus: RewardClaimStatus | undefined;
  useChainlinkRewards: boolean;
  chainlinkSuccess: boolean;
  zkSuccess: boolean;
  privacyScore: number;
  privacyLevel: "high" | "medium" | "low";
  rewards: {
    isActive: boolean;
    startEarning: () => Promise<void>;
    finalizeRewards: () => Promise<{ success: boolean; amount: bigint; hash?: string }>;
    formattedReward: string;
  };
  coordinator: ReturnType<typeof useRideCoordinator>;
  coordinatorRef: React.MutableRefObject<ReturnType<typeof useRideCoordinator> | null>;
  isRidingRef: React.MutableRefObject<boolean>;
  trackedCompletionRef: React.MutableRefObject<boolean>;
  playCountdown: (seconds: number) => void;
  playSound: (type: unknown) => void;
  stopAudio: () => void;
  speak: (text: string, emotion?: unknown) => void;
  setUseSimulator: (v: boolean) => void;
  setBleConnected?: (v: boolean) => void;
  trackLiveTelemetry: () => void;
}

export function useRideLifecycle({
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
  rewardClaimStatus,
  useChainlinkRewards,
  chainlinkSuccess,
  zkSuccess,
  privacyScore,
  privacyLevel,
  rewards,
  coordinator,
  coordinatorRef,
  isRidingRef,
  trackedCompletionRef,
  playCountdown,
  playSound,
  stopAudio,
  speak,
  setUseSimulator,
  trackLiveTelemetry,
}: UseRideLifecycleParams) {
  const router = useRouter();
  const suiClient = useSuiClient();
  const suiAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteSui } = useSignAndExecuteTransaction();

  const [showNoBikeModal, setShowNoBikeModal] = useState(false);
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);
  const [connectionHint, setConnectionHint] = useState<string | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [completionSyncStatus, setCompletionSyncStatus] = useState<RideSyncStatus>("local_only");
  const [completionPrimaryAction, setCompletionPrimaryAction] = useState<"view_history" | "ride_again">("view_history");
  const [demoStats, setDemoStats] = useState({ duration: 0, avgHeartRate: 0, maxHeartRate: 0, effortScore: 0, spinEarned: "0", rewardsWereActive: false });
  const [walrusAnchorInfo, setWalrusAnchorInfo] = useState<{ blobId: string; txDigest?: string } | null>(null);
  const [completedRideId, setCompletedRideIdState] = useState<string | null>(null);

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

  useEffect(() => {
    coordinatorRef.current?.updateSuiConfig({
      executeTransaction: suiExecuteTransaction,
      suiClient: suiClient as unknown as Parameters<
        typeof coordinatorRef.current.updateSuiConfig
      >[0]["suiClient"],
    });
  }, [suiExecuteTransaction, suiClient, coordinatorRef]);

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
        aiActive: isPracticeMode || Boolean(classData?.metadata?.ai?.enabled),
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
  }, [bleConnected, useSimulator, classId, isPracticeMode, isTrainingMode, rewards, coordinator, classData, deviceType, performanceTier, walletConnected, address, rewardMode, agentName, workoutPlan, playCountdown, speak, isRidingRef, trackedCompletionRef]);

  const pauseRide = useCallback(() => {
    isRidingRef.current = false;
    useRideStore.setState({ isActive: false });
    playSound("recover");
  }, [playSound, isRidingRef]);

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
    void (async () => {
      const blobId = await persistRideSummaryToWalrus(canonicalSummary);
      if (!blobId) return;
      if (suiAccount) {
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
        setWalrusAnchorInfo({ blobId, txDigest: anchorResult?.digest });
      } else {
        setWalrusAnchorInfo({ blobId });
      }
    })();
    const latest = saved.find((ride) => ride.id === canonicalSummary.id) ?? canonicalSummary;
    const queued = enqueueRideSync(latest);
    setCompletedRideIdState(summaryId);
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
  }, [stopAudio, telemetryAverages, rewards, bleConnected, isPracticeMode, useSimulator, classData, practiceConfig, classId, agentName, address, elapsedTime, rewardMode, rewardClaimStatus, useChainlinkRewards, chainlinkSuccess, zkSuccess, privacyScore, privacyLevel, walletConnected, router, suiAccount, coordinatorRef]);

  const handleEnableSimulatorFromModal = useCallback(() => {
    setShowNoBikeModal(false);
    setUseSimulator(true);
    setShowKeyboardHints(true);
    setConnectionHint(null);
  }, [setUseSimulator]);

  const handleDemoModalClose = useCallback(() => {
    setShowDemoModal(false);
    router.push("/rider");
  }, [router]);

  const handleDismissNoBike = useCallback(() => setShowNoBikeModal(false), []);
  const handleDismissKeyboardHints = useCallback(() => setShowKeyboardHints(false), []);

  const handleBleMetrics = useCallback((metrics: { heartRate?: number; power?: number; cadence?: number; speed?: number; effort?: number; distance?: number; timestamp?: number }) => {
    coordinator.ingestBleMetrics(metrics);
    if (metrics.heartRate || metrics.power) {
      trackLiveTelemetry();
    }
  }, [coordinator, trackLiveTelemetry]);

  return {
    showNoBikeModal,
    showKeyboardHints,
    connectionHint,
    showDemoModal,
    completionSyncStatus,
    completionPrimaryAction,
    demoStats,
    walrusAnchorInfo,
    completedRideId,
    setCompletedRideId: setCompletedRideIdState,
    startRide,
    pauseRide,
    exitRide,
    handleEnableSimulatorFromModal,
    handleDemoModalClose,
    handleDismissNoBike,
    handleDismissKeyboardHints,
    handleBleMetrics,
  };
}
