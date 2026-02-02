import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, mainnet } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'SpinChain',
  projectId: 'YOUR_PROJECT_ID',
  chains: [base, mainnet],
  ssr: true, // If your dApp uses server side rendering (SSR)
});
