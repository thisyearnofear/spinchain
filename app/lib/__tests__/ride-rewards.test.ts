// @vitest-environment jsdom
// Ride reward claim regression tests.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  createCanonicalRideSummary,
  saveRideSummary,
  getRideHistory,
} from "@/app/lib/analytics/ride-history";
import { createRideReceipt } from "@/app/lib/analytics/ride-receipt";

const zk = vi.hoisted(() => ({
  claimWithZK: vi.fn(
    async (
      _params: {
        spinClass: `0x${string}`;
        rider: `0x${string}`;
        rewardAmount: string;
        classId: `0x${string}`;
      },
      _sessionData: {
        heartRate: number;
        threshold: number;
        durationSeconds: number;
        heartRateSamples?: number[];
        avgPower?: number;
      },
    ) => {},
  ),
  isGeneratingProof: false,
  isPending: false,
  isSuccess: false,
  hash: undefined as `0x${string}` | undefined,
  privacyScore: 0,
  privacyLevel: "low" as const,
  error: null as Error | null,
  reset: vi.fn(),
}));

const cloudSave = vi.hoisted(() => vi.fn(async () => true));

vi.mock("@/app/hooks/rewards/use-rewards", () => ({
  useRewards: () => ({
    mode: "zk-batch",
    isActive: true,
    streamState: null,
    clearNodeConnected: false,
    accumulatedReward: BigInt(0),
    formattedReward: "0",
    isConnecting: false,
    isGeneratingProof: false,
    error: null,
    privacyScore: 0,
    privacyLevel: "low",
  }),
}));

vi.mock("@/app/hooks/evm/use-zk-claim", () => ({
  useZKClaim: () => zk,
}));

vi.mock("@/app/hooks/evm/use-chainlink-verification", () => ({
  useChainlinkVerification: () => ({
    finalizeRewards: vi.fn(),
    isVerifying: false,
    isRequestSuccess: false,
    isClaiming: false,
    isVerified: false,
    verifiedScore: undefined,
    isSuccess: false,
    error: null,
  }),
}));

vi.mock("@/app/hooks/common/use-supabase-sync", () => ({
  saveRideToSupabase: cloudSave,
  RIDE_HISTORY_UPDATED_EVENT: "spinchain:ride-history-updated",
}));

import { useRideRewards } from "@/app/hooks/ride/use-ride-rewards";

const RIDER = "0x1111111111111111111111111111111111111111";
const CLASS_ID = "0x7370696e636861696e2d636c61737300000000000000000000000000000000";
const RAW_SAMPLES = new Array(75).fill(160);

function seedCompletedRide(durationSec = 1800) {
  const ride = createCanonicalRideSummary({
    id: "ride-claim",
    riderId: RIDER.toLowerCase(),
    classId: CLASS_ID,
    className: "Test Class",
    instructor: "",
    completedAt: Date.now(),
    durationSec,
    avgHeartRate: 160,
    avgPower: 200,
    avgEffort: 500,
    spinEarned: 0,
    telemetrySource: "live-bike",
    effortTier: "silver",
    zones: { recovery: 0, endurance: 0, threshold: 100, sprint: 0 },
    proof: {
      mode: "zk-batch",
      status: "idle",
      isVerified: false,
      privacyScore: 0,
      privacyLevel: "high",
    },
  });
  saveRideSummary(ride);
  return ride.id;
}

function renderRewards(overrides: Partial<Parameters<typeof useRideRewards>[0]> = {}) {
  return renderHook(() =>
    useRideRewards({
      rewardMode: "zk-batch",
      classId: CLASS_ID,
      classData: null,
      isPracticeMode: false,
      isTrainingMode: false,
      address: RIDER,
      elapsedTime: 5,
      telemetryAverages: { avgHr: 160, avgPower: 200 },
      getHeartRateSamples: () => RAW_SAMPLES,
      ...overrides,
    }),
  );
}

