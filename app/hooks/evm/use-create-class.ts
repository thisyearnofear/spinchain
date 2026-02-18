"use client";

import { useTransaction } from "./use-transaction";
import { CLASS_FACTORY_ADDRESS, CLASS_FACTORY_ABI } from "@/app/lib/contracts";
import { parseEther } from "viem";
import { CONTRACT_ERROR_CONTEXT } from "@/app/lib/errors";
import type { EnhancedClassMetadata } from "@/app/lib/contracts";

interface CreateClassParams {
  name: string;
  symbol: string;
  metadata: string | EnhancedClassMetadata;  // Now accepts structured metadata
  startTime: number;
  endTime: number;
  maxRiders: number;
  basePrice: string;
  maxPrice: string;
  treasury: `0x${string}`;
  incentiveEngine: `0x${string}`;
  spinToken: `0x${string}`; // Required for tier discount calculations in SpinClass
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
        parseEther(params.basePrice),
        parseEther(params.maxPrice),
        params.treasury,
        params.incentiveEngine,
        params.spinToken,       // 11th arg — required by ClassFactory.createClass
      ],
    });
  };

  return { createClass, ...state };
}
