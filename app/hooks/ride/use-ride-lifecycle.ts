"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { ANALYTICS_EVENTS, trackEvent } from "@/app/lib/analytics/events";
import { processRideSyncQueue, getRideHistory, getStreakStats } from "@/app/lib/analytics/ride-history";
import { useRidePersistence } from "./use-ride-persistence";
import { useRiderProfile, mapCoachPersonalityToEngine } from "@/app/stores/rider-profile-store";
import { formatAddress } from "@/app/lib/profile-service";
import { useRideModalStore } from "@/app/stores/ride-modal-store";
import type { RewardMode } from "@/app/hooks/rewards/use-rewards";
import type { RewardClaimStatus } from "@/app/components/features/ride/ride-completion";
import type { useRideCoordinator } from "@/app/engines/use-ride-coordinator";
import type { WorkoutPlan } from "@/app/lib/workout-plan";
import type { DeviceType, PerformanceTier } from "@/app/engines/types";
import type { ClassWithRoute } from "@/app/hooks/evm/use-class-data";

interface UseRideLifecycleParams {
  classId: string;
  classData: ClassWithRoute | null;
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
  setBleConnected: (v: boolean) => void;
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
  const { mutateAsync: signAndExecuteSui } = useSignAndExecuteTransaction();

  const [connectionHint, setConnectionHint] = useState<string | null>(null);

  const modalStore = useRideModalStore;

