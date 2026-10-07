import { test, expect } from "@playwright/test";

/**
 * A browser with no WebGL (old phones, locked-down gym tablets, GPU
 * blocklists) must still get a rideable route: 2D Focus, with 3D shown as
 * unavailable rather than selected over a dead canvas — and without the
 * renderer's "Error creating WebGL context" escaping as a page error.
 */

const LOCAL_ORIGIN = "http://127.0.0.1:3210";

test("no WebGL: the ride falls back to 2D Focus and still starts", async ({ page }) => {
  test.setTimeout(120_000);

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.route("**", (route) => {
    const url = route.request().url();
    return url.startsWith(LOCAL_ORIGIN) || url.startsWith("data:") || url.startsWith("blob:")
      ? route.continue()
      : route.abort();
  });
  await page.routeWebSocket("**", (socket) => socket.close());
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (/webgl/i.test(type)) return null;
      return (getContext as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
    try {
      window.localStorage.setItem("spinchain:onboarding:ride-tutorial", "true");
    } catch {
      // storage may be unavailable during prerender
    }
  });

  await page.goto("/rider/ride/demo", { waitUntil: "domcontentloaded" });

  const focus = page.getByRole("button", { name: "Switch to 2D Focus view" });
  const immersive = page.getByRole("button", { name: "Switch to immersive 3D view" });
  await expect(focus).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  await expect(immersive).toBeDisabled();
  await expect(immersive).toContainText("No WebGL");
  await expect(page.locator("canvas[data-engine]")).toHaveCount(0);

  const start = page.getByRole("button", { name: "Start ride", exact: true });
  await expect(start).toBeVisible({ timeout: 20_000 });
  await start.click();
  await expect(start).toBeHidden({ timeout: 30_000 });

  await page.keyboard.press("v");
  await expect(page.locator("canvas[data-engine]")).toHaveCount(0);
  expect(errors, `page errors: ${JSON.stringify(errors)}`).toEqual([]);
});
