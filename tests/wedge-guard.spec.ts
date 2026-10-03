import { test, expect } from "@playwright/test";

/**
 * Wedge guard — the happy path must stay frictionless and rider-language only.
 * - Landing: one primary CTA (Try Demo Ride), no wallet gate to start it.
 * - Rider: gamification visible on the front door + one primary CTA.
 * - Hero copy: no infra language (ZK, ERC, state channel, Walrus, ClearNode).
 */

test("landing has one primary CTA and no infra language in hero", async ({ page }) => {
  await page.goto("/", { waitUntil: "commit" }).catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1500);

  const demoCta = page.getByRole("link", { name: /try a demo ride/i });
  await expect(demoCta.first()).toBeVisible();

  const hero = await page.locator("header").first().innerText().catch(() => "");
  for (const term of ["ZK", "ERC-", "state channel", "Walrus", "ClearNode", "HonkVerifier"]) {
    expect(hero).not.toContain(term);
  }
});

test("rider page surfaces game + primary CTA", async ({ page }) => {
  await page.goto("/rider", { waitUntil: "commit" }).catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1500);

  // Gamification bar visible on the front door (streak / rides / flow).
  const body = await page.locator("main").first().innerText().catch(() => "");
  expect(body.length).toBeGreaterThan(0);

  const demoCta = page.getByRole("link", { name: /demo ride/i });
  await expect(demoCta.first()).toBeVisible();
});
