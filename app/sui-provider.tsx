"use client";

import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import "@mysten/dapp-kit/dist/index.css";
import { SUI_CONFIG } from "@/app/config";

const { networkConfig } = createNetworkConfig({
	localnet: { url: getFullnodeUrl("localnet") },
	devnet: { url: getFullnodeUrl("devnet") },
	testnet: { url: getFullnodeUrl("testnet") },
	mainnet: { url: getFullnodeUrl("mainnet") },
});

// Single source of truth for the Sui package ID (see app/config.ts).
export const SUI_PACKAGE_ID = SUI_CONFIG.packageId;

export function SuiProvider({ children }: { children: React.ReactNode }) {
	return (
		<SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
			<WalletProvider autoConnect>
				{children}
			</WalletProvider>
		</SuiClientProvider>
	);
}
