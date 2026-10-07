// Device-local redemption store — keyed by ride id, survives reload,
// and never throws when storage is absent (SSR/node) or corrupt.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getRedemption,
  saveRedemption,
  type RedemptionRecord,
} from "@/app/lib/rewards/redemption-store";

const RECORD: RedemptionRecord = {
  rideId: "ride-1",
  nullifier: `0x${"ab".repeat(32)}`,
  txHash: `0x${"cd".repeat(32)}`,
  confirmedAt: 1_700_000_000_000,
};

function stubStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  });
  return map;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("redemption store", () => {
  it("is a no-op off-client (no window/localStorage)", () => {
    saveRedemption(RECORD);
    expect(getRedemption("ride-1")).toBeNull();
  });

  it("round-trips a confirmed redemption by ride id", () => {
    stubStorage();
    saveRedemption(RECORD);
    expect(getRedemption("ride-1")).toEqual(RECORD);
    expect(getRedemption("ride-2")).toBeNull();
  });

  it("ignores a corrupt payload instead of throwing", () => {
    stubStorage({ "spinchain:redemptions:v1": "{not json" });
    expect(getRedemption("ride-1")).toBeNull();
  });

  it("drops malformed entries but keeps valid ones", () => {
    stubStorage({
      "spinchain:redemptions:v1": JSON.stringify({
        "ride-1": RECORD,
        junk: { nope: true },
        alsoJunk: "string",
      }),
    });
    expect(getRedemption("ride-1")).toEqual(RECORD);
    expect(getRedemption("junk")).toBeNull();
  });
});
