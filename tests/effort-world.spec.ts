import { test, expect } from "@playwright/test";
import sharp from "sharp";

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
  // R3F needs a few frames after hydration before the scene graph is settled.
  await page.waitForTimeout(2_500);
  const buffer = await page.screenshot();
  page.off("pageerror", collect);
  expect(errors, `page errors while rendering ${theme} at intensity=${intensity}`).toEqual([]);
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

for (const theme of ["neon", "alpine"]) {
  test(`effort visibly transforms the ${theme} world`, async ({ page }) => {
    test.setTimeout(150_000);
    const rest = await frameAt(page, theme, 0);
    const sprint = await frameAt(page, theme, 1.4);
    const delta = await diff(rest, sprint);
    console.log(`effort-world ${theme}: ${JSON.stringify(delta)}`);
    // Floors, not baselines: the claim is "effort changes the picture", so this
    // has to fail if the wiring is cut, and it must not care about the exact
    // shade any particular theme happens to use today.
    expect(delta.changedPixelPct, `rest and sprint frames are ${JSON.stringify(delta)}`).toBeGreaterThan(5);
    expect(delta.meanChannelDelta, `rest and sprint frames are ${JSON.stringify(delta)}`).toBeGreaterThan(1);
  });
}
