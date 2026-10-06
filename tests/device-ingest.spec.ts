import { test, expect } from "@playwright/test";

/**
 * Device telemetry through the real ingest seam, on a ride that then has to
 * finish.
 *
 * The coordinator's clock tests (app/engines/__tests__/coordinator-clock.test.ts)
 * prove the pacing maths with fake timers. What they cannot prove is that a
 * browser build still wires a device-shaped update to that seam at all — the
 * path from `coordinator.ingestBleMetrics` into the telemetry engine is exactly
 * where the native-transport channel-presence bug lived. This drives it through
 * the same function a paired bike calls, then rides to the completion screen so
 * a broken ingest cannot pass by simply doing nothing.
 *
 * 2D Focus for the same reason receipt-first.spec.ts uses it: software WebGL
 * renders the immersive scene at a fraction of a frame per second here, which
 * makes the clock, not the code, the thing under test. The 3D effort response
 * is covered by tests/effort-world.spec.ts.
 */

const LOCAL_ORIGIN = "http://127.0.0.1:3210";

type Hooks = {
  pushTelemetry(metrics: Record<string, unknown>): boolean;
};

async function push(page: import("@playwright/test").Page, metrics: Record<string, unknown>) {
  return page.evaluate((m) => {
    const hooks = (window as unknown as { __THREE_GAME_TEST_HOOKS__?: Hooks }).__THREE_GAME_TEST_HOOKS__;
    return hooks?.pushTelemetry(m) ?? false;
  }, metrics);
}

test("a paired bike's numbers reach the ride and the ride still completes", async ({ page }) => {
  test.setTimeout(240_000);

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  // Same safety net as receipt-first: nothing may leave loopback.
  await page.route("**", (route) => {
    const url = route.request().url();
    return url.startsWith(LOCAL_ORIGIN) || url.startsWith("data:") || url.startsWith("blob:")
      ? route.continue()
      : route.abort();
  });
  await page.routeWebSocket("**", (socket) => socket.close());
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("spinchain:onboarding:ride-tutorial", "true");
    } catch {
      // storage may be unavailable during prerender
    }
  });

  await page.goto("/rider/ride/demo?testHooks=1", { waitUntil: "domcontentloaded" });
  const focus = page.getByRole("button", { name: "2D Focus" });
  if (await focus.isVisible().catch(() => false)) await focus.click();
  const duration45 = page.getByRole("button", { name: "45 s" });
  if (await duration45.isVisible().catch(() => false)) await duration45.click();

  const start = page.getByRole("button", { name: "Start ride", exact: true });
  await expect(start).toBeVisible({ timeout: 20_000 });
  await start.click();

  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            typeof (window as unknown as { __THREE_GAME_TEST_HOOKS__?: Hooks }).__THREE_GAME_TEST_HOOKS__
              ?.pushTelemetry === "function",
        ),
      { message: "the ride page to register its BLE ingest entry point" },
    )
    .toBe(true);

  // A power-only FTMS bike — the most common real device, and the one whose
  // effort used to read zero: watts on the wire, no heart-rate channel.
  let powerOnly = 0;
  for (let i = 0; i < 4; i++) {
    if (await push(page, { power: 245, cadence: 88, speed: 31, timestamp: Date.now(), channels: { power: true, cadence: true, speed: true, heartRate: false } })) powerOnly++;
    await page.waitForTimeout(250);
  }
  expect(powerOnly, "every power-only update must be accepted by a mounted ride").toBe(4);

  // An HR-only device: no watts channel at all, so the world must fall back to
  // heart-rate reserve rather than freezing at zero.
  const hrOnly = await push(page, { heartRate: 152, timestamp: Date.now(), channels: { power: false, cadence: false, speed: false, heartRate: true } });
  expect(hrOnly, "an HR-only update must be accepted too").toBe(true);

  // Now pedal to the end. The device feed keeps arriving on the way, because a
  // real bike does not stop reporting when the rider starts working.
  const completion = page.getByTestId("ride-completion");
  const deadline = Date.now() + 200_000;
  let done = false;
  for (let batch = 0; !done && Date.now() < deadline; batch++) {
    for (let i = 0; i < 20 && !done; i++) {
      if (i % 8 === 0) {
        await push(page, { power: 245 + (batch % 40), cadence: 92, timestamp: Date.now(), channels: { power: true, cadence: true, speed: true, heartRate: true } });
      }
      await page.keyboard.press(i % 2 === 0 ? "ArrowLeft" : "ArrowRight");
      await page.waitForTimeout(100);
      done = await completion.isVisible().catch(() => false);
    }
  }
  await expect(completion, "the ride must complete with device telemetry interleaved").toBeVisible({
    timeout: 15_000,
  });
  // The ride must run clean — with one exception this suite creates on purpose:
  // the loopback-only network policy above kills drei's <Environment preset> HDR
  // fetch (route-visualizer.tsx:1526 pulls potsdamer_platz_1k.hdr from a CDN),
  // which surfaces as that fetch failure plus its generic TypeError. Everything
  // else is a real defect. The remote-asset dependency itself is filed as a
  // separate issue — it is a genuine offline/spa-network risk, not a test artifact.
  const offlineCdnAsset = /potsdamer_platz_1k\.hdr|^TypeError: Failed to fetch$/i;
  const unexpected = errors.filter((e) => !offlineCdnAsset.test(e));
  expect(unexpected, `unexpected page errors during the ride: ${unexpected}`).toEqual([]);
});
