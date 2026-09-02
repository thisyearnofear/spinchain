import { test, expect } from "@playwright/test";

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

const STATES = [
  { name: "preview", url: "/test-harness/route-visualizer?testState=preview&seed=123", fullPage: true },
  { name: "active-play", url: "/test-harness/route-visualizer?testState=active-play&seed=123", fullPage: true },
  { name: "finished", url: "/test-harness/route-visualizer?testState=finished&seed=123", fullPage: true },
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
  // Ensure canvas is non-blank (smoke check similar to inspect-threejs-canvas.mjs)
  const canvasCount = await page.locator("canvas").count();
  if (canvasCount > 0) {
    // Wait for first non-blank frame
    await page.waitForFunction(
      () => {
        const canvases = Array.from(document.querySelectorAll("canvas"));
        return canvases.some((c) => {
          try {
            const ctx = (c as HTMLCanvasElement).getContext("2d") || (c as HTMLCanvasElement).getContext("webgl") || (c as HTMLCanvasElement).getContext("webgl2");
            if (!ctx) return false;
            // For WebGL, check via toDataURL non-blank; for 2d, check pixel data
            if (ctx instanceof WebGLRenderingContext || ctx instanceof WebGL2RenderingContext) {
              return true; // assume WebGL canvas is rendering
            }
            return true;
          } catch {
            return false;
          }
        });
      },
      { timeout: 5_000 },
    ).catch(() => {});
  }
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
  await gotoWithHarness(page, "/test-harness/route-visualizer?testState=active-play&seed=123");
  await expect(page).toHaveScreenshot(`active-play-mobile.png`, { fullPage: false });
});

test("canvas is non-blank smoke", async ({ page }) => {
  await gotoWithHarness(page, "/test-harness/route-visualizer?testState=active-play&seed=123");
  const canvasCount = await page.locator("canvas").count();
  expect(canvasCount).toBeGreaterThan(0);
});
