// Phase-3 verification-provider interface: registry + cloud-observed provider.

import { describe, it, expect } from "vitest";
import "@/app/lib/verification/providers/cloud-observed";
import {
  getVerificationProvider,
  DEFAULT_PROVIDER_ID,
} from "@/app/lib/verification/provider";
import {
  deriveRideSessionId,
  deriveRideClassId,
} from "@/app/lib/rewards/pilot-redeemer";

const RIDER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function dbReturning(row: unknown, error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row, error }),
          }),
        }),
      }),
    }),
  } as never;
}

const provider = getVerificationProvider(DEFAULT_PROVIDER_ID)!;

describe("verification provider registry", () => {
  it("registers the default cloud-observed provider", () => {
    expect(provider).toBeDefined();
    expect(provider.id).toBe("spinchain.cloud-observed.v1");
    expect(getVerificationProvider("nope")).toBeUndefined();
  });
});

describe("cloud-observed provider", () => {
  it("verifies a synced ride with honest provenance", async () => {
    const d = await provider.verify(
      { riderAddress: RIDER, rideId: "r1" },
      {
        db: dbReturning({
          id: "r1",
          rider_address: RIDER,
          class_id: "c9",
          elapsed_time: 900,
          summary: { telemetrySource: "live-bike" },
        }),
      },
    );
    expect(d.status).toBe("verified");
    if (d.status !== "verified") return;
    expect(d.session.sessionId).toBe(deriveRideSessionId("r1"));
    expect(d.session.classId).toBe(deriveRideClassId("c9"));
    expect(d.session.provenance).toBe("device-observed");
    expect(d.session.elapsedTimeSec).toBe(900);
  });

  it("maps simulator telemetry to simulated provenance", async () => {
    const d = await provider.verify(
      { riderAddress: RIDER, rideId: "r2" },
      {
        db: dbReturning({
          id: "r2",
          rider_address: RIDER,
          class_id: null,
          elapsed_time: 600,
          summary: { telemetrySource: "simulator" },
        }),
      },
    );
    expect(d.status).toBe("verified");
    if (d.status !== "verified") return;
    expect(d.session.provenance).toBe("simulated");
  });

  it("falls back to estimated when the source is unknown", async () => {
    const d = await provider.verify(
      { riderAddress: RIDER, rideId: "r3" },
      {
        db: dbReturning({
          id: "r3",
          rider_address: RIDER,
          class_id: null,
          elapsed_time: 600,
          summary: null,
        }),
      },
    );
    expect(d.status).toBe("verified");
    if (d.status !== "verified") return;
    expect(d.session.provenance).toBe("estimated");
  });

  it("rejects rides not in cloud history", async () => {
    const d = await provider.verify(
      { riderAddress: RIDER, rideId: "ghost" },
      { db: dbReturning(null) },
    );
    expect(d.status).toBe("rejected");
    if (d.status !== "rejected") return;
    expect(d.reason).toContain("cloud history");
  });

  it("returns unavailable on DB errors", async () => {
    const d = await provider.verify(
      { riderAddress: RIDER, rideId: "r" },
      { db: dbReturning(null, { message: "conn reset" }) },
    );
    expect(d.status).toBe("unavailable");
  });

  it("carries a verbatim trust statement", () => {
    expect(provider.trustStatement).toMatch(/not independently verified/);
  });
});
