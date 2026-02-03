"use client";

import { useTransaction } from "./use-transaction";
import { CLASS_FACTORY_ADDRESS, CLASS_FACTORY_ABI } from "../lib/contracts";
import { parseEther } from "viem";
import { CONTRACT_ERROR_CONTEXT } from "../lib/errors";

interface CreateClassParams {
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
}

export function useCreateClass() {
  const { write, ...state } = useTransaction({
    successMessage: 'Class Created! 🎉',
    pendingMessage: 'Creating Class...',
    errorContext: CONTRACT_ERROR_CONTEXT.createClass,
  });

  const createClass = (params: CreateClassParams) => {
    write({
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

  return { createClass, ...state };
}