describe("useRideRewards claim flow", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_LEGACY_REWARD_CLAIMS", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    localStorage.clear();
    zk.claimWithZK.mockClear();
    zk.reset.mockClear();
    zk.isGeneratingProof = false;
    zk.isPending = false;
    zk.isSuccess = false;
    zk.hash = undefined;
    zk.error = null;
    cloudSave.mockClear();
  });

  it("claims with raw coordinator samples + completed ride duration", async () => {
    const rideId = seedCompletedRide(1800);
    const getter = vi.fn(() => RAW_SAMPLES);
    const { result } = renderRewards({ getHeartRateSamples: getter, elapsedTime: 5 });

    act(() => result.current.setCompletedRideId(rideId));
    await act(async () => {
      await result.current.handleClaimRewards();
    });

    expect(zk.claimWithZK).toHaveBeenCalledTimes(1);
    const [, sessionData] = zk.claimWithZK.mock.calls[0];
    // The getter itself is invoked — samples aren't snapshotted mid-ride.
    expect(getter).toHaveBeenCalled();
    expect(sessionData.heartRateSamples).toBe(RAW_SAMPLES);
    // Saved 30-minute ride wins over the reset 5s clock.
    expect(sessionData.durationSeconds).toBe(1800);
  });

  it("falls back to elapsed time when there is no completed ride yet", async () => {
    const { result } = renderRewards({ elapsedTime: 42 });
    await act(async () => {
      await result.current.handleClaimRewards();
    });
    const [, sessionData] = zk.claimWithZK.mock.calls[0];
    expect(sessionData.durationSeconds).toBe(42);
  });

  it("keeps phase 'claiming' while the tx is pending, marks claimed only on receipt", async () => {
    const rideId = seedCompletedRide(1800);
    const { result, rerender } = renderRewards();

    act(() => result.current.setCompletedRideId(rideId));
    expect(result.current.rewardClaimStatus?.phase).toBe("idle");

    zk.isGeneratingProof = true;
    rerender();
    expect(result.current.rewardClaimStatus?.phase).toBe("claiming");

    zk.isGeneratingProof = false;
    zk.isPending = true;
    rerender();
    expect(result.current.rewardClaimStatus?.phase).toBe("claiming");
    // Not marked claimed while the receipt is still pending.
    expect(getRideHistory().find((r) => r.id === rideId)?.settlement?.status)
      .not.toBe("confirmed");

    zk.isPending = false;
    zk.isSuccess = true;
    zk.hash = "0x" + "cd".repeat(32) as `0x${string}`;
    rerender();
    expect(result.current.rewardClaimStatus?.phase).toBe("claimed");

    // Receipt success → history updated + owned ride mirrored to cloud.
    await waitFor(() => expect(cloudSave).toHaveBeenCalledTimes(1));
    const saved = getRideHistory().find((r) => r.id === rideId);
    expect(saved?.proof.status).toBe("claimed");
    expect(saved?.settlement?.status).toBe("confirmed");
    // The claim tx hash is persisted — a reload still has claim evidence.
    expect(saved?.settlement?.txHash).toBe("0x" + "cd".repeat(32));
  });

  it("resets claim state on a new ride and before each explicit claim", async () => {
    const rideId = seedCompletedRide(1800);
    const { result } = renderRewards();

    act(() => result.current.setCompletedRideId(rideId));
    expect(zk.reset).toHaveBeenCalledTimes(1);

    // A confirmed claim marks the ride claimed...
    zk.isSuccess = true;
    // ...then a new ride (completedRideId change) clears the stale success.
    act(() => result.current.setCompletedRideId(null));
    expect(zk.reset).toHaveBeenCalledTimes(2);

    // Every explicit claim resets stale error/receipt state first.
    await act(async () => {
      await result.current.handleClaimRewards();
    });
    expect(zk.reset).toHaveBeenCalledTimes(3);
    expect(zk.claimWithZK).toHaveBeenCalledTimes(1);
  });

  it("a new ride of the same class does not inherit the prior claimed state", async () => {
    const rideId = seedCompletedRide(1800);
    const { result, rerender } = renderRewards();

    act(() => result.current.setCompletedRideId(rideId));
    zk.isSuccess = true;
    zk.hash = "0x" + "ef".repeat(32) as `0x${string}`;
    rerender();
    await waitFor(() =>
      expect(getRideHistory().find((r) => r.id === rideId)?.proof.status).toBe("claimed"),
    );

    // Ride again: completed ride cleared + fresh zk state.
    zk.isSuccess = false;
    zk.hash = undefined;
    act(() => result.current.setCompletedRideId(null));
    rerender();
    expect(result.current.rewardClaimStatus?.phase).not.toBe("claimed");
    // The prior ride's record stays claimed.
    expect(getRideHistory().find((r) => r.id === rideId)?.proof.status).toBe("claimed");
  });

  it("refuses a duplicate claim on an already-claimed ride and never downgrades it", async () => {
    const rideId = seedCompletedRide(1800);
    const { result, rerender } = renderRewards();

    act(() => result.current.setCompletedRideId(rideId));
    zk.isSuccess = true;
    zk.hash = "0x" + "ef".repeat(32) as `0x${string}`;
    rerender();
    await waitFor(() =>
      expect(getRideHistory().find((r) => r.id === rideId)?.proof.status).toBe("claimed"),
    );

    // Selecting the already-claimed ride again (idle transient) must not
    // rewrite it as idle/failed...
    zk.isSuccess = false;
    zk.hash = undefined;
    act(() => result.current.setCompletedRideId(rideId));
    rerender();
    expect(getRideHistory().find((r) => r.id === rideId)?.proof.status).toBe("claimed");

    // ...and an explicit re-claim is refused before reaching the chain.
    await act(async () => {
      await result.current.handleClaimRewards();
    });
    expect(zk.claimWithZK).not.toHaveBeenCalled();
    expect(getRideHistory().find((r) => r.id === rideId)?.proof.status).toBe("claimed");
  });

  it("wallet B cannot claim or mutate wallet A's completed ride", async () => {
    const rideId = seedCompletedRide(1800);
    const walletB = "0x2222222222222222222222222222222222222222";
    const { result, rerender } = renderRewards({ address: walletB });

    act(() => result.current.setCompletedRideId(rideId));
    rerender();
    // The idle effect must not write to A's summary.
    expect(getRideHistory().find((r) => r.id === rideId)?.proof.status).toBe("idle");

    await act(async () => {
      await result.current.handleClaimRewards();
    });
    expect(zk.claimWithZK).not.toHaveBeenCalled();
    expect(getRideHistory().find((r) => r.id === rideId)?.proof.status).toBe("idle");
  });

