import { describe, it, expect } from "vitest";
import { getWorld, getWorlds, getWorldMode, getWorldModes } from "../worlds";
import { resolveWorld } from "../worlds/resolved";
import { THEME_NAME_TO_MODE } from "../worlds/tron-world";
import { VISUALIZER_THEMES } from "@/app/components/features/route/visualizer-theme";

describe("world registry", () => {
  it("registers the Tron world", () => {
    const worlds = getWorlds();
    expect(worlds.map((w) => w.id)).toContain("tron");
  });

  it("falls back to Tron for an unknown world rather than throwing", () => {
    expect(getWorld("does-not-exist").id).toBe("tron");
  });

  it("falls back to the world's first mode for an unknown mode", () => {
    const world = getWorld("tron");
    expect(getWorldMode("tron", "nope").id).toBe(world.modes[0].id);
  });

  it("exposes every mode of every world", () => {
    const all = getWorldModes();
    expect(all.length).toBe(getWorld("tron").modes.length);
    expect(all.every((p) => p.world.id === "tron")).toBe(true);
  });
});

describe("tron world modes", () => {
  it("models every legacy theme as a mode, one for one", () => {
    const legacy = Object.keys(VISUALIZER_THEMES).sort();
    const modes = getWorld("tron").modes.map((m) => m.themeName).sort();
    expect(modes).toEqual(legacy);
  });

  it("maps each legacy theme name back to its world and mode", () => {
    for (const themeName of Object.keys(VISUALIZER_THEMES)) {
      expect(THEME_NAME_TO_MODE[themeName]?.worldId).toBe("tron");
      expect(THEME_NAME_TO_MODE[themeName]?.modeId).toBeTruthy();
    }
  });

  it("keeps the legacy world labels on the modes", () => {
    for (const mode of getWorld("tron").modes) {
      const theme = VISUALIZER_THEMES[mode.themeName as keyof typeof VISUALIZER_THEMES];
      expect(mode.label).toBe(theme.worldLabel);
    }
  });
});

describe("resolveWorld", () => {
  it("resolves a known pair to the legacy palette", () => {
    const resolved = resolveWorld("tron", "alpine");
    expect(resolved.theme.worldLabel).toBe("Summit Pass");
    expect(resolved.theme).toBe(VISUALIZER_THEMES.alpine);
  });

  it("never throws on an unknown world or mode", () => {
    const resolved = resolveWorld("nope", "nope");
    expect(resolved.world.id).toBe("tron");
    expect(resolved.theme).toBeTruthy();
  });

  it("derives the sky kit from the palette when the world does not own one", () => {
    expect(resolveWorld("tron", "alpine").atmosphereKit).toBe("mist");
    expect(resolveWorld("tron", "neon").atmosphereKit).toBe("grid");
  });

  it("borrows one prop set from the palette when the world owns none", () => {
    const resolved = resolveWorld("tron", "alpine");
    expect(resolved.props).toHaveLength(1);
    expect(resolved.props[0].type).toBe("tree");
    expect(resolved.props[0].role).toBe("scenery");
  });

  it("falls back to a flat skirt ground", () => {
    expect(resolveWorld("tron", "mars").ground.kind).toBe("skirt");
  });

  it("keeps mode post settings attached to the resolved mode", () => {
    expect(resolveWorld("tron", "rainbow").post.radialBlur).toBeGreaterThan(1);
  });
});
