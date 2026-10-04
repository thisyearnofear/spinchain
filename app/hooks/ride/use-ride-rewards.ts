"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useRewards, type RewardMode } from "@/app/hooks/rewards/use-rewards";
import { useRewardsStore } from "@/app/stores/rewards-store";
import { useChainlinkVerification } from "@/app/hooks/evm/use-chainlink-verification";
import { useZKClaim } from "@/app/hooks/evm/use-zk-claim";
import { REWARD_VERIFICATION } from "@/app/config";
import { isLegacyRewardClaimsEnabled } from "@/app/lib/rewards/legacy-policy";
import { updateRideRewardState, getRideHistory } from "@/app/lib/analytics/ride-history";
import { saveRideToSupabase, RIDE_HISTORY_UPDATED_EVENT } from "@/app/hooks/common/use-supabase-sync";
import type { RewardClaimStatus } from "@/app/lib/rewards";
import type { ClassWithRoute } from "@/app/hooks/evm/use-class-data";

interface UseRideRewardsParams {
  rewardMode: RewardMode;
  classId: string;
  classData: ClassWithRoute | null;
  isPracticeMode: boolean;
  isTrainingMode: boolean;
  address?: string;
  elapsedTime: number;
  telemetryAverages: { avgHr: number; avgPower: number };
  getHeartRateSamples: () => number[];
}

