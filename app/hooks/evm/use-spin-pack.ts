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

  const createPack = useCallback(
    async (params: {
      tokenId: bigint;
      capacity: bigint;
      pricePerTicket: bigint;
      paymentToken: string;
      startTime: bigint;
    }) => {
      if (CONTRACT_ADDRESSES.SPIN_PACK === ZERO_ADDRESS) {
        throw new Error("SpinPack contract not deployed");
      }
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
    [write],
  );

  const purchaseTickets = useCallback(
    (tokenId: bigint, amount: bigint, value: bigint) => {
      if (CONTRACT_ADDRESSES.SPIN_PACK === ZERO_ADDRESS) {
        throw new Error("SpinPack contract not deployed");
      }
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
    [write],
  );

  const redeemTicket = useCallback(
    (tokenId: bigint) => {
      if (CONTRACT_ADDRESSES.SPIN_PACK === ZERO_ADDRESS) {
        throw new Error("SpinPack contract not deployed");
      }
      setIsRedeeming(true);
      write({
        address: CONTRACT_ADDRESSES.SPIN_PACK,
        abi: SPIN_PACK_ABI,
        functionName: "redeemTicket",
        args: [tokenId],
      });
      setIsRedeeming(false);
    },
    [write],
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
  };
}
