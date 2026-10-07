// @vitest-environment jsdom
// persistRide — local-first durable save boundary tests.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const suiAccount = vi.hoisted(() => ({ current: null as { address: string } | null }));
const walrusPersist = vi.hoisted(() => vi.fn(async () => "blob-id"));
const cloudSave = vi.hoisted(() => vi.fn(async () => true));
const anchorSui = vi.hoisted(() => vi.fn(async () => ({ digest: "0xabc" })));

vi.mock("@mysten/dapp-kit", () => ({
  useCurrentAccount: () => suiAccount.current,
}));

vi.mock("@/app/lib/walrus/ride-persistence", () => ({
  persistRideSummaryToWalrus: walrusPersist,
}));

vi.mock("@/app/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("@/app/hooks/common/use-supabase-sync", () => ({
  saveRideToSupabase: cloudSave,
  RIDE_HISTORY_UPDATED_EVENT: "spinchain:ride-history-updated",
}));

import { useRidePersistence } from "@/app/hooks/ride/use-ride-persistence";
import {
  getRideHistory,
  STORAGE_KEYS,
} from "@/app/lib/analytics/ride-history";
import type { RideSummary } from "@/app/lib/analytics/ride-history";
import { readOutbox } from "@/app/lib/sync/outbox";
import { CONSENT_POLICY_VERSION, CONSENT_STORAGE_KEY } from "@/app/lib/privacy/consent";

const CLASS_ID = "class-1";
const SESSION_ID = "session-abc";

const rewardsFinalize = vi.fn(async () => ({ success: true, amount: BigInt(0) }));

function params(overrides: Record<string, unknown> = {}) {
  return {
    classId: CLASS_ID,
    sessionId: SESSION_ID,
    classData: null,
    practiceConfig: null,
    agentName: "Coach",
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    elapsedTime: 600,
    averages: { avgHr: 140, avgPower: 180, avgEffort: 500 },
    samples: { heartRate: 140 },
    bleConnected: false,
    isPracticeMode: false,
    useSimulator: true,
    rewardMode: "zk-batch",
    rewardClaimStatus: undefined,
    useChainlinkRewards: false,
    chainlinkSuccess: false,
    zkSuccess: false,
    privacyScore: 0,
    privacyLevel: "low",
    walletConnected: false,
    rewardsIsActive: false,
    rewardsFinalize,
    coordinatorRef: { current: { anchorSuiTelemetry: anchorSui } },
    ...overrides,
  } as any;
}

async function callPersist(p = params()) {
  const { result } = renderHook(() => useRidePersistence());
  return result.current.persistRide(p);
}

