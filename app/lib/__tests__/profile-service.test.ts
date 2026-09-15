import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearProfileCache,
  getDisplayName,
  isMeaningfulProfile,
  resolveProfile,
  type Profile,
} from "@/app/lib/profile-service";

const VITALIK = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
const EMPTY = "0x0000000000000000000000000000000000000001";

afterEach(() => {
  clearProfileCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      return handler(url);
    }),
  );
}

describe("isMeaningfulProfile", () => {
  it("rejects ethereum wallet stubs", () => {
    expect(
      isMeaningfulProfile({
        address: EMPTY,
        identity: EMPTY,
        platform: "ethereum",
        displayName: "0x0000...0001",
        avatar: null,
        description: null,
      }),
    ).toBe(false);
  });

  it("accepts ENS profiles", () => {
    expect(
      isMeaningfulProfile({
        address: VITALIK,
        identity: "vitalik.eth",
        platform: "ens",
        displayName: "vitalik.eth",
        avatar: "https://euc.li/vitalik.eth",
        description: null,
      }),
    ).toBe(true);
  });
});

describe("getDisplayName", () => {
  it("uses named identity when present", () => {
    const profile: Profile = {
      address: VITALIK,
      identity: "vitalik.eth",
      platform: "ens",
      displayName: "vitalik.eth",
      avatar: null,
      description: null,
    };
    expect(getDisplayName(profile, VITALIK)).toBe("vitalik.eth");
  });

  it("falls back to truncated address for stubs", () => {
    const stub: Profile = {
      address: EMPTY,
      identity: EMPTY,
      platform: "ethereum",
      displayName: "0x0000...0001",
      avatar: null,
      description: null,
    };
    expect(getDisplayName(stub, EMPTY)).toBe("0x0000...0001");
  });
});

describe("resolveProfile", () => {
  it("prefers ENS from Web3.bio and skips ethereum stubs in the list", async () => {
    stubFetch((url) => {
      if (url.includes("api.web3.bio")) {
        return Response.json([
          {
            address: VITALIK,
            identity: "vitalik.eth",
            platform: "ens",
            displayName: "vitalik.eth",
            avatar: "https://euc.li/vitalik.eth",
            description: "hello",
          },
          {
            address: VITALIK,
            identity: "vitalik.eth",
            platform: "farcaster",
            displayName: "Vitalik Buterin",
            avatar: null,
            description: null,
          },
        ]);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const profile = await resolveProfile(VITALIK);
    expect(profile?.identity).toBe("vitalik.eth");
    expect(profile?.platform).toBe("ens");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("falls through to ENSData when Web3.bio only returns an ethereum stub", async () => {
    stubFetch((url) => {
      if (url.includes("api.web3.bio")) {
        return Response.json([
          {
            address: EMPTY,
            identity: EMPTY,
            platform: "ethereum",
            displayName: "0x0000...0001",
            avatar: null,
            description: null,
          },
        ]);
      }
      if (url.includes("api.ensdata.net")) {
        return Response.json({
          address: EMPTY,
          ens: "ghost.eth",
          avatar: "https://example.com/a.png",
          avatar_url: "https://example.com/a.png",
          description: "from ensdata",
          twitter: "ghost",
          github: "ghost-dev",
          url: "https://ghost.eth",
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const profile = await resolveProfile(EMPTY);
    expect(profile).toEqual(
      expect.objectContaining({
        identity: "ghost.eth",
        platform: "ens",
        avatar: "https://example.com/a.png",
        description: "from ensdata",
        links: expect.objectContaining({
          twitter: expect.objectContaining({ handle: "ghost" }),
          github: expect.objectContaining({ handle: "ghost-dev" }),
          website: expect.objectContaining({ link: "https://ghost.eth" }),
        }),
      }),
    );
  });

  it("returns null when neither provider has a named identity", async () => {
    stubFetch((url) => {
      if (url.includes("api.web3.bio")) {
        return Response.json([
          {
            address: EMPTY,
            identity: EMPTY,
            platform: "ethereum",
            displayName: "0x0000...0001",
            avatar: null,
            description: null,
          },
        ]);
      }
      if (url.includes("api.ensdata.net")) {
        return new Response(
          JSON.stringify({ error: true, status: 404, message: "not found" }),
          { status: 404 },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    expect(await resolveProfile(EMPTY)).toBeNull();
  });

  it("maps legacy ENSData records shape", async () => {
    stubFetch((url) => {
      if (url.includes("api.web3.bio")) {
        return Response.json([]);
      }
      if (url.includes("api.ensdata.net")) {
        return Response.json({
          address: VITALIK,
          ens: "vitalik.eth",
          records: {
            avatar: "https://euc.li/vitalik.eth",
            description: "legacy",
            twitter: "VitalikButerin",
          },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const profile = await resolveProfile(VITALIK);
    expect(profile?.avatar).toBe("https://euc.li/vitalik.eth");
    expect(profile?.description).toBe("legacy");
    expect(profile?.links?.twitter?.handle).toBe("VitalikButerin");
  });
});
