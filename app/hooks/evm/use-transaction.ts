"use client";

// Single, reusable hook for ALL contract transactions
// DRY: Eliminates duplicate toast/error logic across all contract hooks

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useEffect, useCallback, useMemo, useRef } from "react";
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
  reset: () => void;
  hash?: `0x${string}`;
  isPending: boolean;
  isSuccess: boolean;
  error: Error | null;
}

export function useTransaction(options: UseTransactionOptions): UseTransactionReturn {
  const toast = useToast();

  // `options` is usually an inline object — pin latest values in refs.
  const optionsRef = useRef(options);
  const toastRef = useRef(toast);
  useEffect(() => {
    optionsRef.current = options;
    toastRef.current = toast;
  });

  const {
    writeContract,
    data: hash,
    error: writeError,
    isPending: isWritePending,
    isError: isWriteError,
    reset: resetWrite,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isWaiting,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  // Receipt-derived state only counts for the current hash.
  const receiptForCurrentHash =
    hash && (!receipt?.transactionHash || receipt.transactionHash === hash)
      ? receipt
      : undefined;
  const isSuccess = receiptForCurrentHash?.status === "success";
  const isReverted = receiptForCurrentHash?.status === "reverted";
  const revertedError = useMemo(
    () => new Error("Transaction reverted on-chain"),
    [],
  );
  const error =
    writeError ??
    (hash ? receiptError : null) ??
    (isReverted ? revertedError : null);

  // Notifications fire once per write attempt, keyed on the hash.
  const notifiedKeyRef = useRef<string | null>(null);

  const notifyError = useCallback((err: Error, key: string) => {
    if (notifiedKeyRef.current === key) return;
    notifiedKeyRef.current = key;
    const opts = optionsRef.current;
    const parsed = parseError(err);
    const override = opts.errorContext?.[parsed.category];
    toastRef.current.error(
      override?.title || parsed.title,
      override?.message || parsed.message,
    );
    opts.onError?.(err);
  }, []);

  // Handle error (wallet rejection, etc.)
  useEffect(() => {
    if (isWriteError && writeError) {
      notifyError(writeError, `write:${writeError.message}`);
    }
  }, [isWriteError, writeError, notifyError]);

  // Reverted receipts and receipt-fetch failures surface as errors too.
  useEffect(() => {
    if (isReverted && hash) {
      notifyError(revertedError, `reverted:${hash}`);
      return;
    }
    if (isReceiptError && receiptError && hash) {
      notifyError(receiptError, `receipt:${hash}`);
    }
  }, [isReverted, isReceiptError, receiptError, hash, revertedError, notifyError]);

  // Handle success
  useEffect(() => {
    if (isSuccess && hash && notifiedKeyRef.current !== `success:${hash}`) {
      notifiedKeyRef.current = `success:${hash}`;
      const opts = optionsRef.current;
      toastRef.current.success(
        opts.successMessage,
        undefined,
        {
          label: 'View',
          onClick: () => {
            const base = process.env.NEXT_PUBLIC_AVALANCHE_EXPLORER_URL || "https://testnet.snowtrace.io";
            window.open(`${base}/tx/${hash}`, "_blank", "noopener,noreferrer");
          },
        }
      );
      opts.onSuccess?.(hash);
    }
  }, [isSuccess, hash]);

  const write = useCallback((args: WriteContractArgs) => {
    notifiedKeyRef.current = null;
    toastRef.current.loading(optionsRef.current.pendingMessage, 'Confirm in your wallet');
    writeContract(args as Parameters<typeof writeContract>[0]);
  }, [writeContract]);

  const reset = useCallback(() => {
    // Invalidate notifications before wagmi clears the old hash.
    notifiedKeyRef.current = null;
    resetWrite();
  }, [resetWrite]);

  return {
    write,
    reset,
    hash,
    isPending: isWritePending || isWaiting,
    isSuccess,
    error,
  };
}
