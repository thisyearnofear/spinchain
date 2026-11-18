import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AVATARS,
  SELECTABLE_AVATARS,
  resolveAvatar,
} from "@/app/lib/selection-library";

describe("selection-library — experimental avatar gating", () => {
  it("never offers experimental avatars to pickers", () => {
    expect(SELECTABLE_AVATARS.every((a) => !a.experimental)).toBe(true);
  });

  it("keeps experimental avatars resolvable by id for studio harnesses", () => {
    const experimental = AVATARS.filter((a) => a.experimental);
    for (const avatar of experimental) {
      expect(resolveAvatar(avatar.id)?.id).toBe(avatar.id);
    }
  });

  it("keeps SELECTABLE_AVATARS a strict subset of the full registry", () => {
    const selectable = new Set(SELECTABLE_AVATARS.map((a) => a.id));
    const expected = AVATARS.filter((a) => !a.experimental).map((a) => a.id);
    expect([...selectable].sort()).toEqual(expected.sort());
  });

  it("wires user-facing pickers to SELECTABLE_AVATARS, not AVATARS", () => {
    const pickers = [
      "app/components/features/ride/skin-switcher.tsx",
      "app/components/features/common/selection-garage.tsx",
    ];
    for (const picker of pickers) {
      const source = readFileSync(join(process.cwd(), picker), "utf8");
      expect(source, picker).toContain("SELECTABLE_AVATARS");
    }
  });
});
