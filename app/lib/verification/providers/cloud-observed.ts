import {
  registerVerificationProvider,
  DEFAULT_PROVIDER_ID,
  type AttestationProvenance,
  type VerificationProvider,
} from "../provider";
import {
  deriveRideSessionId,
  deriveRideClassId,
} from "@/app/lib/rewards/pilot-redeemer";

const PROVENANCE_BY_SOURCE: Record<string, AttestationProvenance> = {
  "live-bike": "device-observed",
  simulator: "simulated",
  estimated: "estimated",
};

/**
 * The first provider: approves rides the server itself observed through
 * consented cloud-history sync (ride_summaries). It attests *existence and
 * recorded attributes* — not telemetry integrity.
 */
export const cloudObservedRideProvider: VerificationProvider = {
  id: DEFAULT_PROVIDER_ID,
  label: "SpinChain cloud history",
  trustStatement:
    "This ride exists in consented cloud history; its telemetry was not independently verified.",
  async verify({ riderAddress, rideId }, { db }) {
    const { data: ride, error } = await db
      .from("ride_summaries")
      .select("id, rider_address, class_id, elapsed_time, summary")
      .eq("id", rideId)
      .eq("rider_address", riderAddress)
      .maybeSingle();

    if (error) {
      return { status: "unavailable", reason: `ride lookup failed: ${error.message}` };
    }
    if (!ride) {
      return {
        status: "rejected",
        reason:
          "ride not found in cloud history — cloud_history sync must complete first",
      };
    }

    const summary = (ride.summary ?? {}) as { telemetrySource?: string };
    const provenance: AttestationProvenance =
      PROVENANCE_BY_SOURCE[summary.telemetrySource ?? ""] ?? "estimated";

    return {
      status: "verified",
      session: {
        sessionId: deriveRideSessionId(ride.id),
        classId: deriveRideClassId(ride.class_id),
        provenance,
        elapsedTimeSec: ride.elapsed_time ?? 0,
      },
    };
  },
};

registerVerificationProvider(cloudObservedRideProvider);
