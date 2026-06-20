"use client";

import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import "@mysten/dapp-kit/dist/index.css";
import { SUI_CONFIG } from "@/app/config";

// Tatum Sui RPC gateway fallback. Set NEXT_PUBLIC_TATUM_API_KEY to route every
// Sui read/write through Tatum's hosted gateway. Unset = Mysten defaults.
// This is the single Tatum integration point — no SDK, no parallel client.
// See docs/HACKATHON_PLAN.md (Phase 1) and docs/SUI_OVERFLOW_SUBMISSION.md.
const TATUM_API_KEY = process.env.NEXT_PUBLIC_TATUM_API_KEY;
const tatumUrl = (network: "testnet" | "mainnet" | "devnet" | "localnet"): string | undefined =>
	TATUM_API_KEY ? `https://sui-${network}.gateway.tatum.io` : undefined;

const { networkConfig } = createNetworkConfig({
	localnet: { url: tatumUrl("localnet") ?? getFullnodeUrl("localnet") },
	devnet: { url: tatumUrl("devnet") ?? getFullnodeUrl("devnet") },
	testnet: { url: tatumUrl("testnet") ?? getFullnodeUrl("testnet") },
	mainnet: { url: tatumUrl("mainnet") ?? getFullnodeUrl("mainnet") },
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
