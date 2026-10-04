import { test, expect } from "@playwright/test";

// Connected-wallet auth smoke with an injected EIP-1193 test wallet.
// Mocked boundaries are labelled below; the real proof->mint path is covered
// by contracts/evm/test/EffortThresholdVerifierHonk.t.sol, not this spec.

const TEST_ACCOUNT = "0x1234567890abcdef1234567890abcdef12345678";
const FUJI_CHAIN_ID = "0xa869"; // 43113 — avalancheFuji
const CANNED_SIGNATURE = `0x${"ab".repeat(65)}`;
const LOCAL_ORIGIN = "http://127.0.0.1:3210";

function injectedWalletScript(account: string, chainId: string) {
  return `
    const account = ${JSON.stringify(account)};
    const chainId = ${JSON.stringify(chainId)};
    const listeners = {};
    window.__walletCalls = [];
    const provider = {
      isMetaMask: true,
      selectedAddress: account,
      chainId,
      request: async ({ method, params }) => {
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
            return ${JSON.stringify(CANNED_SIGNATURE)};
          case "eth_signTypedData_v4":
            return ${JSON.stringify(CANNED_SIGNATURE)};
          case "wallet_switchEthereumChain":
          case "wallet_addEthereumChain":
            return null;
          default:
            return null;
        }
      },
      on: (event, handler) => { listeners[event] = handler; },
      removeListener: () => {},
      emit: () => {},
    };
    window.ethereum = provider;
    // EIP-6963 announcement so wagmi discovers this provider.
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

let signedIn = false;

test.beforeEach(async ({ page }) => {
  signedIn = false;
  await page.addInitScript(injectedWalletScript(TEST_ACCOUNT, FUJI_CHAIN_ID));

  // SAFETY: abort every non-loopback request (HTTP and WebSocket).
  await page.route("**", (route) => {
    const url = route.request().url();
    if (url.startsWith(LOCAL_ORIGIN) || url.startsWith("data:") || url.startsWith("blob:")) {
      return route.continue();
    }
    return route.abort();
  });
  await page.routeWebSocket("**", (socket) => socket.close());

  // MOCKED: auth backend — fixed session for any signature.
  await page.route("**/api/auth/evm-login", async (route) => {
    const body = route.request().postDataJSON?.() ?? {};
    if (!body.signature) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          nonce: "testnonce123",
          message: `Sign in to SpinChain\n\nAddress: ${TEST_ACCOUNT}\nOrigin: ${LOCAL_ORIGIN}\nNonce: testnonce123`,
        }),
      });
      return;
    }
    signedIn = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          address: TEST_ACCOUNT,
          role: "rider",
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      }),
    });
  });

  // MOCKED: session introspection reflects the mocked login state.
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: signedIn
          ? { address: TEST_ACCOUNT, role: "rider", exp: Math.floor(Date.now() / 1000) + 3600 }
          : null,
      }),
    }),
  );

  // MOCKED: sign-out endpoint.
  await page.route("**/api/auth/logout", (route) => {
    signedIn = false;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
});

test("injected wallet connects, signs in via personal_sign, and signs out (mocked EIP-1193 + auth routes)", async ({ page }) => {
  const response = await page.goto("/rider", { waitUntil: "domcontentloaded" });
  expect(response, "rider navigation must succeed").not.toBeNull();
  expect(response!.ok()).toBeTruthy();

  // wagmi reconnects the EIP-6963 test wallet; on mobile the controls are
  // behind the hamburger menu.
  const accountPill = page.getByRole("button", { name: /0x/i });
  const menuButton = page.getByRole("button", { name: /open menu/i });
  await expect
    .poll(
      async () => {
        if (await accountPill.first().isVisible().catch(() => false)) return "pill";
        if (await menuButton.isVisible().catch(() => false)) return "menu";
        return "none";
      },
      { timeout: 15_000 },
    )
    .not.toBe("none");
  if ((await accountPill.first().isVisible().catch(() => false)) === false) {
    await menuButton.click();
  }
  await expect(accountPill.first(), "connected account pill").toBeVisible();

  // The webServer env provides local Supabase config, so the sign-in
  // affordance always renders in this build.
  const signIn = page.getByRole("button", { name: /sign in to save rides/i });
  await expect(signIn, "sign-in affordance must render").toBeVisible();
  await signIn.click();

  // personal_sign must have been requested.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __walletCalls: string[] }).__walletCalls.includes(
            "personal_sign",
          ),
      ),
    )
    .toBe(true);

  // Authenticated state renders as an accessible sign-out control.
  const signOut = page.getByRole("button", { name: /sign out|signed in/i });
  await expect(signOut, "signed-in state after login").toBeVisible();

  // Sign-out restores the pre-auth affordance.
  await signOut.click();
  await expect(
    page.getByRole("button", { name: /sign in to save rides/i }),
    "sign-in affordance returns after sign-out",
  ).toBeVisible();
});
