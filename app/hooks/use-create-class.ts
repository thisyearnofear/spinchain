"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CLASS_FACTORY_ADDRESS, CLASS_FACTORY_ABI } from "../lib/contracts";
import { parseEther } from "viem";

export function useCreateClass() {
    const { writeContract, data: hash, error, isPending } = useWriteContract();

    const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

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
