"use client";

import { getRideHistory, type RideSummary } from "@/app/lib/analytics/ride-history";
import { EVM_ADDRESS_RE, SUI_ADDRESS_RE } from "@/app/lib/auth/types";
import { hasConsent } from "@/app/lib/privacy/consent";
import { isSupabaseConfigured } from "@/app/lib/supabase/client";
import { saveRideToSupabase } from "@/app/hooks/common/use-supabase-sync";
import { drainOutbox, enqueueOutboxJob, type OutboxHandlers } from "@/app/lib/sync/outbox";

function isOwnedRider(riderId: string | undefined): boolean {
  const id = riderId?.toLowerCase();
  return !!id && (EVM_ADDRESS_RE.test(id) || SUI_ADDRESS_RE.test(id));
}

/** Queue a durable cloud-history upload. Guest rides never enter the outbox. */
export function enqueueCloudHistory(ride: RideSummary, opts: { revive?: boolean } = {}) {
  if (!isOwnedRider(ride.riderId)) return null;
  return enqueueOutboxJob(
    {
      kind: "cloud_history.upsert",
      idempotencyKey: ride.idempotencyKey,
      rideId: ride.id,
      requiredConsent: "cloud_history",
    },
    opts,
  );
}

export const OUTBOX_HANDLERS: OutboxHandlers = {
  "cloud_history.upsert": async (job) => {
    const ride = getRideHistory().find((r) => r.idempotencyKey === job.idempotencyKey || r.id === job.rideId);
    if (!ride || !isOwnedRider(ride.riderId) || !isSupabaseConfigured()) return "skip";
    if (!hasConsent("cloud_history")) return "held_consent";
    // Server upsert is idempotent on idempotency_key, so a retry after an
    // ambiguous failure cannot duplicate the ride.
    if (!(await saveRideToSupabase(ride))) {
      throw new Error("Cloud save failed (signed out, offline, or server error)");
    }
    return "done";
  },
};

export function drainCloudOutbox() {
  return drainOutbox(OUTBOX_HANDLERS);
}
