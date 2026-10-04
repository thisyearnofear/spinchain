"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import { useCallback } from "react";
import {
  createCanonicalRideSummary,
  enqueueRideSync,
  getEffortTier,
  estimateZones,
  getRetentionSignals,
  getRideHistory,
  processRideSyncQueue,
  saveRideSummary,
  type RideSyncStatus,
  type RideSummary,
} from "@/app/lib/analytics/ride-history";
import { createRideReceipt } from "@/app/lib/analytics/ride-receipt";
import { persistRideSummaryToWalrus } from "@/app/lib/walrus/ride-persistence";
import { saveRideToSupabase, RIDE_HISTORY_UPDATED_EVENT } from "@/app/hooks/common/use-supabase-sync";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { isLegacyRewardClaimsEnabled } from "@/app/lib/rewards/legacy-policy";
import type { RewardMode } from "@/app/hooks/rewards/use-rewards";
import type { RewardClaimStatus } from "@/app/lib/rewards";
import type { ClassWithRoute } from "@/app/hooks/evm/use-class-data";
import type { useRideCoordinator } from "@/app/engines/use-ride-coordinator";

interface PersistRideParams {
  classId: string;
  sessionId?: string;
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
  settlementStatus: "pending" | "confirmed" | "failed" | "skipped" | undefined;
  primaryAction: "view_history" | "ride_again";
}

export function useRidePersistence() {
  const suiAccount = useCurrentAccount();

  const persistRide = useCallback(async (params: PersistRideParams): Promise<PersistRideResult> => {
    const {
      classId, sessionId, classData, practiceConfig, agentName, address, elapsedTime,
      averages, samples, bleConnected, isPracticeMode: _isPracticeMode, useSimulator,
      rewardMode, rewardClaimStatus, useChainlinkRewards, chainlinkSuccess,
      zkSuccess, privacyScore, privacyLevel, walletConnected,
      rewardsIsActive, rewardsFinalize, coordinatorRef,
    } = params;

    const avgHR = averages.avgHr || samples.heartRate || 0;
    const effortScore = Math.min(1000, Math.round((Math.max(avgHR, 1) / 200) * 1000));
    const potentialReward = 10 + (effortScore * 90) / 1000;

    const legacyEnabled = isLegacyRewardClaimsEnabled();

    const completedAt = Date.now();
    const summaryId = sessionId ?? `${classId}-${completedAt}`;

    const prior = getRideHistory().find((r) => r.id === summaryId);
    if (prior) {
      const rider = address ?? "guest";
      if (
        prior.riderId.toLowerCase() !== rider.toLowerCase() ||
        (prior.classId && prior.classId !== classId)
      ) {
        throw new Error("Ride identity conflict: record belongs to a different rider or class");
      }
      return {
        canonicalSummary: prior,
        spinEarned: legacyEnabled ? prior.spinEarned.toFixed(1) : "0",
        effortScore: Math.min(1000, Math.round((Math.max(prior.avgHeartRate, 1) / 200) * 1000)),
        avgHR: prior.avgHeartRate,
        walrusAnchorInfo: null,
        syncStatus: prior.sync.status,
        settlementStatus: prior.settlement?.status,
        primaryAction: getRetentionSignals(getRideHistory()).ctaPrimary,
      };
    }
    const finalCompletedAt = completedAt;

    const telemetrySource = useSimulator ? "simulator" as const : bleConnected ? "live-bike" as const : "estimated" as const;

    const canonicalSummary = createCanonicalRideSummary({
      id: summaryId,
      riderId: address ?? "guest",
      classId,
      className: classData?.name || practiceConfig?.name || "SpinChain Ride",
      instructor: classData?.instructor || practiceConfig?.instructor || agentName,
      completedAt: finalCompletedAt,
      durationSec: elapsedTime,
      avgHeartRate: avgHR,
      avgPower: averages.avgPower,
      avgEffort: averages.avgEffort,
      spinEarned: 0,
      telemetrySource,
      effortTier: getEffortTier(averages.avgEffort).tier,
      zones: estimateZones(averages.avgEffort),
      proof: legacyEnabled
        ? {
            mode: rewardMode === "sui-native" ? "none" : rewardMode,
            status: rewardClaimStatus?.phase === "claimed" ? "claimed" : rewardClaimStatus?.phase === "ready" ? "ready" : rewardClaimStatus?.phase === "error" ? "failed" : "idle",
            isVerified: useChainlinkRewards ? chainlinkSuccess : zkSuccess,
            privacyScore, privacyLevel,
            verifiedScore: rewardClaimStatus?.verifiedScore,
          }
        : {
            mode: "none",
            status: "idle",
            isVerified: false,
            privacyScore: 0,
            privacyLevel: "high",
          },
      settlement: legacyEnabled
        ? {
            attempted: walletConnected,
            status: walletConnected ? (useChainlinkRewards ? (chainlinkSuccess ? "confirmed" : "pending") : (zkSuccess ? "confirmed" : "pending")) : "skipped",
          }
        : { attempted: false, status: "skipped" },
    });

    canonicalSummary.receipt = createRideReceipt(canonicalSummary, sessionId ?? canonicalSummary.id);

    const saved = saveRideSummary(canonicalSummary);

    // Mirror to Supabase (fire-and-forget — localStorage remains primary for UI)
    void saveRideToSupabase(canonicalSummary);

    window.dispatchEvent(new CustomEvent(RIDE_HISTORY_UPDATED_EVENT));

    let spinEarned = "0";
    if (legacyEnabled && rewardsIsActive) {
      try {
        const result = await rewardsFinalize();
        spinEarned = result.amount ? (Number(result.amount) / 1e18).toFixed(1) : "0";
      } catch { /* non-blocking */ }
    }
    const displaySpin = legacyEnabled
      ? (spinEarned !== "0" ? spinEarned : potentialReward.toFixed(1))
      : "0";

    if (displaySpin !== "0") {
      canonicalSummary.spinEarned = Number(displaySpin);
      saveRideSummary(canonicalSummary);
    }

    let walrusAnchorInfo: { blobId: string; txDigest?: string } | null = null;
    let queuedStatus: RideSyncStatus = "local_only";

    if (legacyEnabled) {
      try {
        const blobId = await persistRideSummaryToWalrus(canonicalSummary);
        if (blobId) {
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
        }
      } catch (err) {
        console.warn("[Ride] Walrus anchoring failed:", err);
      }

      const latest = saved.find((ride) => ride.id === canonicalSummary.id) ?? canonicalSummary;
      const queued = enqueueRideSync(latest);
      void processRideSyncQueue();
      queuedStatus = queued.sync.status;
    }

    return {
      canonicalSummary,
      spinEarned: displaySpin,
      effortScore,
      avgHR,
      walrusAnchorInfo,
      syncStatus: queuedStatus,
      settlementStatus: canonicalSummary.settlement?.status,
      primaryAction: getRetentionSignals(saved).ctaPrimary,
    };
  }, [suiAccount]);

  return { persistRide };
}
