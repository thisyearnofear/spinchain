import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { avalanche, avalancheFuji, mainnet } from "wagmi/chains";
import { createStorage } from "wagmi";

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

export const config = getDefaultConfig({
  appName: "SpinChain",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
  chains: [avalancheFuji, avalanche, mainnet],
  ssr: true,
  storage,
  // Ensure wallet connection persists across page navigations
  // This is crucial for mobile wallet apps like Base that use deep linking
  syncConnectedChain: true,
});
