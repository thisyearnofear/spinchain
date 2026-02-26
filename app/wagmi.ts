import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import type { Config } from "wagmi";
import { avalanche, avalancheFuji, mainnet } from "wagmi/chains";
import { createStorage } from "wagmi";

// IMPORTANT:
// Some wallet-related libraries (e.g. WalletConnect) may reference browser-only
// globals like `indexedDB` even when used with `ssr: true`. During `next build`,
// Next.js will evaluate modules on the server when generating the SSR bundle.
//
// To avoid build-time crashes like `ReferenceError: indexedDB is not defined`,
// we provide a minimal server-side stub for `indexedDB`.
// It is only used during SSR; the real IndexedDB API will be available in-browser.

if (typeof window === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (typeof g.indexedDB === "undefined") {
    g.indexedDB = undefined;
  }
}

// Custom storage that handles mobile browser quirks better
const storage = createStorage({
  storage: {
    getItem: (key) => {
      if (typeof window === "undefined") return null;
      try {
        const value = window.localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Ignore storage errors (e.g., private mode)
      }
    },
    removeItem: (key) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore storage errors
      }
    },
  },
});

export const config: Config = getDefaultConfig({
  appName: "SpinChain",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
  chains: [avalancheFuji, avalanche, mainnet],
  ssr: true,
  storage,
  // Ensure wallet connection persists across page navigations
  // This is crucial for mobile wallet apps like Base that use deep linking
  syncConnectedChain: true,
});
