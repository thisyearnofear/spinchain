import { test, expect } from "@playwright/test";

// Receipt-first regression — Phase 1 privacy/receipt gate.
// Drives the REAL demo ride (keyboard pedaling) to completion.
// Mocked boundaries: injected EIP-1193 test wallet (EIP-6963) and a
// non-loopback route abort. No receipt/store injection, no clock skips.
// Sui signing is covered by the SuiEngine executor unit tests, not here.

const LOCAL_ORIGIN = "http://127.0.0.1:3210";
const HISTORY_KEY = "spinchain:rides:history:v2";
const TEST_ACCOUNT = "0x1234567890abcdef1234567890abcdef12345678";
const FUJI_CHAIN_ID = "0xa869";

interface SavedRide {
  id: string;
  receipt?: {
    receiptId: string;
    sessionId: string;
    riderId: string;
    verification: { status: string; issuer: null | string };
    redemption: { status: string };
  };
  proof: { mode: string; status: string; isVerified: boolean };
  spinEarned: number;
}

function injectedWalletScript(account: string, chainId: string) {
  return `
    const account = ${JSON.stringify(account)};
    const chainId = ${JSON.stringify(chainId)};
    window.__walletCalls = [];
    const provider = {
      isMetaMask: true,
      selectedAddress: account,
      chainId,
      request: async ({ method }) => {
        window.__walletCalls.push(method);
        switch (method) {
          case "eth_requestAccounts":
          case "eth_accounts":
            return [account];
          case "eth_chainId":
            return chainId;
          case "net_version":
            return String(parseInt(chainId, 16));
          case "personal_sign":
          case "eth_signTypedData_v4":
            return ${JSON.stringify(`0x${"ab".repeat(65)}`)};
          case "wallet_switchEthereumChain":
          case "wallet_addEthereumChain":
            return null;
          default:
            return null;
        }
      },
      on: () => {},
      removeListener: () => {},
      emit: () => {},
    };
    window.ethereum = provider;
    const info = {
      uuid: "spinchain-test-wallet",
      name: "Test Wallet",
      icon: "data:image/svg+xml,<svg/>",
      rdns: "com.spinchain.testwallet",
    };
    const detail = Object.freeze({ info, provider });
    window.addEventListener("eip6963:requestProvider", () => {
      window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
    });
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
  `;
}

// Public personal-data write attempts, kept on the Node side so the array
// survives page navigations.
let publicWriteAttempts: string[] = [];

function classifyRequest(method: string, url: string, body: string | null): string | null {
  const isWrite = method === "PUT" || method === "POST";
  if (!isWrite) return null;
  if (/walrus|aggregator|publisher/i.test(url)) return `${method} walrus-endpoint`;
  if (/\/api\/rides\/sync$/.test(url)) return "POST /api/rides/sync";
  if (/\/api\/rides\/walrus$/.test(url)) return "POST /api/rides/walrus";
  if (/\/api\/live-telemetry$/.test(url)) return "POST /api/live-telemetry";
  if (body) {
    try {
      const parsed = JSON.parse(body) as { method?: string };
      const m = parsed?.method;
      if (
        m === "eth_sendTransaction" ||
        m === "eth_sendRawTransaction" ||
        m === "sui_executeTransactionBlock"
      ) {
        return `rpc ${m}`;
      }
    } catch {
      // not JSON-RPC
    }
  }
  return null;
}

test.beforeEach(async ({ page }) => {
  publicWriteAttempts = [];

  await page.addInitScript(injectedWalletScript(TEST_ACCOUNT, FUJI_CHAIN_ID));
  // Pre-seed the tutorial flag only — no ride data or store state injected.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("spinchain:onboarding:ride-tutorial", "true");
    } catch {
      // storage may be unavailable during prerender
    }
  });

  // SAFETY: abort every non-loopback request (HTTP and WebSocket).
  await page.route("**", (route) => {
    const url = route.request().url();
    if (url.startsWith(LOCAL_ORIGIN) || url.startsWith("data:") || url.startsWith("blob:")) {
      return route.continue();
    }
    return route.abort();
  });
  await page.routeWebSocket("**", (socket) => socket.close());

  page.on("request", (request) => {
    const hit = classifyRequest(request.method(), request.url(), request.postData());
    if (hit) publicWriteAttempts.push(hit);
  });
});

