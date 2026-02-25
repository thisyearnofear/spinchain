"use client";

import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import "@mysten/dapp-kit/dist/index.css";

const { networkConfig } = createNetworkConfig({
	localnet: { url: getFullnodeUrl("localnet") },
	devnet: { url: getFullnodeUrl("devnet") },
	testnet: { url: getFullnodeUrl("testnet") },
	mainnet: { url: getFullnodeUrl("mainnet") },
});

// Export Sui package ID for use across the app
export const SUI_PACKAGE_ID = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID || 
  "0x98144f86c83bf486d90232833a6ed467aa3d853d237126537241a6e147f2b3f6";

export function SuiProvider({ children }: { children: React.ReactNode }) {
	return (
		<SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
			<WalletProvider autoConnect>
				{children}
			</WalletProvider>
		</SuiClientProvider>
	);
}
