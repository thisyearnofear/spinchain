import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { avalanche, mainnet } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "SpinChain",
  projectId: "YOUR_PROJECT_ID",
  chains: [avalanche, mainnet],
  ssr: true, // If your dApp uses server side rendering (SSR)
});
