import { test, expect } from "@playwright/test";

/**
 * Wedge guard — the happy path must stay frictionless and rider-language only.
 * - Landing: hero exists with exactly one primary CTA (Try Demo Ride), no
 *   wallet gate to start it.
 * - Rider: gamification visible on the front door + exactly one primary CTA.
 * - Hero copy: no infra language (ZK, ERC, state channel, Walrus, ClearNode).
 *
 * Guardrails: assertions must fail loudly — no caught navigation errors, no
 * empty-string text fallbacks, no fixed sleeps.
 */

test("landing hero has exactly one primary CTA and no infra language", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response, "landing navigation must succeed").not.toBeNull();
  expect(response!.ok(), `landing returned ${response?.status()}`).toBeTruthy();

  const hero = page.locator("header").first();
  await expect(hero, "landing hero must exist").toBeVisible();

  // Exactly one primary CTA inside the hero, reachable without a wallet.
  const ctaArea = hero.getByTestId("primary-cta");
  await expect(ctaArea, "exactly one primary CTA area in hero").toHaveCount(1);

  const primaryCta = ctaArea.getByRole("link", { name: /try a demo ride/i });
  await expect(primaryCta, "hero demo CTA link").toBeVisible();
  await expect(primaryCta).toHaveAttribute("href", /^\/rider\/ride\/demo/);

  const heroText = await hero.innerText();
  for (const term of ["ZK", "ERC-", "state channel", "Walrus", "ClearNode", "HonkVerifier"]) {
    expect(heroText).not.toContain(term);
  }
});

test("rider page surfaces gamification + exactly one primary CTA", async ({ page }) => {
  const response = await page.goto("/rider", { waitUntil: "domcontentloaded" });
  expect(response, "rider navigation must succeed").not.toBeNull();
  expect(response!.ok(), `rider returned ${response?.status()}`).toBeTruthy();

  const main = page.locator("main").first();
  await expect(main, "rider main region must exist").toBeVisible();

  // Gamification signals are visible with meaningful copy, not just a wrapper.
  const gamification = main.getByTestId("gamification-bar");
  await expect(gamification, "gamification bar must be visible").toBeVisible();
  await expect(
    gamification,
    "gamification bar must carry rider-facing copy",
  ).toContainText(/streak|ride|flow/i);

  // Exactly one primary CTA in the primary area; guests get the demo path.
  // The test id sits on the CTA element itself here, so assert it directly.
  const primaryCta = main.getByTestId("primary-cta");
  await expect(primaryCta, "exactly one primary CTA on rider page").toHaveCount(1);
  await expect(primaryCta).toBeVisible();
  await expect(primaryCta).toHaveAccessibleName(/demo ride|connect wallet/i);
  const href = await primaryCta.getAttribute("href");
  if (href !== null) {
    expect(href).toMatch(/^\/rider\/ride\//);
  }
});
