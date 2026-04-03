/**
 * Enhanced Class Creation Hook with Route Integration
 * Handles the complete flow: Route → Walrus → Contract
 */

"use client";

import { useRef, useState } from "react";
import { useCreateClass } from "@/app/hooks/evm/use-create-class";
import { useAccount } from "wagmi";
import type { SavedRoute } from "@/app/lib/route-library";
import type { RouteResponse } from "@/app/lib/ai-service";
import { uploadRouteToWalrus } from "@/app/lib/route-storage";
import {
  createClassMetadata,
  INCENTIVE_ENGINE_ADDRESS,
  serializeClassMetadata,
  SPIN_TOKEN_ADDRESS,
} from "@/app/lib/contracts";

interface CreateClassWithRouteParams {
  name: string;
  symbol: string;
  description: string;
  startTime: number;
  endTime: number;
  maxRiders: number;
  basePrice: string;
  maxPrice: string;
  curveType: string;
  rewardThreshold: number;
  rewardAmount: number;
  route: SavedRoute | RouteResponse;
  routeTheme?: "neon" | "alpine" | "mars";
  aiEnabled: boolean;
  aiPersonality: "zen" | "drill-sergeant" | "data";
  avatarId?: string;
  equipmentId?: string;
  worldId?: string;
}

type DeploymentStep =
  | "idle"
  | "uploading-route"
  | "creating-metadata"
  | "deploying-contract"
  | "complete"
  | "error";

function toRouteResponse(route: SavedRoute | RouteResponse): RouteResponse {
  return route;
}

export function useClassWithRoute() {
  const { address } = useAccount();
  const pendingWalrusBlobIdRef = useRef<string | null>(null);
  const [deploymentStep, setDeploymentStep] = useState<DeploymentStep>("idle");
  const [walrusBlobId, setWalrusBlobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    createClass,
    isPending: isContractPending,
    isSuccess: isContractSuccess,
    error: contractError,
    hash,
  } = useCreateClass({
    onSuccess: () => {
      setDeploymentStep("complete");
      setWalrusBlobId(pendingWalrusBlobIdRef.current);
    },
    onError: () => {
      setDeploymentStep("error");
    },
  });

  const deployClassWithRoute = async (params: CreateClassWithRouteParams) => {
    if (!address) {
      setError("Wallet not connected");
      return;
    }

    try {
      setDeploymentStep("uploading-route");
      setError(null);

      const route = toRouteResponse(params.route);
      const uploadResult = await uploadRouteToWalrus(route, {
        classId: `pending-${Date.now()}`,
        instructor: address,
      });

      if (!uploadResult.success || !uploadResult.blobId) {
        throw new Error(uploadResult.error || "Failed to upload route to Walrus");
      }

      pendingWalrusBlobIdRef.current = uploadResult.blobId;
      setWalrusBlobId(uploadResult.blobId);

      setDeploymentStep("creating-metadata");

      const metadata = createClassMetadata({
        name: params.name,
        description: params.description,
        instructor: address,
        startTime: params.startTime,
        endTime: params.endTime,
        basePrice: params.basePrice,
        maxPrice: params.maxPrice,
        curveType: params.curveType,
        rewardThreshold: params.rewardThreshold,
        rewardAmount: params.rewardAmount,
        route,
        walrusBlobId: uploadResult.blobId,
        aiEnabled: params.aiEnabled,
        aiPersonality: params.aiPersonality,
        routeTheme: params.routeTheme,
        avatarId: params.avatarId,
        equipmentId: params.equipmentId,
        worldId: params.worldId,
      });

      setDeploymentStep("deploying-contract");

      createClass({
        name: params.name,
        symbol: params.symbol,
        metadata: serializeClassMetadata(metadata),
        startTime: params.startTime,
        endTime: params.endTime,
        maxRiders: params.maxRiders,
        basePrice: params.basePrice,
        maxPrice: params.maxPrice,
        instructor: address,
        treasury: address,
        incentiveEngine: INCENTIVE_ENGINE_ADDRESS as `0x${string}`,
        spinToken: SPIN_TOKEN_ADDRESS as `0x${string}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
      setDeploymentStep("error");
    }
  };

  return {
    deployClassWithRoute,
    deploymentStep,
    walrusBlobId,
    isPending: isContractPending || deploymentStep === "uploading-route" || deploymentStep === "creating-metadata",
    isSuccess: isContractSuccess && deploymentStep === "complete",
    error: error || contractError?.message || null,
    hash,
  };
}

export function getDeploymentStepText(step: DeploymentStep): string {
  const steps: Record<DeploymentStep, string> = {
    idle: "Ready to deploy",
    "uploading-route": "Uploading route to Walrus...",
    "creating-metadata": "Creating class metadata...",
    "deploying-contract": "Deploying contract to Avalanche...",
    complete: "Route uploaded and class deployed",
    error: "Deployment failed",
  };

  return steps[step];
}
