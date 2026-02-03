"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CLASS_FACTORY_ADDRESS, CLASS_FACTORY_ABI } from "../lib/contracts";
import { parseEther } from "viem";
import { useEffect } from "react";
import { useToastHelpers } from "../components/toast";

export function useCreateClass() {
    const toast = useToastHelpers();
    const { writeContract, data: hash, error, isPending, isError } = useWriteContract();

    const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    // Handle error notifications
    useEffect(() => {
        if (isError && error) {
            const errorMessage = error.message.toLowerCase();
            
            // User rejected
            if (errorMessage.includes('user rejected') || errorMessage.includes('rejected the request')) {
                toast.error(
                    'Transaction Cancelled',
                    'You declined the transaction in your wallet.'
                );
            }
            // Insufficient funds
            else if (errorMessage.includes('insufficient funds')) {
                toast.error(
                    'Insufficient Funds',
                    'You don\'t have enough AVAX to cover the gas fees for this transaction.'
                );
            }
            // Gas estimation failed
            else if (errorMessage.includes('gas') || errorMessage.includes('estimate')) {
                toast.error(
                    'Gas Estimation Failed',
                    'The transaction may fail or the contract may be paused. Please try again.'
                );
            }
            // Generic error
            else {
                toast.error(
                    'Transaction Failed',
                    error.message || 'Something went wrong. Please try again.'
                );
            }
        }
    }, [isError, error, toast]);

    // Handle success notification
    useEffect(() => {
        if (isSuccess && hash) {
            toast.success(
                'Class Created! 🎉',
                'Your spin class contract has been deployed successfully.',
                {
                    action: {
                        label: 'View Transaction',
                        onClick: () => {
                            window.open(`https://testnet.snowtrace.io/tx/${hash}`, '_blank');
                        },
                    },
                }
            );
        }
    }, [isSuccess, hash, toast]);

    const createClass = (params: {
        name: string;
        symbol: string;
        metadata: string;
        startTime: number;
        endTime: number;
        maxRiders: number;
        basePrice: string;
        maxPrice: string;
        treasury: `0x${string}`;
        incentiveEngine: `0x${string}`;
    }) => {
        // Show pending toast
        toast.loading(
            'Creating Class...',
            'Please confirm the transaction in your wallet'
        );

        writeContract({
            address: CLASS_FACTORY_ADDRESS as `0x${string}`,
            abi: CLASS_FACTORY_ABI,
            functionName: "createClass",
            args: [
                params.name,
                params.symbol,
                params.metadata,
                BigInt(params.startTime),
                BigInt(params.endTime),
                BigInt(params.maxRiders),
                parseEther(params.basePrice),
                parseEther(params.maxPrice),
                params.treasury,
                params.incentiveEngine,
            ],
        });
    };

    return {
        createClass,
        hash,
        error,
        isPending: isPending || isWaiting,
        isSuccess,
    };
}
