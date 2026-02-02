"use client";

import { useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";

const PACKAGE_ID = "0x..."; // To be filled after deploy
const MODULE_NAME = "spinsession";

export function useSuiTelemetry(statsObjectId: string | null) {
    const suiClient = useSuiClient();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();
    const [isUpdating, setIsUpdating] = useState(false);

    const updateTelemetry = async (hr: number, power: number, cadence: number) => {
        if (!statsObjectId || isUpdating) return;

        try {
            setIsUpdating(true);
            const tx = new Transaction();
            tx.moveCall({
                target: `${PACKAGE_ID}::${MODULE_NAME}::update_telemetry`,
                arguments: [
                    tx.object(statsObjectId),
                    tx.pure.u32(hr),
                    tx.pure.u32(power),
                    tx.pure.u32(cadence),
                    tx.pure.u64(Date.now()),
                ],
            });

            signAndExecute({
                transaction: tx as any,
            }, {
                onSuccess: () => {
                    setIsUpdating(false);
                },
                onError: () => {
                    setIsUpdating(false);
                }
            });
        } catch (err) {
            console.error("Telemetry update failed", err);
            setIsUpdating(false);
        }
    };

    const triggerBeat = async (sessionObjectId: string, label: string, beatType: string, intensity: number) => {
        try {
            const tx = new Transaction();
            tx.moveCall({
                target: `${PACKAGE_ID}::${MODULE_NAME}::trigger_beat`,
                arguments: [
                    tx.object(sessionObjectId),
                    tx.pure.string(label),
                    tx.pure.string(beatType),
                    tx.pure.u8(intensity),
                ],
            });

            signAndExecute({
                transaction: tx as any,
            });
        } catch (err) {
            console.error("Trigger beat failed", err);
        }
    };

    return { updateTelemetry, triggerBeat, isUpdating };
}
