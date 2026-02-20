"use client";

// Single, reusable hook for ALL contract transactions
// DRY: Eliminates duplicate toast/error logic across all contract hooks

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useEffect, useCallback } from "react";
import { useToast } from "@/app/components/ui/toast";
import { parseError, type ErrorCategory } from "@/app/lib/errors";
import type { Abi, Address } from "viem";

// Type for write contract args
interface WriteContractArgs {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

interface UseTransactionOptions {
  successMessage: string;
  pendingMessage: string;
  errorContext?: Partial<Record<ErrorCategory, { title: string; message: string }>>;
  onSuccess?: (hash: `0x${string}`) => void;
  onError?: (error: Error) => void;
}

interface UseTransactionReturn {
  write: (args: WriteContractArgs) => void;
  hash?: `0x${string}`;
  isPending: boolean;
  isSuccess: boolean;
  error: Error | null;
}

export function useTransaction(options: UseTransactionOptions): UseTransactionReturn {
  const toast = useToast();
  
  const { 
    writeContract, 
    data: hash, 
    error, 
    isPending: isWritePending,
    isError 
  } = useWriteContract();
  
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Handle errors with centralized error mapping
  useEffect(() => {
    if (isError && error) {
      const parsed = parseError(error);
      
      // Check for context-specific override
      const override = options.errorContext?.[parsed.category];
      
      toast.error(
        override?.title || parsed.title,
        override?.message || parsed.message
      );
      
      options.onError?.(error);
    }
  }, [isError, error, options, toast]);

  // Handle success
  useEffect(() => {
    if (isSuccess && hash) {
      toast.success(
        options.successMessage,
        undefined,
        {
          label: 'View',
          onClick: () => {
            const base = process.env.NEXT_PUBLIC_AVALANCHE_EXPLORER_URL || "https://testnet.snowtrace.io";
            window.open(`${base}/tx/${hash}`, "_blank");
          },
        }
      );
      
      options.onSuccess?.(hash);
    }
  }, [isSuccess, hash, options, toast]);

  const write = useCallback((args: WriteContractArgs) => {
    toast.loading(options.pendingMessage, 'Confirm in your wallet');
    writeContract(args as Parameters<typeof writeContract>[0]);
  }, [writeContract, toast, options.pendingMessage]);

  return {
    write,
    hash,
    isPending: isWritePending || isWaiting,
    isSuccess,
    error,
  };
}
