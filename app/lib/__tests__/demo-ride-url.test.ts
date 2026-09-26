import { describe, expect, it } from "vitest";
import { getDemoRideUrl } from "@/app/hooks/evm/use-class-data";

describe("getDemoRideUrl theme param", () => {
  it("appends a valid visualizer theme", () => {
    const url = getDemoRideUrl({ theme: "alpine", name: "Summit Pass" });
    const params = new URLSearchParams(url.split("?")[1]);
    expect(url.startsWith("/rider/ride/demo?")).toBe(true);
    expect(params.get("theme")).toBe("alpine");
    expect(params.get("name")).toBe("Summit Pass");
    expect(params.get("mode")).toBe("practice");
  });

  it("accepts every VisualizerTheme key", () => {
    for (const key of ["neon", "alpine", "mars", "anime", "rainbow"] as const) {
      const url = getDemoRideUrl({ theme: key });
      expect(new URLSearchParams(url.split("?")[1]).get("theme")).toBe(key);
    }
  });

  it("ignores an invalid theme key and falls back to the bare demo URL", () => {
    // @ts-expect-error — deliberately invalid theme key
    expect(getDemoRideUrl({ theme: "cyberpunk" })).toBe("/rider/ride/demo");
  });

  it("omits the theme param when the key is invalid but other options are set", () => {
    // @ts-expect-error — deliberately invalid theme key
    const url = getDemoRideUrl({ theme: "nope", name: "Demo Ride" });
    expect(url).not.toContain("theme=");
    expect(new URLSearchParams(url.split("?")[1]).get("name")).toBe("Demo Ride");
  });

  it("omits the theme param when absent", () => {
    const url = getDemoRideUrl({ name: "Demo Ride" });
    expect(url).not.toContain("theme=");
  });

  it("returns the bare demo URL with no options", () => {
    expect(getDemoRideUrl()).toBe("/rider/ride/demo");
  });
});
