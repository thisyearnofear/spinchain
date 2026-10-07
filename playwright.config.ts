import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Loopback test env lives in tests/e2e.env so CI's build job can inline the
// same NEXT_PUBLIC_* values the webServer gets here (see that file's header).
const e2eEnv = Object.fromEntries(
  readFileSync("tests/e2e.env", "utf8")
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => {
      const eq = line.indexOf("=");
      return [line.slice(0, eq), line.slice(eq + 1)];
    }),
);

// The webServer readiness probe is a plain HTTP request to loopback, and
// Playwright routes it through HTTP_PROXY when one is set. Agent/sandbox shells
// commonly export a local intercepting proxy, which answers those probe requests
// 405 — Playwright then waits out the full webServer timeout (10 minutes here)
// without starting a single browser, and the failure looks like a broken app.
// Loopback is never a proxy's business, so keep it out of the way unless the
// developer already pinned NO_PROXY themselves.
process.env.NO_PROXY ||= "127.0.0.1,localhost";
process.env.no_proxy ||= "127.0.0.1,localhost";

export default defineConfig({
  testDir: "./tests",
  // Baselines render via SwiftShader (software WebGL), so they are stable
  // across host OSes — pin the snapshot path without the platform segment
  // so the Linux-generated baselines also match on macOS dev machines.
  snapshotPathTemplate: "{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 2 on CI: overlaps wall-clock waits (fake-bike ride, timers). More risks
  // SwiftShader CPU thrash on 4-vCPU runners, which flakes the WebGL specs.
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  // Blob on CI so the sharded jobs' results merge into one HTML report
  // (playwright merge-reports); html stays for local runs.
  reporter: process.env.CI
    ? [["blob"], ["list"]]
    : [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://127.0.0.1:3210",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    launchOptions: {
      // Headless Chromium has no GPU here; without these flags WebGL context
      // creation fails ("Cannot read properties of null (reading 'alpha')")
      // and every canvas assertion is vacuous.
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
    },
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    // Production build: dev mode (strict-mode double-mount + HMR) loses the
    // WebGL context under software rendering, which blanked every baseline.
    // PLAYWRIGHT_PREBUILT (CI shards): skip the build and serve the downloaded
    // standalone artifact instead — the build job already ran it once.
    command: process.env.PLAYWRIGHT_PREBUILT
      ? "PORT=3210 HOSTNAME=127.0.0.1 node .next/standalone/server.js"
      : "pnpm build && pnpm start -p 3210",
    url: "http://127.0.0.1:3210",
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
    env: e2eEnv,
  },
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    },
  },
});
