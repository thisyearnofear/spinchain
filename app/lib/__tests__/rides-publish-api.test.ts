// Public ride-publishing API gates.

import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

vi.mock("@/app/lib/auth/session", () => ({
  verifySession: vi.fn(async (token: string) =>
    token === "valid-token" ? { address: OWNER } : null),
}));

const getServerClient = vi.hoisted(() => vi.fn(() => null));
vi.mock("@/app/lib/supabase/client", () => ({ getServerClient }));

import { POST as syncPost } from "@/app/api/rides/sync/route";
import { POST as walrusPost, GET as walrusGet } from "@/app/api/rides/walrus/route";
import {
  GET as liveGet,
  POST as livePost,
} from "@/app/api/live-telemetry/route";

function req(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new Request(url, init));
}

describe("POST /api/rides/sync", () => {
  it("rejects 501 before parsing the body", async () => {
    const res = await syncPost(req("http://localhost/api/rides/sync", {
      method: "POST",
      body: "not-json{",
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.code).toBe("NOT_IMPLEMENTED");
    expect(body.message).toMatch(/disabled/i);
  });
});

describe("/api/rides/walrus", () => {
  it("POST is 501 — publishing disabled before registering", async () => {
    const res = await walrusPost(req("http://localhost/api/rides/walrus", {
      method: "POST",
      body: JSON.stringify({ rideId: "r1" }),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(501);
  });

  it("GET requires an authenticated session", async () => {
    const res = await walrusGet(req("http://localhost/api/rides/walrus"));
    expect(res.status).toBe(401);
    const res2 = await walrusGet(req("http://localhost/api/rides/walrus?rideId=r1", {
      headers: { authorization: "Bearer bogus-token" },
    }));
    expect(res2.status).toBe(401);
  });

  it("GET riderId that does not match the session is 403", async () => {
    const res = await walrusGet(req(
      "http://localhost/api/rides/walrus?riderId=0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      { headers: { authorization: "Bearer valid-token" } },
    ));
    expect(res.status).toBe(403);
  });

  it("GET rideId the caller does not own is 404 — no cross-owner metadata", async () => {
    const res = await walrusGet(req(
      "http://localhost/api/rides/walrus?rideId=someone-elses-ride",
      { headers: { authorization: "Bearer valid-token" } },
    ));
    expect(res.status).toBe(404);
  });

  it("GET returns only the caller's own records", async () => {
    const res = await walrusGet(req(
      `http://localhost/api/rides/walrus?riderId=${OWNER}`,
      { headers: { authorization: "Bearer valid-token" } },
    ));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toEqual([]);
  });
});

describe("/api/live-telemetry — open class view disabled until instructor consent exists", () => {
  it("GET is 501 before touching the database", async () => {
    const res = await liveGet(req(
      "http://localhost/api/live-telemetry?classId=c1",
      { headers: { authorization: "Bearer valid-token" } },
    ));
    expect(res.status).toBe(501);
    expect(getServerClient).not.toHaveBeenCalled();
  });

  it("POST is 501 before parsing or writing", async () => {
    const res = await livePost(req("http://localhost/api/live-telemetry", {
      method: "POST",
      body: JSON.stringify({ classId: "c1", heartRate: 150 }),
      headers: {
        "content-type": "application/json",
        authorization: "Bearer valid-token",
      },
    }));
    expect(res.status).toBe(501);
    expect(getServerClient).not.toHaveBeenCalled();
  });
});
