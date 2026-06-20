"use client";

import { useEffect, useMemo, useState } from "react";
import { useRewards, type RewardMode } from "@/app/hooks/rewards/use-rewards";
import { useChainlinkVerification } from "@/app/hooks/evm/use-chainlink-verification";
import { useZKClaim } from "@/app/hooks/evm/use-zk-claim";
import { REWARD_VERIFICATION } from "@/app/config";
import { updateRideRewardState } from "@/app/lib/analytics/ride-history";
import type { RewardClaimStatus } from "@/app/components/features/ride/ride-completion";
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
  telemetryHeartRate: number;
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
  telemetryHeartRate,
}: UseRideRewardsParams) {
  const rewards = useRewards({
    mode: rewardMode,
    classId,
    instructor: (classData?.instructor as `0x${string}`) || "0x0",
    depositAmount: classData?.currentPrice ? BigInt(Math.floor(parseFloat(classData.currentPrice) * 1e18)) : BigInt(0),
  });

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

  const handleClaimRewards = async () => {
    if (isPracticeMode || !address) return;
    const threshold = classData?.metadata?.rewards?.threshold ?? 150;
    const durationSeconds = Math.max(1, Math.floor(elapsedTime));
    try {
      if (useChainlinkRewards) {
        await finalizeChainlinkRewards({ classId: classId as `0x${string}`, threshold, duration: durationSeconds });
        return;
      }
      await claimWithZK(
        { spinClass: classId as `0x${string}`, rider: address as `0x${string}`, rewardAmount: String(classData?.metadata?.rewards?.amount ?? 0), classId: classId as `0x${string}` },
        { heartRate: telemetryAverages.avgHr || telemetryHeartRate, threshold, durationSeconds, heartRateSamples: [], avgPower: telemetryAverages.avgPower },
      );
    } catch (err) {
      console.error("[Rewards] Claim failed:", err);
    }
  };

  return {
    rewards,
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