describe("persistRide — durable local save first", () => {
  beforeEach(() => {
    localStorage.clear();
    suiAccount.current = { address: "0xsui" };
    walrusPersist.mockClear();
    cloudSave.mockClear();
    anchorSui.mockClear();
    rewardsFinalize.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("saves receipt + zero-reward record synchronously before the cloud promise resolves", async () => {
    let cloudResolved = false;
    cloudSave.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      cloudResolved = true;
      return true;
    });

    const promise = callPersist();
    // The local record exists before persistRide's promise settles.
    const immediate = getRideHistory().find((r) => r.id === SESSION_ID);
    expect(immediate).toBeTruthy();
    expect(immediate?.receipt?.receiptId).toBe(SESSION_ID);
    expect(immediate?.receipt?.verification.status).toBe("unverified");
    expect(immediate?.receipt?.redemption.status).toBe("unavailable");
    expect(immediate?.spinEarned).toBe(0);
    expect(immediate?.proof.mode).toBe("none");
    expect(immediate?.settlement?.status).toBe("skipped");

    const result = await promise;
    expect(result.syncStatus).toBe("local_only");
    expect(result.walrusAnchorInfo).toBeNull();
    // persistRide resolved without awaiting the still-pending cloud save.
    expect(cloudResolved).toBe(false);
  });

  it("never calls reward/walrus/sui/public-sync paths under the default policy", async () => {
    await callPersist();
    expect(rewardsFinalize).not.toHaveBeenCalled();
    expect(walrusPersist).not.toHaveBeenCalled();
    expect(anchorSui).not.toHaveBeenCalled();
    const queue = localStorage.getItem(STORAGE_KEYS.syncQueue);
    expect(queue === null || queue === "[]").toBe(true);
  });

  it("maps simulator and BLE telemetry sources correctly", async () => {
    const sim = await callPersist(params({ useSimulator: true, bleConnected: true }));
    expect(sim.canonicalSummary.telemetrySource).toBe("simulator");
    expect(sim.canonicalSummary.receipt?.provenance).toBe("simulated");

    localStorage.clear();
    const ble = await callPersist(params({ useSimulator: false, bleConnected: true, sessionId: "s2" }));
    expect(ble.canonicalSummary.telemetrySource).toBe("live-bike");
    expect(ble.canonicalSummary.receipt?.provenance).toBe("device-observed");

    localStorage.clear();
    const est = await callPersist(params({ useSimulator: false, bleConnected: false, sessionId: "s3" }));
    expect(est.canonicalSummary.telemetrySource).toBe("estimated");
    expect(est.canonicalSummary.receipt?.provenance).toBe("estimated");
  });

  it("a repeat finish of the same session returns the stored record unchanged", async () => {
    const first = await callPersist();
    // Second finish with a different wallet? Same rider keeps idempotency.
    const second = await callPersist(params({ elapsedTime: 999, averages: { avgHr: 1, avgPower: 1, avgEffort: 1 } }));
    const history = getRideHistory();
    expect(history.filter((r) => r.id === SESSION_ID)).toHaveLength(1);
    expect(second.canonicalSummary.durationSec).toBe(first.canonicalSummary.durationSec);
    expect(second.canonicalSummary.avgEffort).toBe(first.canonicalSummary.avgEffort);
    expect(second.canonicalSummary.receipt).toEqual(first.canonicalSummary.receipt);
    expect(second.canonicalSummary.idempotencyKey).toBe(first.canonicalSummary.idempotencyKey);
    expect(rewardsFinalize).not.toHaveBeenCalled();
    expect(walrusPersist).not.toHaveBeenCalled();
  });

  it("rejects an identity conflict instead of reassigning the record", async () => {
    await callPersist();
    await expect(
      callPersist(params({ address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" })),
    ).rejects.toThrow(/identity conflict/i);
    await expect(
      callPersist(params({ classId: "other-class" })),
    ).rejects.toThrow(/identity conflict/i);
    const record = getRideHistory().find((r) => r.id === SESSION_ID);
    expect(record?.riderId).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(record?.classId).toBe(CLASS_ID);
  });

  it("a storage failure propagates — no saved record, no cloud attempt", async () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.rideHistory) {
          throw new DOMException("quota", "QuotaExceededError");
        }
        return undefined;
      });
    try {
      await expect(callPersist()).rejects.toThrow();
      expect(getRideHistory().find((r) => r.id === SESSION_ID)).toBeUndefined();
      expect(cloudSave).not.toHaveBeenCalled();
      expect(walrusPersist).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });

  it("saved record survives reload (new hydration pass keeps the receipt)", async () => {
    await callPersist();
    const hydrated: RideSummary[] = getRideHistory();
    const record = hydrated.find((r) => r.id === SESSION_ID);
    expect(record?.receipt?.sessionId).toBe(SESSION_ID);
    expect(record?.receipt?.receiptId).toBe(SESSION_ID);
    expect(record?.receipt?.telemetryCommitment).toBeNull();
  });

  it("queues a durable cloud job held until consent; never calls the cloud without it", async () => {
    await callPersist();
    const jobs = readOutbox();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ kind: "cloud_history.upsert", rideId: SESSION_ID, status: "held_consent" });
    expect(cloudSave).not.toHaveBeenCalled();
  });

  it("guest rides never enter the cloud outbox", async () => {
    await callPersist(params({ address: "guest-1234" }));
    expect(readOutbox()).toHaveLength(0);
  });

  it("with consent, the job drains to the cloud and is marked done", async () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ cloud_history: { granted: true, policyVersion: CONSENT_POLICY_VERSION, updatedAt: 1 } }),
    );
    await callPersist();
    await waitFor(() => expect(readOutbox()[0]?.status).toBe("done"));
    expect(cloudSave).toHaveBeenCalledTimes(1);
    expect((cloudSave.mock.calls[0] as unknown[])[0]).toMatchObject({ id: SESSION_ID });
  });
});
