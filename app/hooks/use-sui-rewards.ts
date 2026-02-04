"use client";

/**
 * Sui SPIN Rewards Hook
 * 
 * Core Principle: UTILITY - Enables Sui-only users to earn rewards
 * Manages SPIN token minting, balance tracking, and EVM bridging
 * 
 * Usage:
 * ```typescript
 * const { mintReward, balance, claimForBridge } = useSuiRewards();
 * 
 * // Mint reward after session
 * await mintReward(sessionId, 1000, "Completed 45-min endurance ride");
 * 
 * // Check balance
 * console.log(`You have ${balance} SPIN`);
 * 
 * // Bridge to EVM
 * await claimForBridge("0xYourEVMAddress");
 * ```
 */

import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState, useCallback, useEffect } from "react";
import { SUI_CONFIG } from "../config";
import { useSuiTransaction } from "./use-sui-transaction";

const SPIN_MODULE = "spin_token";
const TREASURY_CAP_ID = process.env.NEXT_PUBLIC_SUI_TREASURY_CAP_ID; // Set after SPIN deployment

export interface SuiReward {
  amount: number;
  reason: string;
  sessionId: string;
  timestamp: number;
}

interface UseSuiRewardsReturn {
  // Actions
  mintReward: (sessionId: string, amount: number, reason: string) => Promise<boolean>;
  batchMintRewards: (sessionId: string, recipients: string[], amounts: number[], reason: string) => Promise<boolean>;
  claimForBridge: (evmAddress: string, amount?: number) => Promise<boolean>;
  
  // Data
  balance: number;
  rewards: SuiReward[];
  
  // State
  isMinting: boolean;
  isClaiming: boolean;
  isLoading: boolean;
}

/**
 * Hook for managing Sui SPIN rewards
 * Enables Sui-native reward earning and EVM bridging
 */
export function useSuiRewards(): UseSuiRewardsReturn {
  const client = useSuiClient();
  const account = useCurrentAccount();
  
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<SuiReward[]>([]);
  const [spinType, setSpinType] = useState<string | null>(null);

  const mintTx = useSuiTransaction({
    successMessage: "SPIN rewards minted",
    pendingMessage: "Minting rewards...",
  });

  const claimTx = useSuiTransaction({
    successMessage: "Rewards claimed for EVM bridge",
    pendingMessage: "Processing bridge claim...",
  });

  // Fetch SPIN balance
  useEffect(() => {
    if (!account || !spinType) return;

    const fetchBalance = async () => {
      try {
        const coins = await client.getCoins({
          owner: account.address,
          coinType: spinType,
        });
        
        const total = coins.data.reduce((sum, coin) => sum + Number(coin.balance), 0);
        setBalance(total);
      } catch (err) {
        console.error("Failed to fetch SPIN balance:", err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000); // Update every 10s
    
    return () => clearInterval(interval);
  }, [account, client, spinType]);

  /**
   * Mint SPIN reward for a rider
   * Called by instructor or incentive engine after session completion
   */
  const mintReward = useCallback(async (
    sessionId: string,
    amount: number,
    reason: string
  ): Promise<boolean> => {
    if (!account || !TREASURY_CAP_ID) {
      console.warn("[SuiRewards] Wallet not connected or treasury not configured");
      return false;
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${SUI_CONFIG.packageId}::${SPIN_MODULE}::mint_reward`,
      arguments: [
        tx.object(TREASURY_CAP_ID),
        tx.pure.u64(amount),
        tx.pure.address(account.address),
        tx.pure.string(reason),
        tx.pure.id(sessionId),
      ],
    });

    const success = await mintTx.execute(tx);
    
    if (success) {
      setRewards(prev => [{
        amount,
        reason,
        sessionId,
        timestamp: Date.now(),
      }, ...prev]);
    }
    
    return success;
  }, [account, mintTx]);

  /**
   * Batch mint rewards to multiple riders
   * Efficient for post-session reward distribution
   */
  const batchMintRewards = useCallback(async (
    sessionId: string,
    recipients: string[],
    amounts: number[],
    reason: string
  ): Promise<boolean> => {
    if (!account || !TREASURY_CAP_ID) {
      console.warn("[SuiRewards] Wallet not connected or treasury not configured");
      return false;
    }

    if (recipients.length !== amounts.length) {
      console.error("[SuiRewards] Recipients and amounts length mismatch");
      return false;
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${SUI_CONFIG.packageId}::${SPIN_MODULE}::batch_mint_rewards`,
      arguments: [
        tx.object(TREASURY_CAP_ID),
        tx.pure.vector("address", recipients.map(r => r)),
        tx.pure.vector("u64", amounts),
        tx.pure.string(reason),
        tx.pure.id(sessionId),
      ],
    });

    return await mintTx.execute(tx);
  }, [account, mintTx]);

  /**
   * Claim SPIN rewards to be bridged to EVM
   * Burns Sui SPIN and emits event for EVM minting
   */
  const claimForBridge = useCallback(async (
    evmAddress: string,
    amount?: number
  ): Promise<boolean> => {
    if (!account || !spinType) {
      console.warn("[SuiRewards] Wallet not connected or SPIN not deployed");
      return false;
    }

    // Get SPIN coins to burn
    const coins = await client.getCoins({
      owner: account.address,
      coinType: spinType,
    });

    if (coins.data.length === 0) {
      console.warn("[SuiRewards] No SPIN balance to claim");
      return false;
    }

    const tx = new Transaction();
    
    // Merge coins if needed
    const primaryCoin = tx.object(coins.data[0].coinObjectId);
    
    if (coins.data.length > 1) {
      const otherCoins = coins.data.slice(1).map(c => tx.object(c.coinObjectId));
      tx.mergeCoins(primaryCoin, otherCoins);
    }

    // Split exact amount if specified
    const coinToBurn = amount 
      ? tx.splitCoins(primaryCoin, [tx.pure.u64(amount)])
      : primaryCoin;

    tx.moveCall({
      target: `${SUI_CONFIG.packageId}::${SPIN_MODULE}::claim_for_bridge`,
      arguments: [
        coinToBurn,
        tx.pure.string(evmAddress),
      ],
    });

    return await claimTx.execute(tx);
  }, [account, client, claimTx, spinType]);

  return {
    // Actions
    mintReward,
    batchMintRewards,
    claimForBridge,
    
    // Data
    balance,
    rewards,
    
    // State
    isMinting: mintTx.isPending,
    isClaiming: claimTx.isPending,
    isLoading: !spinType,
  };
}

export default useSuiRewards;