  const suiExecuteTransaction = useCallback(
    async (tx: unknown): Promise<{ digest: string; effects?: unknown } | null> => {
      try {
        const result = await signAndExecuteSui({
          transaction: tx as Parameters<typeof signAndExecuteSui>[0]["transaction"],
        });
        if (result?.digest) {
          return { digest: result.digest, effects: result.effects };
        }
        return null;
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

  const { persistRide } = useRidePersistence();
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup pending start timeout on unmount
  useEffect(() => {
    return () => {
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
    };
  }, []);

  const startRide = useCallback(async () => {
    // Guard against double-start
    if (useRideStore.getState().isStarting || isRidingRef.current) return;

    const telemetryReady = bleConnected || useSimulator;
    if (!telemetryReady) {
      modalStore.getState().setShowNoBikeModal(true);
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
      classData: classData ? {
        metadata: classData.metadata,
        route: classData.route,
      } : null,
      deviceType,
      performanceTier,
      isPracticeMode,
      walletConnected: !!walletConnected,
      address,
      rewardMode,
      coachingConfig: {
        agentName,
        personality: (classData?.metadata?.ai?.personality as "zen" | "drill-sergeant" | "data")
          || mapCoachPersonalityToEngine(useRiderProfile.getState().coachPersonality),
        workoutPlan,
        instructorProfile: null,
        marketStats: { ticketsSold: 0, revenue: 0, capacity: 50 },
        aiActive: isPracticeMode || Boolean(classData?.metadata?.ai?.enabled),
      },
      ghostBlobId: classData?.metadata?.route?.walrusBlobId,
    }).catch((err: unknown) => console.warn("[Ride] Coordinator start failed:", err));

    const { rideProgress, elapsedTime } = useRideStore.getState();
    const isResuming = rideProgress > 0 || elapsedTime > 0;

    if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
    startTimeoutRef.current = setTimeout(() => {
      isRidingRef.current = true;
      useRideStore.setState({ isActive: true, isStarting: false });
      if (!isResuming) {
        useRideStore.setState({ rideProgress: 0, elapsedTime: 0 });
        useTelemetryStore.getState().reset();
        trackedCompletionRef.current = false;
      }

      // Personalized coach greeting
      const rides = getRideHistory();
      const streakStats = getStreakStats(rides);
      const rideCount = rides.length;
      const greetingName = address
        ? formatAddress(address)
        : "Rider";

      let greeting: string;
      if (rideCount === 0) {
        greeting = `Welcome ${greetingName}, let's get started!`;
      } else if (streakStats.daily > 0) {
        greeting = `Welcome back ${greetingName}. Day ${streakStats.daily} of your streak — let's keep it alive!`;
      } else {
        greeting = `Welcome back ${greetingName}. Let's ride!`;
      }
      speak(greeting, "intense");
    }, 3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bleConnected, useSimulator, classId, isPracticeMode, isTrainingMode, rewards, coordinator, classData, deviceType, performanceTier, walletConnected, address, rewardMode, agentName, workoutPlan, playCountdown, speak, isRidingRef, trackedCompletionRef]);

  const pauseRide = useCallback(() => {
    isRidingRef.current = false;
    useRideStore.setState({ isActive: false });
    playSound("recover");
  }, [playSound, isRidingRef]);

  const exitRide = useCallback(async () => {
    if (useRideStore.getState().isExiting) return; // Guard against double-exit
    useRideStore.setState({ isExiting: true });
    modalStore.getState().setIsExitingRide(true);
    stopAudio();

    try {
      const averages = telemetryAverages;
      const samples = useTelemetryStore.getState().snapshot;

      const result = await persistRide({
        classId,
        classData,
        practiceConfig,
        agentName,
        address,
        elapsedTime,
        averages,
        samples,
        bleConnected,
        isPracticeMode,
        useSimulator,
        rewardMode,
        rewardClaimStatus,
        useChainlinkRewards,
        chainlinkSuccess,
        zkSuccess,
        privacyScore,
        privacyLevel: (privacyLevel || "low") as "high" | "medium" | "low",
        walletConnected,
        rewardsIsActive: rewards.isActive,
        rewardsFinalize: rewards.finalizeRewards,
        coordinatorRef,
      });

      modalStore.getState().setWalrusAnchorInfo(result.walrusAnchorInfo);
      modalStore.getState().setCompletedRideId(result.canonicalSummary.id);
      modalStore.getState().setCompletionSyncStatus(result.syncStatus);
      modalStore.getState().setCompletionSettlementStatus(result.settlementStatus);
      modalStore.getState().setCompletionPrimaryAction(result.primaryAction);
      void processRideSyncQueue();

      // Stop the ride UI and show completion screen for all modes
      useRideStore.setState({ isActive: false });
      modalStore.getState().setIsExitingRide(false);

      if (isPracticeMode) {
        modalStore.getState().setDemoStats({ duration: elapsedTime, avgHeartRate: result.avgHR, maxHeartRate: result.avgHR, effortScore: result.effortScore, spinEarned: result.spinEarned, rewardsWereActive: true });
        useRideStore.setState({ isExiting: false });
        modalStore.getState().setShowCompletionScreen(true);
      } else {
        modalStore.getState().setShowCompletionScreen(true);
      }
    } catch (err) {
      console.error("[Ride] exitRide failed:", err);
      useRideStore.setState({ isExiting: false, isActive: false });
      modalStore.getState().setIsExitingRide(false);
      if (isPracticeMode) {
        modalStore.getState().setShowCompletionScreen(true);
      } else {
        router.push("/rider/journey?completed=true");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopAudio, telemetryAverages, persistRide, classId, classData, practiceConfig, agentName, address, elapsedTime, bleConnected, isPracticeMode, useSimulator, rewardMode, rewardClaimStatus, useChainlinkRewards, chainlinkSuccess, zkSuccess, privacyScore, privacyLevel, walletConnected, rewards, coordinatorRef, router]);

  const handleEnableSimulatorFromModal = useCallback(() => {
    modalStore.getState().setShowNoBikeModal(false);
    setUseSimulator(true);
    modalStore.getState().setShowKeyboardHints(true);
    setConnectionHint(null);
  }, [setUseSimulator, modalStore]);

  const handleDemoModalClose = useCallback(() => {
    modalStore.getState().setShowDemoModal(false);
    router.push("/rider");
  }, [router, modalStore]);

  const handleDismissNoBike = useCallback(() => modalStore.getState().setShowNoBikeModal(false), [modalStore]);
  const handleDismissKeyboardHints = useCallback(() => modalStore.getState().setShowKeyboardHints(false), [modalStore]);

  const handleBleMetrics = useCallback((metrics: { heartRate?: number; power?: number; cadence?: number; speed?: number; effort?: number; distance?: number; timestamp?: number }) => {
    coordinator.ingestBleMetrics(metrics);
    if (metrics.heartRate || metrics.power) {
      trackLiveTelemetry();
    }
  }, [coordinator, trackLiveTelemetry]);

  const handleCompletionExit = useCallback(() => {
    modalStore.getState().setShowCompletionScreen(false);
    modalStore.getState().setWalrusAnchorInfo(null);
    modalStore.getState().setShowDemoModal(false);
    if (isPracticeMode) {
      router.push("/rider");
    } else {
      router.push("/rider/journey?completed=true");
    }
  }, [router, isPracticeMode, modalStore]);

  return {
    connectionHint,
    startRide,
    pauseRide,
    exitRide,
    handleCompletionExit,
    handleEnableSimulatorFromModal,
    handleDemoModalClose,
    handleDismissNoBike,
    handleDismissKeyboardHints,
    handleBleMetrics,
  };
}
