import { describe, it, expect } from "vitest";
import {
  getWorld,
  getWorlds,
  getWorldMode,
  getWorldModes,
  getDefaultModeForTheme,
  getDefaultThemeName,
  getDefaultWorld,
  resolveModeForTheme,
  DEFAULT_WORLD_ID,
  DEFAULT_WORLD_MODE_ID,
} from "../worlds";
import { resolveWorld } from "../worlds/resolved";
import { THEME_NAME_TO_MODE } from "../worlds/tron-world";
import { VISUALIZER_THEMES } from "@/app/components/features/route/visualizer-theme";

describe("world registry", () => {
  it("registers the Tron world", () => {
    const worlds = getWorlds();
    expect(worlds.map((w) => w.id)).toContain("tron");
  });

  it("registers the Cloud world — the first world that is not Tron", () => {
    const worlds = getWorlds();
    expect(worlds.map((w) => w.id)).toContain("cloud");
    expect(getWorld("cloud").complete).toBe(true);
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
    const expected = getWorlds().reduce((n, w) => n + w.modes.length, 0);
    expect(all.length).toBe(expected);
  });
});

describe("the default world", () => {
  it("is the Cloud Kingdom", () => {
    // A ride with no world lands here: the practice ride, a demo link, a
    // route with an unknown theme name.
    expect(DEFAULT_WORLD_ID).toBe("cloud");
    expect(getDefaultWorld().id).toBe("cloud");
    expect(getDefaultThemeName()).toBe("cloud");
  });

  it("presents in Sugar Rush — the exciting mood, not the gentle one", () => {
    expect(DEFAULT_WORLD_MODE_ID).toBe("sugar");
    expect(getDefaultWorld().defaultModeId).toBe("sugar");
    expect(resolveModeForTheme(getDefaultThemeName())!.id).toBe("sugar");
  });

  it("is unlocked for every rider (no rank gate on the default world)", () => {
    // The world's completeness is not its unlock state; the ladder decides
    // that, and the default world is not on the ladder.
    expect(getDefaultWorld().complete).toBe(true);
  });
});

describe("theme → mode mapping", () => {
  it("gives every built-in theme exactly one world and mode", () => {
    for (const themeName of Object.keys(VISUALIZER_THEMES)) {
      const found = getDefaultModeForTheme(themeName);
      expect(found, `no mode claims ${themeName}`).not.toBeNull();
      expect(found!.mode.themeName).toBe(themeName);
    }
  });

  it("routes the five legacy looks to Tron", () => {
    for (const themeName of ["neon", "alpine", "mars", "anime", "rainbow"]) {
      expect(getDefaultModeForTheme(themeName)!.world.id).toBe("tron");
    }
  });

  it("routes the cloud theme to the Cloud world", () => {
    const found = getDefaultModeForTheme("cloud")!;
    expect(found.world.id).toBe("cloud");
    // The Cloud world declares Sugar Rush as its default mood — a first ride
    // should land on the exciting one.
    expect(found.mode.id).toBe("sugar");
  });

  it("resolves an explicit mode of the Cloud world", () => {
    expect(resolveModeForTheme("cloud", "sugar")!.id).toBe("sugar");
  });

  it("falls back to the default mode for an unknown mode id", () => {
    expect(resolveModeForTheme("cloud", "nope")!.id).toBe("sugar");
  });

  it("keeps the Tron modes free of post weights, so no existing world changes", () => {
    for (const mode of getWorld("tron").modes) {
      expect(mode.post).toBeUndefined();
      expect(mode.reactivity).toBeUndefined();
    }
  });
});

describe("tron world modes", () => {
  it("models the five legacy looks one for one", () => {
    const legacy = Object.keys(VISUALIZER_THEMES).filter((t) => t !== "cloud").sort();
    const modes = getWorld("tron").modes.map((m) => m.themeName).sort();
    expect(modes).toEqual(legacy);
  });

  it("maps each legacy theme name back to its world and mode", () => {
    for (const themeName of Object.keys(VISUALIZER_THEMES)) {
      if (themeName === "cloud") continue;
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

describe("cloud world", () => {
  it("mirrors the cloud theme's props, so the world and the theme cannot drift", () => {
    const theme = VISUALIZER_THEMES.cloud;
    const world = getWorld("cloud");
    expect(world.props![0].type).toBe(theme.props.type);
    expect(world.props![0].count).toBe(theme.props.count);
    expect(world.props![0].color).toBe(theme.props.color);
    expect(world.atmosphereKit).toBe(theme.atmosphere);
  });

  it("gives the cloud theme its own ground", () => {
    expect(getWorld("cloud").ground!.kind).toBe("cloud");
  });

  it("has two modes that share one palette but differ in post", () => {
    const modes = getWorld("cloud").modes;
    expect(modes.map((m) => m.id)).toEqual(["cotton", "sugar"]);
    expect(modes.every((m) => m.themeName === "cloud")).toBe(true);
    expect(modes[0].post!.bloom).not.toBe(modes[1].post!.bloom);
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
    // Sugar Rush is the hotter mood: more bloom than Cotton Candy.
    expect(resolveWorld("cloud", "sugar").post.bloom!).toBeGreaterThan(
      resolveWorld("cloud", "cotton").post.bloom!,
    );
  });
});
