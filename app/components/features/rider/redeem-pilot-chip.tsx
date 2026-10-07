"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useTransaction } from "@/app/hooks/evm/use-transaction";
import {
  ACHIEVEMENT_REDEEMER_V2_ABI,
  PILOT_MIN_RIDE_SEC,
  deriveRideSessionId,
  isPilotRedeemEnabled,
  pilotRedeemerAddress,
  rideNullifier,
  type SignedRedeemPayload,
} from "@/app/lib/rewards/pilot-redeemer";
import {
  getRedemption,
  saveRedemption,
  type RedemptionRecord,
} from "@/app/lib/rewards/redemption-store";

/**
 * Phase-5 testnet pilot: sign + redeem an issuer-approved ride receipt on
 * Fuji. Rendered only when the pilot flag and a Fuji network config are on.
 * Three honest states: redeemable → redeeming → "redemption confirmed".
 * A ride the server can't see (no cloud_history sync) gets an explicit error,
 * not a dead button.
 */
export function RedeemPilotChip({
  rideId,
  durationSec,
}: {
  rideId: string;
  durationSec: number;
}) {
  const { address } = useAccount();
  const [record, setRecord] = useState<RedemptionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    setRecord(getRedemption(rideId));
  }, [rideId]);

  const tx = useTransaction({
    pendingMessage: "Redeeming testnet achievement…",
    successMessage: "Redemption confirmed (testnet)",
    onSuccess: (hash) => {
      const rec: RedemptionRecord = {
        rideId,
        nullifier: rideNullifier(deriveRideSessionId(rideId)),
        txHash: hash,
        confirmedAt: Date.now(),
      };
      saveRedemption(rec);
      setRecord(rec);
    },
    onError: (e) => setError(e.message),
  });

  if (!isPilotRedeemEnabled()) return null;
  if (record) {
    return (
      <a
        href={`https://testnet.snowtrace.io/tx/${record.txHash}`}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-200"
      >
        Redemption confirmed ✓
      </a>
    );
  }
  if (!address || durationSec < PILOT_MIN_RIDE_SEC) return null;

  const redeem = async () => {
    const contract = pilotRedeemerAddress();
    if (!contract) {
      setError("Redeemer address not configured");
      return;
    }
    setSigning(true);
    setError(null);
    try {
      const res = await fetch("/api/redeem/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rideId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Issuer declined to sign");
        return;
      }
      const payload = data as SignedRedeemPayload;
      tx.write({
        address: contract,
        abi: ACHIEVEMENT_REDEEMER_V2_ABI,
        functionName: "redeem",
        args: [
          {
            ...payload.receipt,
            amount: BigInt(payload.receipt.amount),
            issuedAt: BigInt(payload.receipt.issuedAt),
            expiresAt: BigInt(payload.receipt.expiresAt),
          },
          payload.issuer,
          payload.signature,
        ],
      });
    } catch {
      setError("Could not reach the signing service");
    } finally {
      setSigning(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={redeem}
        disabled={signing || tx.isPending}
        className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20 disabled:opacity-50"
      >
        {signing || tx.isPending ? "Redeeming…" : "Redeem testnet pilot"}
      </button>
      {error ? (
        <span className="text-[11px] text-red-300/80">{error}</span>
      ) : null}
    </span>
  );
}
