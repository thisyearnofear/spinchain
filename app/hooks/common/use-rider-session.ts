"use client";

import { useReadContract, useAccount } from "wagmi";
import { SPIN_CLASS_ABI, INCENTIVE_ENGINE_ABI, INCENTIVE_ENGINE_ADDRESS } from "../../lib/contracts";
import { parseEther } from "viem";
import { useTransaction } from "@/app/hooks/evm/use-transaction";
import { CONTRACT_ERROR_CONTEXT } from "../../lib/errors";

// Ticket purchase hook
export function usePurchaseTicket(classAddress: `0x${string}`) {
  const { address: userAddress } = useAccount();
  
  const { data: attended } = useReadContract({
    address: classAddress,
    abi: SPIN_CLASS_ABI,
    functionName: "attended",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress && !!classAddress },
  });

  const { write: purchaseTicket, ...state } = useTransaction({
    successMessage: 'Ticket Purchased! 🎫',
    pendingMessage: 'Purchasing Ticket...',
    errorContext: CONTRACT_ERROR_CONTEXT.purchaseTicket,
  });

  const purchase = (price: string) => {
    purchaseTicket({
      address: classAddress,
      abi: SPIN_CLASS_ABI,
      functionName: "purchaseTicket",
      value: parseEther(price),
    });
  };

  return { purchaseTicket: purchase, attended, ...state };
}

// Check-in hook
export function useCheckIn(classAddress: `0x${string}`) {
  const { write: checkIn, ...state } = useTransaction({
    successMessage: 'Checked In! ✅',
    pendingMessage: 'Checking In...',
  });

  const checkInToken = (tokenId: number) => {
    checkIn({
      address: classAddress,
      abi: SPIN_CLASS_ABI,
      functionName: "checkIn",
      args: [BigInt(tokenId)],
    });
  };

  return { checkIn: checkInToken, ...state };
}

// Rewards claim hook
export function useClaimRewards() {
  const { write: claimReward, ...state } = useTransaction({
    successMessage: 'Rewards Claimed! 🎉',
    pendingMessage: 'Claiming Rewards...',
    errorContext: CONTRACT_ERROR_CONTEXT.claimReward,
  });

  const claim = (params: {
    spinClass: `0x${string}`;
    rider: `0x${string}`;
    rewardAmount: string;
    classId: `0x${string}`;
    claimHash: `0x${string}`;
    timestamp: number;
    signature: `0x${string}`;
  }) => {
    claimReward({
      address: INCENTIVE_ENGINE_ADDRESS as `0x${string}`,
      abi: INCENTIVE_ENGINE_ABI,
      functionName: "submitAttestation",
      args: [
        params.spinClass,
        params.rider,
        parseEther(params.rewardAmount),
        params.classId,
        params.claimHash,
        BigInt(params.timestamp),
        params.signature,
      ],
    });
  };

  return { claimReward: claim, ...state };
}
