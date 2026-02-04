"use client";

// Single, reusable hook for ALL Sui transactions
// DRY: Mirrors use-transaction pattern but for Sui Move calls
// CLEAN: Clear separation - EVM vs Sui transactions

import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { useEffect, useCallback, useState } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { useToast } from "../components/toast";
import { SUI_CONFIG } from "../config";

interface UseSuiTransactionOptions {
  successMessage?: string;
  pendingMessage?: string;
  errorMessage?: string;
  onSuccess?: (result: { digest: string; effects?: unknown }) => void;
  onError?: (error: Error) => void;
}

interface UseSuiTransactionReturn {
  execute: (tx: Transaction) => Promise<boolean>;
  isPending: boolean;
  isSuccess: boolean;
  error: Error | null;
  digest: string | null;
}

/**
 * Unified Sui transaction handler
 * Following Core Principles:
 * - DRY: Single toast/error handling for all Sui txs
 * - CLEAN: Separated from EVM transaction logic
 * - MODULAR: Can be used by any Sui-related hook
 */
export function useSuiTransaction(
  options: UseSuiTransactionOptions = {}
): UseSuiTransactionReturn {
  const toast = useToast();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending, data, error, reset } = useSignAndExecuteTransaction();
  
  const [digest, setDigest] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  // Reset state when data changes (new transaction)
  useEffect(() => {
    if (data) {
      setDigest(data.digest);
      setIsSuccess(true);
      
      toast.success(
        options.successMessage || "Transaction confirmed",
        undefined,
        {
          label: "View",
          onClick: () => {
            const explorerUrl = SUI_CONFIG.network === "testnet"
              ? `https://suiscan.xyz/testnet/tx/${data.digest}`
              : `https://suiscan.xyz/mainnet/tx/${data.digest}`;
            window.open(explorerUrl, "_blank");
          },
        }
      );
      
      options.onSuccess?.(data);
    }
  }, [data, options, toast]);

  // Handle errors
  useEffect(() => {
    if (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setLastError(err);
      setIsSuccess(false);
      
      const errorMsg = options.errorMessage || "Transaction failed";
      toast.error("Transaction Failed", err.message || errorMsg);
      
      options.onError?.(err);
    }
  }, [error, options, toast]);

  const execute = useCallback(async (tx: Transaction): Promise<boolean> => {
    // Reset previous state
    setDigest(null);
    setIsSuccess(false);
    setLastError(null);
    reset();

    try {
      toast.loading(
        options.pendingMessage || "Confirm in Sui wallet",
        "Waiting for signature..."
      );

      return new Promise((resolve) => {
        signAndExecute(
          // @ts-expect-error - Transaction version mismatch between @mysten/dapp-kit and @mysten/sui
          { transaction: tx as any },
          {
            onSuccess: () => resolve(true),
            onError: () => resolve(false),
          }
        );
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setLastError(error);
      toast.error("Transaction Error", error.message);
      options.onError?.(error);
      return false;
    }
  }, [signAndExecute, toast, options, reset]);

  return {
    execute,
    isPending,
    isSuccess,
    error: lastError,
    digest,
  };
}

export default useSuiTransaction;