test("demo ride completes with a durable local receipt and zero public writes", async ({ page }, testInfo) => {
  test.setTimeout(180_000);

  const response = await page.goto("/rider/ride/demo", { waitUntil: "domcontentloaded" });
  expect(response, "demo ride navigation must succeed").not.toBeNull();
  expect(response!.ok(), `ride returned ${response?.status()}`).toBeTruthy();

  // Software rendering is more stable in 2D Focus; the 45s default is the
  // intended duration — select both via the actual controls.
  const focus = page.getByRole("button", { name: "2D Focus" });
  if (await focus.isVisible().catch(() => false)) {
    await focus.click();
  }
  const duration45 = page.getByRole("button", { name: "45 s" });
  if (await duration45.isVisible().catch(() => false)) {
    await duration45.click();
  }

  const startButton = page.getByRole("button", { name: "Start ride", exact: true });
  await expect(startButton).toBeVisible({ timeout: 15_000 });
  await startButton.click();
  await expect(startButton).toBeHidden({ timeout: 15_000 });

  // Drive the real demo clock with keyboard pedaling until the completion
  // screen mounts — no store injection, no clock skips.
  const completion = page.getByTestId("ride-completion");
  // Desktop pedals via the keyboard; mobile shows tap targets instead.
  const pedalL = page.getByRole("button", { name: /^Left L$/ });
  const pedalR = page.getByRole("button", { name: /^Right R$/ });
  const deadline = Date.now() + 160_000;
  let done = false;
  while (Date.now() < deadline && !done) {
    const touchPedals = await pedalL.isVisible().catch(() => false);
    for (let i = 0; i < 20; i++) {
      if (done) break;
      if (touchPedals) {
        const pedal = i % 2 === 0 ? pedalL : pedalR;
        if (!(await pedal.isVisible().catch(() => false))) break;
        await pedal.dispatchEvent("touchstart");
        await page.waitForTimeout(120);
      } else {
        await page.keyboard.press(i % 2 === 0 ? "ArrowLeft" : "ArrowRight");
        await page.waitForTimeout(100);
      }
    }
    done = await completion.isVisible().catch(() => false);
  }
  await expect(
    completion,
    "completion screen must appear after pedaling the demo to the end",
  ).toBeVisible({ timeout: 10_000 });

  // Saved-status chip is visible and reflects an actual persisted record.
  await expect(page.getByTestId("ride-record-status")).toContainText(
    "Ride recorded on this device",
  );
  await page.screenshot({
    path: `test-results/receipt-completion-${testInfo.project.name}.png`,
    fullPage: true,
  });

  // The saved ride must carry a valid V1 receipt bound to the same summary.
  const saved = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SavedRide[]) : [];
  }, HISTORY_KEY);
  expect(saved.length, "exactly one ride record must be saved").toBe(1);
  const ride = saved[0];
  expect(ride.receipt, "saved ride must carry a RideReceiptV1").toBeTruthy();
  expect(ride.receipt!.receiptId).toBe(ride.id);
  expect(ride.receipt!.sessionId).toBeTruthy();
  expect(ride.receipt!.riderId).toBeTruthy();
  expect(ride.receipt!.verification.status).toBe("unverified");
  expect(ride.receipt!.redemption.status).toBe("unavailable");
  expect(ride.spinEarned).toBe(0);
  expect(ride.proof.mode).toBe("none");

  // No claim UI on the completion screen under the default policy.
  await expect(completion).not.toContainText(/\bSPIN\b|ready to claim|claim rewards/i);
  await expect(completion).not.toContainText(/verified/i);

  // Reload journey: the record persists and stays honestly labelled.
  const jres = await page.goto("/rider/journey", { waitUntil: "domcontentloaded" });
  expect(jres, "journey navigation must succeed").not.toBeNull();
  expect(jres!.ok()).toBeTruthy();
  const main = page.locator("main").first();
  await expect(main).toContainText(/ride record/i);
  await expect(main).toContainText(/not independently verified/i);
  const journeyText = await main.innerText();
  expect(journeyText).not.toMatch(/\bSPIN\b|ready to claim|claim rewards|verified score/i);
  await page.screenshot({
    path: `test-results/receipt-journey-${testInfo.project.name}.png`,
    fullPage: true,
  });

  // Zero public personal-data write attempts across the whole session.
  expect(publicWriteAttempts, `public write attempts: ${publicWriteAttempts}`).toEqual([]);

  // The injected wallet recorded every JSON-RPC method name — no transaction
  // requests may have been made.
  const walletCalls = await page.evaluate(
    () => (window as unknown as { __walletCalls?: string[] }).__walletCalls ?? [],
  );
  expect(walletCalls).not.toContain("eth_sendTransaction");
  expect(walletCalls).not.toContain("eth_sendRawTransaction");
});
