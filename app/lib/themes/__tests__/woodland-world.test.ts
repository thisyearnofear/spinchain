import { describe, expect, it } from "vitest";
import { VISUALIZER_THEMES } from "@/app/components/features/route/visualizer-theme";
import {
  DEFAULT_WORLD_ID,
  getDefaultModeForTheme,
  getDefaultWorld,
  getWorld,
  getWorlds,
} from "@/app/lib/themes/worlds";
import { WORLD_IMAGES } from "@/app/lib/themes/theme-images";
import { WOODLAND_WORLD } from "@/app/lib/themes/worlds/woodland-world";

describe("woodland world", () => {
  it("is registered and reachable by its theme", () => {
    expect(getWorlds().map((w) => w.id)).toContain("woodland");
    expect(getWorld("woodland").id).toBe("woodland");
    // A world is only real if a theme resolves into it — otherwise it is a
    // definition nothing can ever mount.
    const resolved = getDefaultModeForTheme("woodland");
    expect(resolved?.world.id).toBe("woodland");
    expect(resolved?.mode.id).toBe("greenwood");
  });

  it("does not steal another world's theme", () => {
    // Registering tenth must not change where the other themes land.
    expect(getDefaultModeForTheme("neon")?.world.id).toBe("tron");
    expect(getDefaultModeForTheme("cloud")?.world.id).toBe("cloud");
    expect(getDefaultWorld().id).toBe(DEFAULT_WORLD_ID);
  });

  it("declares every place-level slot, so it is honest to call it complete", () => {
    expect(WOODLAND_WORLD.complete).toBe(true);
    expect(WOODLAND_WORLD.atmosphereKit).toBeDefined();
    expect(WOODLAND_WORLD.ground).toBeDefined();
    expect(WOODLAND_WORLD.props?.length).toBeGreaterThan(0);
    expect(WOODLAND_WORLD.ambient?.particles?.kind).toBeDefined();
  });

  it("has a palette and picker art, so it cannot render blank or show a broken card", () => {
    expect(Object.keys(VISUALIZER_THEMES)).toContain("woodland");
    const image = WORLD_IMAGES.woodland;
    expect(image.src).toBe("/images/worlds/woodland.webp");
    expect(image.label).toBe(VISUALIZER_THEMES.woodland.worldLabel);
  });

  it("is the only world that puts leaves in the air", () => {
    const leafWorlds = getWorlds().filter((w) => w.ambient?.particles?.kind === "leaf");
    expect(leafWorlds.map((w) => w.id)).toEqual(["woodland"]);
  });
});
