"use client";

import { useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { CONTRACT_ADDRESSES, ACTIVE_NETWORK, isZeroAddress } from "@/app/lib/contracts";

export type NetworkGap = 
  | "wallet_disconnected"
  | "wrong_chain" 
  | "contracts_missing"
  | "relayer_unavailable";

export interface NetworkStatus {
  /** True when wallet + chain + contracts are all production-ready */
  ready: boolean;
  /** List of specific gaps preventing production mode */
  gaps: NetworkGap[];
  /** Human-readable summary for UI */
  summary: string;
}

export function useNetworkStatus(): NetworkStatus {
  const { isConnected } = useAccount();
  const chainId = useChainId();

  return useMemo(() => {
    const gaps: NetworkGap[] = [];

    if (!isConnected) gaps.push("wallet_disconnected");
    if (isConnected && chainId !== ACTIVE_NETWORK.id) gaps.push("wrong_chain");

    const criticalContracts = [
      CONTRACT_ADDRESSES.INCENTIVE_ENGINE,
      CONTRACT_ADDRESSES.CLASS_FACTORY,
      CONTRACT_ADDRESSES.SPIN_TOKEN,
    ];
    if (criticalContracts.some(isZeroAddress)) gaps.push("contracts_missing");

    const ready = gaps.length === 0;

    const summary = ready
      ? `Connected to ${ACTIVE_NETWORK.name}`
      : gaps.includes("wallet_disconnected")
        ? "Wallet not connected — rewards are simulated"
        : gaps.includes("wrong_chain")
          ? `Wrong network — switch to ${ACTIVE_NETWORK.name}`
          : gaps.includes("contracts_missing")
            ? "Contracts not deployed — running in demo mode"
            : "Network not ready";

    return { ready, gaps, summary };
  }, [isConnected, chainId]);
}
