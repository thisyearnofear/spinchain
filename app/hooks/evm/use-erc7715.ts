"use client";

import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { type Address, type Hex } from "viem";
import { YELLOW_SETTLEMENT_ADDRESS } from "@/app/lib/contracts";

/**
 * ERC-7715 Permissions Hook
 * 
 * Enables instructors to grant "Session Permissions" to the app
 * for seamless, one-click settlement of Yellow rewards.
 */

export interface PermissionRequestParams {
  expiry?: number;
  label?: string;
}

export function useERC7715() {
  const { address } = useAccount();
  const [isRequesting, setIsRequesting] = useState(false);
  const [grantedPermission, setGrantedPermission] = useState<any>(null);

  const requestCoSignPermissions = useCallback(async (params: PermissionRequestParams = {}) => {
    if (!address || !window.ethereum) return null;

    setIsRequesting(true);
    try {
      const expiry = params.expiry || Math.floor(Date.now() / 1000) + 86400; // 24h default

      // ERC-7715: Request permissions for Yellow Settlement contract
      // This allows the app to perform specific actions on behalf of the instructor.
      const request = {
        permission: {
          signer: address,
          expiry,
          // Move isAdjustmentAllowed inside permission object per MetaMask v0.3.0+ spec
          isAdjustmentAllowed: false,
        },
        rules: [
          {
            type: "contract-call",
            data: {
              address: YELLOW_SETTLEMENT_ADDRESS,
              // Ideally we'd restrict to specific functions here
            },
          },
        ],
      };

      const response = await window.ethereum.request({
        method: "wallet_requestExecutionPermissions",
        params: [request],
      });

      setGrantedPermission(response);
      return response;
    } catch (error) {
      console.error("ERC-7715 permission request failed:", error);
      throw error;
    } finally {
      setIsRequesting(false);
    }
  }, [address]);

  return {
    requestCoSignPermissions,
    isRequesting,
    grantedPermission,
    isSupported: typeof window !== "undefined" && !!window.ethereum,
  };
}
