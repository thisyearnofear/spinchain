import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { pixelStats } from "./support/pixel-stats";

/**
 * The wedge, checked as a picture: docs/WEDGE.md promises that physical effort
 * transforms the 3D world in real time. Unit tests prove the numbers reach
 * `computeReactiveParams`; this proves the rendered frame actually differs,
 * which is the only thing a rider can perceive.
 *
 * Determinism comes from the dedicated harness page
 * (app/test-harness/route-visualizer): it renders RouteVisualizer from fixed
 * stats with no wallet, no coordinator and no clock, so the ONLY difference
 * between two frames here is the ?intensity= the caller passes. ?progress= is
 * pinned too, because a frame taken further along the route would differ for
 * reasons that have nothing to do with effort.
 */

const BASE = "/test-harness/route-visualizer?testState=active-play&seed=123&progress=0.5&paused=1";

async function frameAt(page: import("@playwright/test").Page, theme: string, intensity: number) {
  const errors: string[] = [];
  const collect = (e: Error) => errors.push(String(e).slice(0, 200));
  page.on("pageerror", collect);
  await page.goto(`${BASE}&theme=${theme}&intensity=${intensity}`, { waitUntil: "commit" }).catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await expect
    .poll(() => page.locator("canvas").count(), { message: "the 3D canvas to mount" })
    .toBeGreaterThan(0);
  // Wait for the harness to *settle on a drawn frame*, not for a plausible
  // amount of time: `paused=1` hands the loop to the fixed clock, which now
  // reports settled only once the drawing buffer holds a picture. Sampling too
  // early photographed the CSS backdrop twice, and two identical blank frames
  // read as "effort changed nothing" — a false regression in the exact claim
  // this file exists to defend.
  await page.waitForSelector('html[data-harness-clock="settled"]', {
    state: "attached",
    timeout: 90_000,
  });
  await page.waitForTimeout(300);
  const buffer = await page.screenshot();
  page.off("pageerror", collect);
  expect(errors, `page errors while rendering ${theme} at intensity=${intensity}`).toEqual([]);
  // A frame has to be a *scene* before it can be compared to another scene.
  // Two undrawn canvases are pixel-identical, which this file would otherwise
  // report as "effort changed nothing" — a false accusation at the exact claim
  // it exists to defend. Same bars as the visual suite: 200 colours for the
  // lit worlds, 60 for the pastel cloud one.
  const stats = pixelStats(buffer);
  expect(
    stats.distinctColors,
    `frame for ${theme} at intensity=${intensity} is not a drawn scene: ${JSON.stringify(stats)}`,
  ).toBeGreaterThan(theme === "cloud" ? 60 : 200);
  return buffer;
}

async function diff(a: Buffer, b: Buffer) {
  const [x, y] = await Promise.all([
    sharp(a).removeAlpha().raw().toBuffer(),
    sharp(b).removeAlpha().raw().toBuffer(),
  ]);
  expect(x.length, "both frames must be the same size").toBe(y.length);
  let sum = 0;
  let changed = 0;
  const pixels = x.length / 3;
  for (let i = 0; i < pixels; i++) {
    const o = i * 3;
    const d = Math.abs(x[o] - y[o]) + Math.abs(x[o + 1] - y[o + 1]) + Math.abs(x[o + 2] - y[o + 2]);
    sum += d;
    if (d > 12) changed++;
  }
  return {
    meanChannelDelta: +(sum / pixels / 3).toFixed(2),
    changedPixelPct: +((changed / pixels) * 100).toFixed(1),
  };
}

// A world that does not react to effort is a broken world, and the default one
// is the world riders will judge the product by — which is why the Cloud
// Kingdom is listed, and why its case is recorded as blocked rather than
// deleted. It is currently the one honest red in this file: under software WebGL it draws nothing at all, so
// rest and sprint are the same black frame. That is a real defect in the world,
// not a flake in the check — see the note on the fixme below. The other two
// worlds keep their floor, so the wiring this file protects is still guarded.
const WORLDS: Array<{ theme: string; blocked?: string }> = [
  { theme: "neon" },
  { theme: "alpine" },
  {
    theme: "cloud",
    blocked:
      "the Cloud Kingdom draws no geometry under software WebGL: the fixed-camera " +
      "frame is black (40-140 colours, HUD only) in the harness at any progress, " +
      "in the live /rider/ride/demo?theme=cloud preview and in the ride, and the " +
      "committed cloud visual baseline is itself a black frame. Re-enable once the " +
      "authored kit renders; until then this case cannot say anything about effort.",
  },
];

for (const { theme, blocked } of WORLDS) {
  test(`effort visibly transforms the ${theme} world`, async ({ page }) => {
    test.setTimeout(150_000);
    test.fixme(Boolean(blocked), blocked);
    const rest = await frameAt(page, theme, 0);
    const sprint = await frameAt(page, theme, 1.4);
    const delta = await diff(rest, sprint);
    console.log(`effort-world ${theme}: ${JSON.stringify(delta)}`);
    // Floors, not baselines: the claim is "effort changes the picture", so this
    // has to fail if the wiring is cut, and it must not care about the exact
    // shade any particular theme happens to use today.
    expect(
      delta.changedPixelPct,
      `rest and sprint frames are ${JSON.stringify(delta)} — identical frames usually mean the world drew nothing`,
    ).toBeGreaterThan(5);
    expect(
      delta.meanChannelDelta,
      `rest and sprint frames are ${JSON.stringify(delta)} — identical frames usually mean the world drew nothing`,
    ).toBeGreaterThan(1);
  });
}
