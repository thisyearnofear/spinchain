import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, type Config } from "wagmi";
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

const ANKR_KEY = process.env.NEXT_PUBLIC_ANKR_API_KEY;

const ETHEREUM_MAINNET_RPC =
  process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ||
  (ANKR_KEY ? `https://rpc.ankr.com/eth/${ANKR_KEY}` : "https://rpc.ankr.com/eth");

const AVALANCHE_RPC =
  process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL ||
  (ANKR_KEY ? `https://rpc.ankr.com/avalanche_fuji/${ANKR_KEY}` : "https://api.avax-test.network/ext/bc/C/rpc");

const AVALANCHE_MAINNET_RPC =
  process.env.NEXT_PUBLIC_AVALANCHE_MAINNET_RPC_URL ||
  (ANKR_KEY ? `https://rpc.ankr.com/avalanche/${ANKR_KEY}` : "https://rpc.ankr.com/avalanche");

export function createBrowserWagmiConfig(): Config {
  return getDefaultConfig({
    appName: "SpinChain",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
    chains: [avalancheFuji, avalanche, mainnet],
    transports: {
      [avalancheFuji.id]: http(AVALANCHE_RPC),
      [avalanche.id]: http(AVALANCHE_MAINNET_RPC),
      [mainnet.id]: http(ETHEREUM_MAINNET_RPC),
    },
    ssr: true, // Enable SSR mode for Next.js - prevents hydration mismatch
    storage,
    syncConnectedChain: true,
  });
}
