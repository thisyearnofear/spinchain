"use client";

import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState, useCallback } from "react";
import { SUI_CONFIG } from "@/app/config";
import { useSuiTransaction } from "./use-sui-transaction";

const MODULE_NAME = "spinsession";

export interface TelemetryUpdate {
    hr: number;
    power: number;
    cadence: number;
    timestamp: number;
}

export interface StoryBeat {
    label: string;
    beatType: string;
    intensity: number;
}

/**
 * Hook for managing Sui telemetry updates and story beats
 * Follows DRY principle: Uses shared transaction handling from use-sui-transaction
 */
export function useSuiTelemetry(sessionId: string | null, statsObjectId: string | null) {
    const suiClient = useSuiClient();
    const account = useCurrentAccount();
    const { execute, isPending: isUpdating, error } = useSuiTransaction({
        successMessage: "Telemetry updated",
        pendingMessage: "Submitting telemetry...",
    });
    const [lastUpdate, setLastUpdate] = useState<TelemetryUpdate | null>(null);

    /**
     * Update rider telemetry on Sui
     * Requires both sessionId and statsObjectId
     */
    const updateTelemetry = useCallback(async (
        hr: number,
        power: number,
        cadence: number
    ): Promise<boolean> => {
        if (!sessionId || !statsObjectId) {
            console.warn("[SuiTelemetry] Missing sessionId or statsObjectId");
            return false;
        }

        if (!account) {
            console.warn("[SuiTelemetry] Wallet not connected");
            return false;
        }

        const timestamp = Date.now();
        const update: TelemetryUpdate = { hr, power, cadence, timestamp };

        const tx = new Transaction();
        tx.moveCall({
            target: `${SUI_CONFIG.packageId}::${MODULE_NAME}::update_telemetry`,
            arguments: [
                tx.object(sessionId),
                tx.object(statsObjectId),
                tx.pure.u32(hr),
                tx.pure.u32(power),
                tx.pure.u32(cadence),
                tx.pure.u64(timestamp),
            ],
        });

        const success = await execute(tx);
        if (success) {
            setLastUpdate(update);
        }
        return success;
    }, [sessionId, statsObjectId, account, execute]);

    /**
     * Trigger a story beat event on Sui
     */
    const triggerBeat = useCallback(async (
        label: string,
        beatType: string,
        intensity: number
    ): Promise<boolean> => {
        if (!sessionId) {
            console.warn("[SuiTelemetry] Missing sessionId");
            return false;
        }

        if (!account) {
            console.warn("[SuiTelemetry] Wallet not connected");
            return false;
        }

        const tx = new Transaction();
        tx.moveCall({
            target: `${SUI_CONFIG.packageId}::${MODULE_NAME}::trigger_beat`,
            arguments: [
                tx.object(sessionId),
                tx.pure.string(label),
                tx.pure.string(beatType),
                tx.pure.u8(Math.min(100, Math.max(0, intensity))),
            ],
        });

        return await execute(tx);
    }, [sessionId, account, execute]);

    return {
        updateTelemetry,
        triggerBeat,
        isUpdating,
        error,
        lastUpdate,
        isConnected: !!account && !!sessionId && !!statsObjectId,
    };
}
