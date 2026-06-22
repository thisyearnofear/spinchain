"use client";

import { useCallback, useState } from "react";
import { useTransaction } from "@/app/hooks/evm/use-transaction";
import { CONTRACT_ADDRESSES, SPIN_PACK_ABI, ZERO_ADDRESS } from "@/app/lib/contracts";

export function useSpinPack() {
  const [isCreating, setIsCreating] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const { write, isPending, isSuccess, hash, error } = useTransaction({
    successMessage: "SpinPack transaction successful",
    pendingMessage: "Processing SpinPack transaction...",
  });

  const isDeployed = CONTRACT_ADDRESSES.SPIN_PACK !== ZERO_ADDRESS;

  const createPack = useCallback(
    async (params: {
      tokenId: bigint;
      capacity: bigint;
      pricePerTicket: bigint;
      paymentToken: string;
      startTime: bigint;
    }) => {
      if (!isDeployed) return;
      setIsCreating(true);
      write({
        address: CONTRACT_ADDRESSES.SPIN_PACK,
        abi: SPIN_PACK_ABI,
        functionName: "createPack",
        args: [
          params.tokenId,
          params.capacity,
          params.pricePerTicket,
          params.paymentToken,
          params.startTime,
        ],
      });
      setIsCreating(false);
    },
    [write, isDeployed],
  );

  const purchaseTickets = useCallback(
    (tokenId: bigint, amount: bigint, value: bigint) => {
      if (!isDeployed) return;
      setIsPurchasing(true);
      write({
        address: CONTRACT_ADDRESSES.SPIN_PACK,
        abi: SPIN_PACK_ABI,
        functionName: "purchaseTickets",
        args: [tokenId, amount],
        value,
      });
      setIsPurchasing(false);
    },
    [write, isDeployed],
  );

  const redeemTicket = useCallback(
    (tokenId: bigint) => {
      if (!isDeployed) return;
      setIsRedeeming(true);
      write({
        address: CONTRACT_ADDRESSES.SPIN_PACK,
        abi: SPIN_PACK_ABI,
        functionName: "redeemTicket",
        args: [tokenId],
      });
      setIsRedeeming(false);
    },
    [write, isDeployed],
  );

  return {
    createPack,
    purchaseTickets,
    redeemTicket,
    isCreating: isCreating || isPending,
    isPurchasing,
    isRedeeming,
    isSuccess,
    hash,
    error,
    isDeployed,
  };
}
