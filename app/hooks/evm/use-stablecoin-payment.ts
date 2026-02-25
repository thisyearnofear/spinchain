"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { useTransaction } from "./use-transaction";
import { CONTRACTS, PAYMENT_CONFIG } from "@/app/config";
import { erc20Abi } from "viem";

type PaymentMethod = "native" | "usdc" | "usdt";

interface StablecoinPaymentParams {
  classAddress: `0x${string}`;
  amount: bigint;
  paymentMethod: PaymentMethod;
}

export function useStablecoinPayment() {
  const { address } = useAccount();
  const [isApproving, setIsApproving] = useState(false);

  const approveTx = useTransaction({
    successMessage: "Payment approved",
    pendingMessage: "Approving payment...",
  });

  const purchaseTx = useTransaction({
    successMessage: "Ticket purchased!",
    pendingMessage: "Purchasing ticket...",
  });

  /**
   * Get stablecoin contract address for payment method
   */
  const getTokenAddress = useCallback((method: PaymentMethod): `0x${string}` | null => {
    if (method === "native") return null;
    if (method === "usdc") return CONTRACTS.avalanche.usdc;
    if (method === "usdt") return CONTRACTS.avalanche.usdt;
    return null;
  }, []);

  /**
   * Check if user has sufficient balance for payment
   */
  const checkBalance = useCallback(
    async (amount: bigint, method: PaymentMethod): Promise<boolean> => {
      if (!address) return false;

      if (method === "native") {
        // Check native AVAX balance via provider
        // This would need to be implemented with useBalance hook
        return true; // Simplified for now
      }

      const tokenAddress = getTokenAddress(method);
      if (!tokenAddress) return false;

      // Check ERC20 balance
      // This would need to be implemented with useReadContract
      return true; // Simplified for now
    },
    [address, getTokenAddress]
  );

  /**
   * Approve stablecoin spending (required before purchase)
   */
  const approvePayment = useCallback(
    async (classAddress: `0x${string}`, amount: bigint, method: PaymentMethod) => {
      if (method === "native") return true; // No approval needed for native

      const tokenAddress = getTokenAddress(method);
      if (!tokenAddress) throw new Error("Invalid payment method");

      setIsApproving(true);

      try {
        await approveTx.write({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [classAddress, amount],
        });

        setIsApproving(false);
        return true;
      } catch (error) {
        setIsApproving(false);
        throw error;
      }
    },
    [approveTx, getTokenAddress]
  );

  /**
   * Purchase ticket with selected payment method
   */
  const purchaseTicket = useCallback(
    async ({ classAddress, amount, paymentMethod }: StablecoinPaymentParams) => {
      if (!address) throw new Error("Wallet not connected");

      // Check balance
      const hasBalance = await checkBalance(amount, paymentMethod);
      if (!hasBalance) throw new Error("Insufficient balance");

      if (paymentMethod === "native") {
        // Purchase with native AVAX
        await purchaseTx.write({
          address: classAddress,
          abi: [
            {
              name: "purchaseTicket",
              type: "function",
              stateMutability: "payable",
              inputs: [],
              outputs: [{ name: "tokenId", type: "uint256" }],
            },
          ],
          functionName: "purchaseTicket",
          value: amount,
        });
      } else {
        // Purchase with stablecoin
        await purchaseTx.write({
          address: classAddress,
          abi: [
            {
              name: "purchaseTicketStable",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [{ name: "amount", type: "uint256" }],
              outputs: [{ name: "tokenId", type: "uint256" }],
            },
          ],
          functionName: "purchaseTicketStable",
          args: [amount],
        });
      }
    },
    [address, checkBalance, purchaseTx]
  );

  /**
   * Get payment method display name
   */
  const getPaymentMethodName = useCallback((method: PaymentMethod): string => {
    if (method === "native") return "AVAX";
    if (method === "usdc") return "USDC";
    if (method === "usdt") return "USDT";
    return "Unknown";
  }, []);

  return {
    // Actions
    approvePayment,
    purchaseTicket,
    checkBalance,
    getTokenAddress,
    getPaymentMethodName,

    // State
    isApproving,
    isPurchasing: purchaseTx.isPending,
    isSuccess: purchaseTx.isSuccess,
    hash: purchaseTx.hash,
    error: approveTx.error || purchaseTx.error,

    // Config
    defaultMethod: PAYMENT_CONFIG.defaultMethod,
  };
}
