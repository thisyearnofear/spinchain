/**
 * Enhanced Class Creation Hook with Route Integration
 * Handles the complete flow: Route → Walrus → Contract → Sui Session
 */

"use client";

import { useState } from "react";
import { useCreateClass } from "./use-create-class";
import { useAccount } from "wagmi";
import type { SavedRoute } from "../lib/route-library";
import type { GeneratedRoute } from "../lib/ai-service";
import { uploadRouteToWalrus, recordDeployment } from "../lib/route-storage";
import { createClassMetadata } from "../lib/contracts-extended";
import { INCENTIVE_ENGINE_ADDRESS } from "../lib/contracts";

interface CreateClassWithRouteParams {
  // Basic class info
  name: string;
  symbol: string;
  description: string;
  startTime: number;
  endTime: number;
  maxRiders: number;
  
  // Economics
  basePrice: string;
  maxPrice: string;
  curveType: string;
  rewardThreshold: number;
  rewardAmount: number;
  
  // Route
  route: SavedRoute | GeneratedRoute;
  routeId?: string; // For library routes
  
  // AI
  aiEnabled: boolean;
  aiPersonality: "zen" | "drill-sergeant" | "data";
}

type DeploymentStep = 
  | "idle"
  | "uploading-route"
  | "creating-metadata"
  | "deploying-contract"
  | "recording-deployment"
  | "complete"
  | "error";

export function useClassWithRoute() {
  const { address } = useAccount();
  const { createClass, isPending, isSuccess, error: contractError, hash } = useCreateClass();
  
  const [deploymentStep, setDeploymentStep] = useState<DeploymentStep>("idle");
  const [walrusBlobId, setWalrusBlobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deployClassWithRoute = async (params: CreateClassWithRouteParams) => {
    if (!address) {
      setError("Wallet not connected");
      return;
    }

    try {
      setDeploymentStep("uploading-route");
      setError(null);

      // Step 1: Upload route to Walrus
      console.log("📤 Uploading route to Walrus...");
      const uploadResult = await uploadRouteToWalrus(params.route, {
        classId: `pending-${Date.now()}`, // Temporary ID
        instructor: address,
      });

      if (!uploadResult.success || !uploadResult.blobId) {
        throw new Error(uploadResult.error || "Failed to upload route to Walrus");
      }

      setWalrusBlobId(uploadResult.blobId);
      console.log("✓ Route uploaded:", uploadResult.blobId);

      // Step 2: Create enhanced metadata
      setDeploymentStep("creating-metadata");
      console.log("📝 Creating class metadata...");

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
        route: params.route,
        walrusBlobId: uploadResult.blobId,
        aiEnabled: params.aiEnabled,
        aiPersonality: params.aiPersonality,
      });

      console.log("✓ Metadata created with route reference");

      // Step 3: Deploy contract
      setDeploymentStep("deploying-contract");
      console.log("⛓️ Deploying SpinClass contract...");

      createClass({
        name: params.name,
        symbol: params.symbol,
        metadata: metadata,
        startTime: params.startTime,
        endTime: params.endTime,
        maxRiders: params.maxRiders,
        basePrice: params.basePrice,
        maxPrice: params.maxPrice,
        treasury: address,
        incentiveEngine: INCENTIVE_ENGINE_ADDRESS as `0x${string}`,
      });

      // Note: Contract deployment will be handled by useCreateClass
      // We'll record deployment in a useEffect watching for success

    } catch (err) {
      console.error("❌ Deployment failed:", err);
      setError(err instanceof Error ? err.message : "Deployment failed");
      setDeploymentStep("error");
    }
  };

  // Watch for contract deployment success
  // In a real implementation, we'd use useEffect to watch isSuccess
  // and then record the deployment with the actual contract address

  const recordDeploymentSuccess = (contractAddress: string, routeId?: string) => {
    if (!walrusBlobId || !routeId) return;

    setDeploymentStep("recording-deployment");
    console.log("📝 Recording deployment...");

    try {
      recordDeployment(routeId, {
        walrusBlobId,
        classId: contractAddress,
        chainId: 43113, // Avalanche Fuji
        instructor: address!,
        deployedAt: new Date().toISOString(),
        checksum: "", // Would calculate from route
      });

      setDeploymentStep("complete");
      console.log("✅ Deployment complete!");
    } catch (err) {
      console.error("Failed to record deployment:", err);
    }
  };

  return {
    deployClassWithRoute,
    deploymentStep,
    walrusBlobId,
    isPending: isPending || deploymentStep !== "idle",
    isSuccess: isSuccess && deploymentStep === "complete",
    error: error || (contractError?.message),
    hash,
  };
}

// Helper to get step display text
export function getDeploymentStepText(step: DeploymentStep): string {
  const steps: Record<DeploymentStep, string> = {
    idle: "Ready to deploy",
    "uploading-route": "Uploading route to Walrus...",
    "creating-metadata": "Creating class metadata...",
    "deploying-contract": "Deploying contract to Avalanche...",
    "recording-deployment": "Recording deployment...",
    complete: "Deployment complete!",
    error: "Deployment failed",
  };
  return steps[step];
}