export function useRideRewards({
  rewardMode,
  classId,
  classData,
  isPracticeMode,
  isTrainingMode,
  address,
  elapsedTime,
  telemetryAverages,
  getHeartRateSamples,
}: UseRideRewardsParams) {
  const rewards = useRewards({
    mode: rewardMode,
    classId,
    instructor: (classData?.instructor as `0x${string}`) || "0x0",
    depositAmount: classData?.currentPrice ? BigInt(Math.floor(parseFloat(classData.currentPrice) * 1e18)) : BigInt(0),
  });

  const { claimWithZK, isGeneratingProof, isPending: zkPending, isSuccess: zkSuccess, hash: zkHash, privacyScore, privacyLevel, error: zkError, reset: zkReset } = useZKClaim();
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
  const [completedRideId, setCompletedRideIdState] = useState<string | null>(null);

  const prevClassRef = useRef(classId);
  useEffect(() => {
    if (prevClassRef.current !== classId) {
      prevClassRef.current = classId;
      setCompletedRideIdState(null);
      zkReset();
    }
  }, [classId, zkReset]);

  const setCompletedRideId = useCallback(
    (id: string | null) => {
      if (id !== completedRideId) zkReset();
      setCompletedRideIdState(id);
    },
    [completedRideId, zkReset],
  );

  // Yellow streaming is driven by this hook (wallet-signed channel), but the
  // in-ride HUD reads the rewards store — bridge the stream state across.
  // zk-batch/sui-native accrual is written to the store by the coordinator
  // (rewards:tick); hook now also computes live zk estimate so CTA has value
  // even without coordinator.
  useEffect(() => {
    if (rewardMode !== "yellow-stream") return;
    useRewardsStore.setState({
      isActive: rewards.isActive,
      streamState: rewards.streamState ?? null,
      clearNodeConnected: rewards.clearNodeConnected ?? false,
      accumulatedReward: rewards.accumulatedReward,
      formattedReward: rewards.formattedReward,
    });
  }, [rewardMode, rewards.isActive, rewards.streamState, rewards.clearNodeConnected, rewards.accumulatedReward, rewards.formattedReward]);

  // Prefer the coordinator's live store value (rewards:tick) when available;
  // the hook's zk-batch estimate is the fallback for standalone / test usage.
  const storeFormatted = useRewardsStore((s) => s.formattedReward);
  const storeAccumulated = useRewardsStore((s) => s.accumulatedReward);
  const effectiveRewards = useMemo(() => {
    const hasStoreValue = storeAccumulated !== BigInt(0) && storeFormatted !== "0" && storeFormatted !== "0.00";
    if (hasStoreValue) {
      return { ...rewards, accumulatedReward: storeAccumulated, formattedReward: storeFormatted };
    }
    return rewards;
  }, [rewards, storeAccumulated, storeFormatted]);

  const rewardClaimStatus: RewardClaimStatus | undefined = useMemo(() => {
    if (!isLegacyRewardClaimsEnabled()) return undefined;
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
      phase: (isGeneratingProof || zkPending ? "claiming" : zkSuccess ? "claimed" : zkError ? "error" : "idle") as RewardClaimStatus["phase"],
      privacyScore, privacyLevel, error: zkError,
    };
  }, [isPracticeMode, isTrainingMode, useChainlinkRewards, isChainlinkClaiming, isChainlinkVerifying, chainlinkSuccess, isChainlinkVerified, chainlinkError, isChainlinkRequestSuccess, chainlinkVerifiedScore, isGeneratingProof, zkPending, zkSuccess, zkError, privacyScore, privacyLevel]);

  useEffect(() => {
    if (!isLegacyRewardClaimsEnabled()) return;
    if (!completedRideId || !rewardClaimStatus) return;
    const saved = getRideHistory().find((r) => r.id === completedRideId);
    if (
      saved &&
      (!address ||
        saved.riderId.toLowerCase() !== address.toLowerCase() ||
        (saved.classId && saved.classId !== classId))
    ) {
      return;
    }
    if (
      saved?.proof.status === "claimed" &&
      rewardClaimStatus.phase !== "claimed" &&
      rewardClaimStatus.phase !== "claiming"
    ) {
      return;
    }
    updateRideRewardState(completedRideId, {
      status: rewardClaimStatus.phase === "claimed" ? "claimed" : rewardClaimStatus.phase === "ready" ? "ready" : rewardClaimStatus.phase === "requested" ? "requested" : rewardClaimStatus.phase === "error" ? "failed" : "idle",
      isVerified: rewardClaimStatus.phase === "ready" || rewardClaimStatus.phase === "claimed",
      privacyScore: rewardClaimStatus.privacyScore, privacyLevel: rewardClaimStatus.privacyLevel, verifiedScore: rewardClaimStatus.verifiedScore,
    }, {
      attempted: rewardClaimStatus.phase !== "idle",
      txHash: zkHash,
      status: rewardClaimStatus.phase === "claimed" ? "confirmed" : rewardClaimStatus.phase === "error" ? "failed" : rewardClaimStatus.phase === "idle" ? "skipped" : "pending",
    });
    if (rewardClaimStatus.phase === "claimed") {
      const ride = getRideHistory().find((r) => r.id === completedRideId);
      if (
        ride &&
        address &&
        ride.riderId.toLowerCase() === address.toLowerCase()
      ) {
        void saveRideToSupabase(ride).finally(() => {
          window.dispatchEvent(new CustomEvent(RIDE_HISTORY_UPDATED_EVENT));
        });
      }
    }
  }, [completedRideId, rewardClaimStatus, address, zkHash, classId]);

  const handleClaimRewards = async () => {
    if (!isLegacyRewardClaimsEnabled() || isPracticeMode || !address) return;
    const threshold = classData?.metadata?.rewards?.threshold ?? 150;
    const completedRide = completedRideId
      ? getRideHistory().find((r) => r.id === completedRideId)
      : undefined;
    if (completedRide) {
      if (
        completedRide.riderId.toLowerCase() !== address.toLowerCase() ||
        (completedRide.classId && completedRide.classId !== classId)
      ) {
        console.error("[Rewards] Claim refused: ride does not belong to this wallet/class");
        return;
      }
      if (completedRide.proof.status === "claimed") {
        console.error("[Rewards] Claim refused: ride already claimed");
        return;
      }
    }
    const durationSeconds = Math.max(
      1,
      Math.floor(completedRide?.durationSec ?? elapsedTime),
    );
    try {
      if (useChainlinkRewards) {
        await finalizeChainlinkRewards({ classId: classId as `0x${string}`, threshold, duration: durationSeconds });
        return;
      }
      zkReset();
      await claimWithZK(
        { spinClass: classId as `0x${string}`, rider: address as `0x${string}`, rewardAmount: String(classData?.metadata?.rewards?.amount ?? 0), classId: classId as `0x${string}` },
        { heartRate: telemetryAverages.avgHr || useTelemetryStore.getState().snapshot.heartRate, threshold, durationSeconds, heartRateSamples: getHeartRateSamples(), avgPower: telemetryAverages.avgPower },
      );
    } catch (err) {
      console.error("[Rewards] Claim failed:", err);
    }
  };

  return {
    rewards: effectiveRewards,
    rewardClaimStatus,
    useChainlinkRewards,
    chainlinkSuccess,
    zkSuccess,
    privacyScore,
    privacyLevel,
    setCompletedRideId,
    handleClaimRewards,
  };
}
