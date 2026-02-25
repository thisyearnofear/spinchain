"use client";

import { useTransaction } from "./use-transaction";
import { CLASS_FACTORY_ADDRESS, CLASS_FACTORY_ABI } from "@/app/lib/contracts";
import { parseEther } from "viem";
import { CONTRACT_ERROR_CONTEXT } from "@/app/lib/errors";
import type { EnhancedClassMetadata } from "@/app/lib/contracts";

interface CreateClassParams {
  name: string;
  symbol: string;
  metadata: string | EnhancedClassMetadata;
  startTime: number;
  endTime: number;
  maxRiders: number;
  basePrice: string;
  maxPrice: string;
  instructor: `0x${string}`; // Human or AI agent wallet
  treasury: `0x${string}`;
  incentiveEngine: `0x${string}`;
  spinToken: `0x${string}`;
  paymentToken?: `0x${string}`; // USDC/USDT address (optional, defaults to native AVAX)
  instructorShareBps?: number; // 7000-9000 (70-90%), defaults to 8000
}

export function useCreateClass() {
  const { write, ...state } = useTransaction({
    successMessage: 'Class Created! 🎉',
    pendingMessage: 'Creating Class...',
    errorContext: CONTRACT_ERROR_CONTEXT.createClass,
  });

  const createClass = (params: CreateClassParams) => {
    // Convert metadata to JSON string if it's an object
    const metadataString = typeof params.metadata === 'string' 
      ? params.metadata 
      : JSON.stringify(params.metadata);

    // Default values
    const paymentToken = params.paymentToken || "0x0000000000000000000000000000000000000000";
    const instructorShareBps = params.instructorShareBps || 8000; // 80% default

    // Convert prices based on payment method
    const isStablecoin = paymentToken !== "0x0000000000000000000000000000000000000000";
    const basePrice = isStablecoin 
      ? BigInt(Math.floor(parseFloat(params.basePrice) * 1e6)) // USDC has 6 decimals
      : parseEther(params.basePrice); // AVAX has 18 decimals
    const maxPrice = isStablecoin
      ? BigInt(Math.floor(parseFloat(params.maxPrice) * 1e6))
      : parseEther(params.maxPrice);

    write({
      address: CLASS_FACTORY_ADDRESS as `0x${string}`,
      abi: CLASS_FACTORY_ABI,
      functionName: "createClass",
      args: [
        params.name,
        params.symbol,
        metadataString,
        BigInt(params.startTime),
        BigInt(params.endTime),
        BigInt(params.maxRiders),
        basePrice,
        maxPrice,
        params.instructor,
        params.treasury,
        params.incentiveEngine,
        params.spinToken,
        paymentToken as `0x${string}`,
        instructorShareBps,
      ],
    });
  };

  return { createClass, ...state };
}
