import type { SupabaseClient } from "@supabase/supabase-js";
import { isPersonalDataPublicationAllowed } from "@/app/lib/privacy/publication-policy";

// Mirrors the client-side scopes; kept separate so server routes never
// import the "use client" module.
export const SERVER_CONSENT_SCOPES = [
  "cloud_history",
  "ai_voice",
  "instructor_live",
  "public_export",
] as const;
export type ServerConsentScope = (typeof SERVER_CONSENT_SCOPES)[number];
export const SERVER_CONSENT_POLICY_VERSION = "consent-v1";

export function isServerConsentScope(value: unknown): value is ServerConsentScope {
  return typeof value === "string" && (SERVER_CONSENT_SCOPES as readonly string[]).includes(value);
}

/** Server-side re-check: absent, revoked, stale-policy, or unreadable rows all deny. */
export async function hasServerConsent(
  client: SupabaseClient,
  address: string,
  scope: ServerConsentScope,
): Promise<boolean> {
  if (scope === "public_export" && !isPersonalDataPublicationAllowed()) return false;
  const { data, error } = await client
    .from("rider_consents")
    .select("granted, policy_version")
    .eq("address", address)
    .eq("scope", scope)
    .maybeSingle();
  if (error || !data) return false;
  return data.granted === true && data.policy_version === SERVER_CONSENT_POLICY_VERSION;
}
