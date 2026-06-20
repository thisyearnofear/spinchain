"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import { useCallback } from "react";
import {
  createCanonicalRideSummary,
  enqueueRideSync,
  getRetentionSignals,
  processRideSyncQueue,
  saveRideSummary,
  type RideSyncStatus,
  type RideSummary,
} from "@/app/lib/analytics/ride-history";
import { persistRideSummaryToWalrus } from "@/app/lib/walrus/ride-persistence";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import type { RewardMode } from "@/app/hooks/rewards/use-rewards";
import type { RewardClaimStatus } from "@/app/components/features/ride/ride-completion";
import type { ClassWithRoute } from "@/app/hooks/evm/use-class-data";
import type { useRideCoordinator } from "@/app/engines/use-ride-coordinator";

interface PersistRideParams {
  classId: string;
  classData: ClassWithRoute | null;
  practiceConfig: { name?: string; instructor?: string } | null;
  agentName: string;
  address?: string;
  elapsedTime: number;
  averages: { avgHr: number; avgPower: number; avgEffort: number };
  samples: { heartRate: number };
  bleConnected: boolean;
  isPracticeMode: boolean;
  useSimulator: boolean;
  rewardMode: RewardMode;
  rewardClaimStatus: RewardClaimStatus | undefined;
  useChainlinkRewards: boolean;
  chainlinkSuccess: boolean;
  zkSuccess: boolean;
  privacyScore: number;
  privacyLevel: "high" | "medium" | "low";
  walletConnected: boolean;
  rewardsIsActive: boolean;
  rewardsFinalize: () => Promise<{ success: boolean; amount: bigint; hash?: string }>;
  coordinatorRef: React.MutableRefObject<ReturnType<typeof useRideCoordinator> | null>;
}

interface PersistRideResult {
  canonicalSummary: RideSummary;
  spinEarned: string;
  effortScore: number;
  avgHR: number;
  walrusAnchorInfo: { blobId: string; txDigest?: string } | null;
  syncStatus: RideSyncStatus;
  primaryAction: "view_history" | "ride_again";
}

export function useRidePersistence() {
  const suiAccount = useCurrentAccount();

  const persistRide = useCallback(async (params: PersistRideParams): Promise<PersistRideResult> => {
    const {
      classId, classData, practiceConfig, agentName, address, elapsedTime,
      averages, samples, bleConnected, isPracticeMode, useSimulator,
      rewardMode, rewardClaimStatus, useChainlinkRewards, chainlinkSuccess,
      zkSuccess, privacyScore, privacyLevel, walletConnected,
      rewardsIsActive, rewardsFinalize, coordinatorRef,
    } = params;

    const avgHR = averages.avgHr || samples.heartRate;
    const effortScore = Math.min(1000, Math.round((avgHR / 200) * 1000));
    const potentialReward = 10 + (effortScore * 90) / 1000;

    let spinEarned = "0";
    if (rewardsIsActive) {
      try {
        const result = await rewardsFinalize();
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

    let walrusAnchorInfo: { blobId: string; txDigest?: string } | null = null;
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
        walrusAnchorInfo = { blobId, txDigest: anchorResult?.digest };
      } else {
        walrusAnchorInfo = { blobId };
      }
    })();

    const latest = saved.find((ride) => ride.id === canonicalSummary.id) ?? canonicalSummary;
    const queued = enqueueRideSync(latest);
    void processRideSyncQueue();

    return {
      canonicalSummary,
      spinEarned: displaySpin,
      effortScore,
      avgHR,
      walrusAnchorInfo,
      syncStatus: queued.sync.status,
      primaryAction: getRetentionSignals(saved).ctaPrimary,
    };
  }, [suiAccount]);

  return { persistRide };
}