describe("default policy — no reward state mutation", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_LEGACY_REWARD_CLAIMS", "");
    localStorage.clear();
    zk.claimWithZK.mockClear();
    zk.reset.mockClear();
    zk.isSuccess = false;
    zk.hash = undefined;
    zk.error = null;
    cloudSave.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("a stale zk success cannot mark a V1 receipt ride verified or claimed", async () => {
    const summary = createCanonicalRideSummary({
      id: "ride-receipt-1",
      riderId: RIDER.toLowerCase(),
      classId: CLASS_ID,
      className: "Test Class",
      instructor: "",
      completedAt: Date.now(),
      durationSec: 1800,
      avgHeartRate: 160,
      avgPower: 200,
      avgEffort: 500,
      spinEarned: 0,
      telemetrySource: "live-bike",
      effortTier: "silver",
      zones: { recovery: 0, endurance: 0, threshold: 100, sprint: 0 },
      proof: {
        mode: "none",
        status: "idle",
        isVerified: false,
        privacyScore: 0,
        privacyLevel: "high",
      },
      settlement: { attempted: false, status: "skipped" },
    });
    summary.receipt = createRideReceipt(summary, "ride-receipt-1");
    saveRideSummary(summary);

    const { result, rerender } = renderRewards();
    expect(result.current.rewardClaimStatus).toBeUndefined();

    act(() => result.current.setCompletedRideId("ride-receipt-1"));
    zk.isSuccess = true;
    zk.hash = "0x" + "ab".repeat(32) as `0x${string}`;
    rerender();

    await new Promise((r) => setTimeout(r, 0));
    const saved = getRideHistory().find((r) => r.id === "ride-receipt-1");
    expect(saved?.proof.mode).toBe("none");
    expect(saved?.proof.status).toBe("idle");
    expect(saved?.proof.isVerified).toBe(false);
    expect(saved?.settlement?.status).toBe("skipped");
    expect(saved?.receipt?.verification.status).toBe("unverified");
    expect(cloudSave).not.toHaveBeenCalled();
  });

  it("handleClaimRewards is a no-op under the default policy", async () => {
    const { result } = renderRewards();
    await act(async () => {
      await result.current.handleClaimRewards();
    });
    expect(zk.claimWithZK).not.toHaveBeenCalled();
  });
});
});
