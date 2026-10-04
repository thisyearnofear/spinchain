// @vitest-environment jsdom
// Public-write guards — real default publication policy (hard deny).

import { describe, it, expect, vi, afterEach } from "vitest";

const storeJSON = vi.hoisted(() => vi.fn(async () => ({ success: true, blobId: "blob-1", urls: { primary: "u" } })));
const store = vi.hoisted(() => vi.fn(async () => ({ success: true, blobId: "blob-1", urls: { primary: "u" } })));

vi.mock("@/app/lib/walrus/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/walrus/client")>();
  return {
    ...actual,
    getWalrusClient: () => ({ storeJSON, store }),
  };
});

const activeNetworkId = vi.hoisted(() => ({ value: 43113 }));
vi.mock("@/app/lib/contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/contracts")>();
  return {
    ...actual,
    ACTIVE_NETWORK: { ...actual.ACTIVE_NETWORK, get id() { return activeNetworkId.value; } },
  };
});

import { AssetManager } from "@/app/lib/walrus/client";
import { persistRideSummaryToWalrus } from "@/app/lib/walrus/ride-persistence";
import { persistProfileToWalrus } from "@/app/lib/walrus/profile-persistence";
import { createCanonicalRideSummary } from "@/app/lib/analytics/ride-history";
import { isLegacyRewardClaimsEnabled } from "@/app/lib/rewards/legacy-policy";

const summary = createCanonicalRideSummary({
  id: "r1",
  riderId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  classId: "c1",
  className: "Ride",
  instructor: "Coach",
  completedAt: 1700000000000,
  durationSec: 600,
  avgHeartRate: 140,
  avgPower: 180,
  avgEffort: 500,
  spinEarned: 0,
  telemetrySource: "simulator",
  effortTier: "silver",
  zones: { recovery: 0, endurance: 1, threshold: 0, sprint: 0 },
  proof: {
    mode: "none",
    status: "idle",
    isVerified: false,
    privacyScore: 0,
    privacyLevel: "high",
  },
});

afterEach(() => {
  vi.unstubAllEnvs();
  storeJSON.mockClear();
  store.mockClear();
  vi.unstubAllGlobals();
});

describe("publication deny — real policy, no env bypass", () => {
  it("AssetManager.storeTelemetry returns null without touching storeJSON", async () => {
    const client = { storeJSON: storeJSON } as never;
    const mgr = new AssetManager(client);
    const result = await mgr.storeTelemetry(
      { heartRate: [1], power: [2], cadence: [3], timestamps: [4] },
      { sessionId: "s1", riderId: "r1", classId: "c1" },
    );
    expect(result).toBeNull();
    expect(storeJSON).not.toHaveBeenCalled();
  });

  it("persistRideSummaryToWalrus returns null — no store, no register fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await persistRideSummaryToWalrus(summary);
    expect(result).toBeNull();
    expect(storeJSON).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("persistProfileToWalrus returns null — no network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await persistProfileToWalrus(
      { goal: "fitness" } as never,
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(result).toBeNull();
    expect(storeJSON).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("legacy flag true does NOT open personal-data publication", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_LEGACY_REWARD_CLAIMS", "true");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await persistRideSummaryToWalrus(summary)).toBeNull();
    expect(storeJSON).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("non-personal public assets — unaffected", () => {
  it("storeWorld still reaches the underlying store", async () => {
    const mgr = new AssetManager({ storeJSON } as never);
    const result = await mgr.storeWorld(
      { scene: "demo" },
      { name: "World", owner: "0x0" },
    );
    expect(storeJSON).toHaveBeenCalledTimes(1);
    expect(result?.assetType).toBe("3d_world");
  });
});

describe("legacy reward flag truth table (ACTIVE_NETWORK.id mocked)", () => {
  it("unset flag is false even on Fuji", () => {
    activeNetworkId.value = 43113;
    expect(isLegacyRewardClaimsEnabled()).toBe(false);
  });

  it("explicit flag + Fuji (43113) is true", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_LEGACY_REWARD_CLAIMS", "true");
    activeNetworkId.value = 43113;
    expect(isLegacyRewardClaimsEnabled()).toBe(true);
  });

  it("explicit flag + mainnet (43114) is false", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_LEGACY_REWARD_CLAIMS", "true");
    activeNetworkId.value = 43114;
    expect(isLegacyRewardClaimsEnabled()).toBe(false);
  });
});
