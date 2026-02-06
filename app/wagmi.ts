import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { avalanche, avalancheFuji, mainnet } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "SpinChain",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",
  chains: [avalancheFuji, avalanche, mainnet],
  ssr: true,
});
