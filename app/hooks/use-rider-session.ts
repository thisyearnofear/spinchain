"use client";

import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from "wagmi";
import { SPIN_CLASS_ABI, INCENTIVE_ENGINE_ABI, INCENTIVE_ENGINE_ADDRESS } from "../lib/contracts";
import { parseEther } from "viem";

export function useRiderSession(classAddress: `0x${string}`) {
    const { address: userAddress } = useAccount();
    const { writeContract, data: hash, isPending } = useWriteContract();

    const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    // Check if attended
    const { data: attended } = useReadContract({
        address: classAddress,
        abi: SPIN_CLASS_ABI,
        functionName: "attended",
        args: userAddress ? [userAddress] : undefined,
        query: {
            enabled: !!userAddress && !!classAddress,
        }
    });

    const purchaseTicket = (price: string) => {
        writeContract({
            address: classAddress,
            abi: SPIN_CLASS_ABI,
            functionName: "purchaseTicket",
            value: parseEther(price),
        });
    };

    const checkIn = (tokenId: number) => {
        writeContract({
            address: classAddress,
            abi: SPIN_CLASS_ABI,
            functionName: "checkIn",
            args: [BigInt(tokenId)],
        });
    };

    return {
        purchaseTicket,
        checkIn,
        attended,
        isPending: isPending || isWaiting,
        isSuccess,
        hash,
    };
}

export function useClaimRewards() {
    const { writeContract, data: hash, isPending, error } = useWriteContract();
    const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    const claimReward = (params: {
        spinClass: `0x${string}`;
        rider: `0x${string}`;
        rewardAmount: string;
        classId: `0x${string}`;
        claimHash: `0x${string}`;
        timestamp: number;
        signature: `0x${string}`;
    }) => {
        writeContract({
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

    return {
        claimReward,
        isPending: isPending || isWaiting,
        isSuccess,
        hash,
        error,
    };
}
