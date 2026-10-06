import { defineConfig, devices } from "@playwright/test";

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
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  reporter: [["html", { open: "never" }], ["list"]],
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
    command: "pnpm build && pnpm start -p 3210",
    url: "http://127.0.0.1:3210",
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
    // Loopback-only test env so the browser suite can never reach a real
    // service (process env beats .env files in Next).
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3999",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      SUPABASE_SECRET_KEY: "test-secret-key",
      SESSION_SECRET: "spinchain-playwright-test-secret-0123456789ab",
      GEMINI_API_KEY: "",
      VENICE_API_KEY: "",
      NEXT_PUBLIC_KITE_AA_WALLET: "",
      NEXT_PUBLIC_KITE_AGENT_VAULT: "",
      NEXT_PUBLIC_KITE_USDC_ADDRESS: "",
      NEXT_PUBLIC_CHAINLINK_FORWARDER: "",
      NEXT_PUBLIC_CHAINLINK_WORKFLOW_ID: "",
      NEXT_PUBLIC_SUI_GAS_STATION_URL: "http://127.0.0.1:3999",
      NEXT_PUBLIC_SUI_PACKAGE_ID: "",
      NEXT_PUBLIC_USDT_ADDRESS: "",
      NEXT_PUBLIC_NOIR_VERIFIER_ADDRESS: "",
      NEXT_PUBLIC_DEFAULT_PAYMENT_METHOD: "",
      NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG: "",
      NEXT_PUBLIC_ENABLE_LEGACY_REWARD_CLAIMS: "false",
      NEXT_PUBLIC_REWARD_VERIFICATION_MODE: "",
      NEXT_PUBLIC_AVALANCHE_EXPLORER_URL: "http://127.0.0.1:3999",
      NEXT_PUBLIC_AVALANCHE_RPC_URL: "http://127.0.0.1:3999",
      NEXT_PUBLIC_AVALANCHE_MAINNET_RPC_URL: "http://127.0.0.1:3999",
      NEXT_PUBLIC_ETHEREUM_RPC_URL: "http://127.0.0.1:3999",
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "test-project-id",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3210",
      NVIDIA_API_KEY: "",
      ELEVENLABS_API_KEY: "",
      KITE_SIGNER_PRIVATE_KEY: "",
      MINDBODY_API_KEY: "",
      MINDBODY_SITE_ID: "",
      NEXT_PUBLIC_ANKR_API_KEY: "",
      NEXT_PUBLIC_TATUM_API_KEY: "",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "",
      RELAYER_PRIVATE_KEY: "",
      ANALYTICS_ADMIN_TOKEN: "",
      ENABLE_SERVER_ANALYTICS: "",
      NEXT_PUBLIC_AVALANCHE_CHAIN_ID: "",
      NEXT_PUBLIC_BIOMETRIC_ORACLE_ADDRESS: "",
      NEXT_PUBLIC_CLASS_FACTORY_ADDRESS: "",
      NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS: "",
      NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS: "",
      NEXT_PUBLIC_SPIN_PACK_ADDRESS: "",
      NEXT_PUBLIC_SPIN_TOKEN_ADDRESS: "",
      NEXT_PUBLIC_TREASURY_SPLITTER_ADDRESS: "",
      NEXT_PUBLIC_ULTRA_VERIFIER_ADDRESS: "",
    },
  },
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    },
  },
});
