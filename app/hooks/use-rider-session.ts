"use client";

import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from "wagmi";
import { SPIN_CLASS_ABI, INCENTIVE_ENGINE_ABI, INCENTIVE_ENGINE_ADDRESS } from "../lib/contracts";
import { parseEther } from "viem";
import { useEffect } from "react";
import { useToastHelpers } from "../components/toast";

export function useRiderSession(classAddress: `0x${string}`) {
    const toast = useToastHelpers();
    const { address: userAddress } = useAccount();
    const { writeContract, data: hash, isPending, isError, error } = useWriteContract();

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

    // Handle error notifications
    useEffect(() => {
        if (isError && error) {
            const errorMessage = error.message.toLowerCase();
            
            if (errorMessage.includes('user rejected')) {
                toast.error('Purchase Cancelled', 'You declined the transaction.');
            } else if (errorMessage.includes('insufficient funds')) {
                toast.error('Insufficient AVAX', 'You need more AVAX to purchase this ticket.');
            } else if (errorMessage.includes('sale not active')) {
                toast.error('Sale Not Active', 'Ticket sales haven\'t started yet for this class.');
            } else if (errorMessage.includes('sold out')) {
                toast.error('Sold Out', 'This class is fully booked.');
            } else {
                toast.error('Purchase Failed', error.message);
            }
        }
    }, [isError, error, toast]);

    // Handle success
    useEffect(() => {
        if (isSuccess && hash) {
            toast.success(
                'Ticket Purchased! 🎫',
                'You\'re all set for the class. See you there!',
                {
                    action: {
                        label: 'View',
                        onClick: () => window.open(`https://testnet.snowtrace.io/tx/${hash}`, '_blank'),
                    },
                }
            );
        }
    }, [isSuccess, hash, toast]);

    const purchaseTicket = (price: string) => {
        toast.loading('Purchasing Ticket...', 'Confirm the transaction in your wallet');
        
        writeContract({
            address: classAddress,
            abi: SPIN_CLASS_ABI,
            functionName: "purchaseTicket",
            value: parseEther(price),
        });
    };

    const checkIn = (tokenId: number) => {
        toast.loading('Checking In...', 'Confirm the check-in transaction');
        
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
    const toast = useToastHelpers();
    const { writeContract, data: hash, isPending, error, isError } = useWriteContract();
    const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    // Handle errors
    useEffect(() => {
        if (isError && error) {
            const errorMessage = error.message.toLowerCase();
            
            if (errorMessage.includes('user rejected')) {
                toast.error('Claim Cancelled', 'You declined the reward claim.');
            } else if (errorMessage.includes('already claimed')) {
                toast.warning('Already Claimed', 'You\'ve already claimed rewards for this class.');
            } else if (errorMessage.includes('invalid proof')) {
                toast.error('Invalid Proof', 'Your effort proof couldn\'t be verified.');
            } else {
                toast.error('Claim Failed', error.message);
            }
        }
    }, [isError, error, toast]);

    // Handle success
    useEffect(() => {
        if (isSuccess && hash) {
            toast.success(
                'Rewards Claimed! 🎉',
                'Your SPIN tokens have been sent to your wallet.',
                {
                    action: {
                        label: 'View',
                        onClick: () => window.open(`https://testnet.snowtrace.io/tx/${hash}`, '_blank'),
                    },
                }
            );
        }
    }, [isSuccess, hash, toast]);

    const claimReward = (params: {
        spinClass: `0x${string}`;
        rider: `0x${string}`;
        rewardAmount: string;
        classId: `0x${string}`;
        claimHash: `0x${string}`;
        timestamp: number;
        signature: `0x${string}`;
    }) => {
        toast.loading('Claiming Rewards...', 'Submitting your effort proof on-chain');
        
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
