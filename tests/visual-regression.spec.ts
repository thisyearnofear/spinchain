import { inflateSync } from "node:zlib";
import { test, expect } from "@playwright/test";

test.setTimeout(60_000);

/**
 * Visual Regression Harness — SpinChain adaptation of threejs-qa-release
 * visual-test-harness.md.
 *
 * States:
 * - preview              — route preview before ride (progress 0, not riding)
 * - active-play-desktop  — mid-ride immersive 3D, desktop viewport
 * - active-play-mobile   — mid-ride immersive 3D, mobile viewport (Pixel 5)
 * - finished             — rideProgress 100, completion celebration
 *
 * Determinism: driven via window.__THREE_GAME_TEST_HOOKS__ (seed + setState + setPausedForScreenshot)
 * installed by app/lib/test-hooks.ts. The harness also supports URL ?testState= for direct navigation.
 *
 * Commands:
 *   pnpm exec playwright test tests/visual-regression.spec.ts --update-snapshots
 *   pnpm exec playwright test tests/visual-regression.spec.ts
 */

// paused=1 freezes the R3F frameloop (RouteVisualizer paused prop) so
// toHaveScreenshot can capture a stable frame; without it the animated
// scene never produces two identical screenshots and the assertion times out.
const STATES = [
  { name: "preview", url: "/test-harness/route-visualizer?testState=preview&seed=123&paused=1", fullPage: true },
  { name: "active-play", url: "/test-harness/route-visualizer?testState=active-play&seed=123&paused=1", fullPage: true },
  { name: "finished", url: "/test-harness/route-visualizer?testState=finished&seed=123&paused=1", fullPage: true },
] as const;

async function gotoWithHarness(page: import("@playwright/test").Page, url: string) {
  // WalletConnect tries to access indexedDB during SSR which throws in Playwright's
  // server render — the page still hydrates, but goto with domcontentloaded can abort.
  // Use commit + manual domcontentloaded wait and swallow the SSR error.
  await page.goto(url, { waitUntil: "commit" }).catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1000);
  // Wait for Next.js hydration + TestHooks install + Canvas mount
  await page.waitForFunction(() => typeof (window as unknown as { __THREE_GAME_TEST_HOOKS__?: unknown }).__THREE_GAME_TEST_HOOKS__ !== "undefined", { timeout: 10_000 }).catch(() => {});
  // Give R3F a couple frames to render demand loop
  await page.waitForTimeout(1500);
  // Canvas mount only; whether it actually drew is asserted by the smoke test
  // below, not assumed here.
  await page.locator("canvas").first().waitFor({ state: "attached", timeout: 5_000 }).catch(() => {});
  // Pause for deterministic screenshot (freeze drift/parallax)
  await page.evaluate(() => {
    const hooks = (window as unknown as { __THREE_GAME_TEST_HOOKS__?: { setPausedForScreenshot: (b: boolean) => void } }).__THREE_GAME_TEST_HOOKS__;
    hooks?.setPausedForScreenshot(true);
  });
  await page.waitForTimeout(300);
}

for (const { name, url } of STATES) {
  test(`visual — ${name} @ desktop`, async ({ page }) => {
    await gotoWithHarness(page, url);
    await expect(page).toHaveScreenshot(`${name}-desktop.png`, { fullPage: false });
  });
}

test("visual — active-play @ mobile", async ({ page }) => {
  // This test only runs in the mobile project (Pixel 5 viewport via playwright.config.ts)
  // When run on desktop project, it will still pass but use desktop viewport — the
  // config's second project ensures true mobile coverage.
  await gotoWithHarness(page, "/test-harness/route-visualizer?testState=active-play&seed=123&paused=1");
  await expect(page).toHaveScreenshot(`active-play-mobile.png`, { fullPage: false });
});

/**
 * Decode an 8-bit RGB/RGBA PNG (what Playwright screenshots are) with node's
 * zlib and summarise it: distinct colours at 5 bits/channel and luma range.
 */
function pixelStats(png: Buffer) {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24];
  const colorType = png[25];
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported PNG: depth ${bitDepth}, colour type ${colorType}`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const idat: Buffer[] = [];
  for (let off = 8; off < png.length; ) {
    const len = png.readUInt32BE(off);
    const type = png.toString("ascii", off + 4, off + 8);
    if (type === "IDAT") idat.push(png.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const prev = Buffer.alloc(stride);
  const row = Buffer.alloc(stride);
  const colors = new Set<number>();
  let min = 255;
  let max = 0;
  for (let y = 0; y < height; y++) {
    const base = y * (stride + 1);
    const filter = raw[base];
    for (let x = 0; x < stride; x++) {
      const v = raw[base + 1 + x];
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      row[x] = (v + pred) & 0xff;
    }
    for (let x = 0; x < stride; x += bpp * 7) {
      const r = row[x], g = row[x + 1], bl = row[x + 2];
      colors.add(((r >> 3) << 10) | ((g >> 3) << 5) | (bl >> 3));
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
    row.copy(prev);
  }
  return { width, height, distinctColors: colors.size, lumaRange: max - min };
}

test("canvas is non-blank smoke", async ({ page }) => {
  // SwiftShader under parallel workers can take a while to parse the HDR and
  // compile shaders before the first real frame.
  test.setTimeout(120_000);
  // Live loop, not paused=1: the paused harness never draws a frame (its
  // baselines cover page chrome over the empty canvas, not the 3D scene), so
  // only an unpaused canvas can prove WebGL actually renders the route.
  await gotoWithHarness(page, "/test-harness/route-visualizer?testState=active-play&seed=123");
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();
  // An undrawn canvas shows only the CSS gradient behind it (~40–110 colours
  // at 5 bits/channel). A drawn route scene has sky, terrain, route, glow and
  // fog: well over a thousand. 400 sits clear of both.
  let stats = { width: 0, height: 0, distinctColors: 0, lumaRange: 0 };
  await expect
    .poll(async () => {
      // Viewport, not canvas.screenshot(): the first <canvas> isn't
      // necessarily the WebGL one, and the composited page is what riders see.
      stats = pixelStats(await page.screenshot());
      return stats.distinctColors;
    }, { message: "canvas never drew the scene", timeout: 75_000 })
    .toBeGreaterThan(400);
  expect(stats.width).toBeGreaterThan(0);
  expect(stats.lumaRange, `canvas has no contrast: ${JSON.stringify(stats)}`).toBeGreaterThan(40);
});
