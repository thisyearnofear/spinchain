"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { RewardClaimStatus } from "@/app/lib/rewards";
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
  playSound: (type: unknown) => void;
  stopAudio: () => void;
  speak: (text: string, emotion?: unknown) => void;
  setUseSimulator: (v: boolean) => void;
}

export function useRideLifecycle(params: UseRideLifecycleParams) {
  // The ride page re-renders continuously (telemetry, sensory-sync, flow
  // updates) and most params change identity every render. Handlers read
  // everything through this ref so they — and the returned object — stay
  // referentially stable. Consumers can then list `lifecycle.pauseRide`
  // etc. in effect deps without resubscribing on every render.
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

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
    paramsRef.current.coordinatorRef.current?.updateSuiConfig({
      executeTransaction: suiExecuteTransaction,
      suiClient: suiClient as unknown as Parameters<
        NonNullable<typeof paramsRef.current.coordinatorRef.current>["updateSuiConfig"]
      >[0]["suiClient"],
    });
  }, [suiExecuteTransaction, suiClient]);

  const { persistRide } = useRidePersistence();

  const startRide = useCallback(async () => {
    const {
      bleConnected, useSimulator, classId, isPracticeMode, isTrainingMode,
      rewards, coordinator, classData, deviceType, performanceTier,
      walletConnected, address, rewardMode, agentName, workoutPlan,
      speak, isRidingRef, trackedCompletionRef,
    } = paramsRef.current;

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

    // ActivationTransition (or Skip) is the single ~3s ceremony. Do NOT
    // playCountdown(3) + wait another 3000ms here — isActive / pedals must
    // work on GO. Countdown audio is started when the overlay opens (page).

    // Fire-and-forget: do not await before isActive — pedals must work on GO.
    if (!isTrainingMode) {
      void rewards.startEarning().catch(() => {});
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
  }, [modalStore]);

  const pauseRide = useCallback(() => {
    const { isRidingRef, coordinator, playSound } = paramsRef.current;
    isRidingRef.current = false;
    coordinator.pauseRide();
    useRideStore.setState({ isActive: false, isPaused: true });
    playSound("recover");
  }, []);

  const resumeRide = useCallback(() => {
    const { isRidingRef, coordinator } = paramsRef.current;
    isRidingRef.current = true;
    coordinator.resumeRide();
    useRideStore.setState({ isActive: true, isPaused: false });
  }, []);

  const exitRide = useCallback(async () => {
    const {
      stopAudio, coordinator, classId, classData, practiceConfig, agentName,
      address, elapsedTime, bleConnected, isPracticeMode, useSimulator,
      rewardMode, rewardClaimStatus, useChainlinkRewards, chainlinkSuccess,
      zkSuccess, privacyScore, privacyLevel, walletConnected, rewards,
      coordinatorRef,
    } = paramsRef.current;
    if (useRideStore.getState().isExiting) return; // Guard against double-exit
    useRideStore.setState({ isExiting: true });
    modalStore.getState().setIsExitingRide(true);
    stopAudio();

    try {
      // Stop the engines first — this finalizes telemetry averages into the
      // store and ends the oracle session (background proof generation +
      // encrypted telemetry backup). The coordinator is not disposed here;
      // Sui anchoring inside persistRide still needs it.
      await coordinator.stopEngines().catch(() => {});
      const averages = useTelemetryStore.getState().averages;
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
  }, [persistRide, router, modalStore]);

  const handleEnableSimulatorFromModal = useCallback(() => {
    modalStore.getState().setShowNoBikeModal(false);
    paramsRef.current.setUseSimulator(true);
    modalStore.getState().setShowKeyboardHints(true);
    setConnectionHint(null);
  }, [modalStore]);

  const handleDemoModalClose = useCallback(() => {
    modalStore.getState().setShowDemoModal(false);
    router.push("/rider");
  }, [router, modalStore]);

  const handleDismissNoBike = useCallback(() => modalStore.getState().setShowNoBikeModal(false), [modalStore]);
  const handleDismissKeyboardHints = useCallback(() => modalStore.getState().setShowKeyboardHints(false), [modalStore]);

  const handleCompletionExit = useCallback(() => {
    modalStore.getState().setShowCompletionScreen(false);
    modalStore.getState().setWalrusAnchorInfo(null);
    modalStore.getState().setShowDemoModal(false);
    if (paramsRef.current.isPracticeMode) {
      router.push("/rider");
    } else {
      router.push("/rider/journey?completed=true");
    }
  }, [router, modalStore]);

  // Stable identity: the ride page lists lifecycle.* methods in effect deps
  // (BLE auto-pause, visibility pause); a fresh object each render made those
  // effects resubscribe ~10x/sec, which needed eslint-disables to quiet.
  return useMemo(
    () => ({
      connectionHint,
      startRide,
      pauseRide,
      resumeRide,
      exitRide,
      handleCompletionExit,
      handleEnableSimulatorFromModal,
      handleDemoModalClose,
      handleDismissNoBike,
      handleDismissKeyboardHints,
    }),
    [
      connectionHint,
      startRide,
      pauseRide,
      resumeRide,
      exitRide,
      handleCompletionExit,
      handleEnableSimulatorFromModal,
      handleDemoModalClose,
      handleDismissNoBike,
      handleDismissKeyboardHints,
    ],
  );
}
