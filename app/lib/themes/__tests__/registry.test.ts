import { describe, it, expect } from "vitest";
import { parseThemeDefinition } from "../registry";
import { VISUALIZER_THEMES } from "@/app/components/features/route/visualizer-theme";

const VALID_ROW = {
  fog: "#07090f",
  roadColor: "#1f2937",
  roadEmissive: "#6d7cff",
  roadEmissiveIntensity: 0.2,
  lineColor: "#6ef3c6",
  riderColor: "#ffffff",
  grid: true,
  stars: true,
  envPreset: "city",
  particleColor: "#4fd1c5",
  skyTop: "#050816",
  skyBottom: "#131b33",
  horizonGlow: "#6d7cff",
  terrainColor: "#0f172a",
  terrainAccent: "#1d4ed8",
  panelColor: "rgba(10, 14, 28, 0.74)",
  worldLabel: "Neon City",
  atmosphere: "grid",
  terrainBackScale: 0.35,
  terrainFrontScale: 0.62,
  patternOpacity: 0.24,
  routeDashOpacity: 0.8,
  props: {
    type: "building",
    color: "#6d7cff",
    count: 40,
    scale: [2, 8, 2],
  },
};

describe("parseThemeDefinition", () => {
  it("accepts a valid row", () => {
    expect(parseThemeDefinition(VALID_ROW)).not.toBeNull();
  });

  it("rejects an unknown envPreset (drei would throw at render)", () => {
    expect(parseThemeDefinition({ ...VALID_ROW, envPreset: "volcano" })).toBeNull();
  });

  it("accepts every built-in theme's envPreset", () => {
    for (const theme of Object.values(VISUALIZER_THEMES)) {
      expect(parseThemeDefinition({ ...VALID_ROW, envPreset: theme.envPreset })).not.toBeNull();
    }
  });

  it("rejects a non-hex color", () => {
    expect(parseThemeDefinition({ ...VALID_ROW, fog: "red" })).toBeNull();
  });
});
