"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isPersonalDataPublicationAllowed } from "@/app/lib/privacy/publication-policy";

/**
 * Granular rider consent. Each scope is independent and defaults to off;
 * a grant only counts for the current policy version.
 *
 * - cloud_history:   mirror ride summaries to the SpinChain database
 * - ai_voice:        send ride context / coach text to third-party AI + voice
 * - instructor_live: push live telemetry to the class instructor view
 * - public_export:   publish personal data publicly (also gated globally)
 */
export const CONSENT_SCOPES = [
  "cloud_history",
  "ai_voice",
  "instructor_live",
  "public_export",
] as const;

export type ConsentScope = (typeof CONSENT_SCOPES)[number];

export const CONSENT_POLICY_VERSION = "consent-v1";
export const CONSENT_STORAGE_KEY = "spinchain:consent:v1";
export const CONSENT_CHANGED_EVENT = "spinchain:consent-changed";

export interface ConsentRecord {
  granted: boolean;
  policyVersion: string;
  /** 0 = never answered. */
  updatedAt: number;
}

export type ConsentState = Record<ConsentScope, ConsentRecord>;

export function isConsentScope(value: unknown): value is ConsentScope {
  return typeof value === "string" && (CONSENT_SCOPES as readonly string[]).includes(value);
}

/** Thrown by third-party AI/voice clients when ai_voice consent is absent. */
export class ConsentRequiredError extends Error {
  constructor(public readonly scope: ConsentScope) {
    super(`Consent required: ${scope}`);
    this.name = "ConsentRequiredError";
  }
}

function defaultRecord(): ConsentRecord {
  return { granted: false, policyVersion: CONSENT_POLICY_VERSION, updatedAt: 0 };
}

function defaultState(): ConsentState {
  return Object.fromEntries(CONSENT_SCOPES.map((s) => [s, defaultRecord()])) as ConsentState;
}

function parseRecord(raw: unknown): ConsentRecord {
  if (!raw || typeof raw !== "object") return defaultRecord();
  const r = raw as Partial<ConsentRecord>;
  return {
    granted: r.granted === true,
    policyVersion: typeof r.policyVersion === "string" ? r.policyVersion : CONSENT_POLICY_VERSION,
    updatedAt: typeof r.updatedAt === "number" && Number.isFinite(r.updatedAt) ? r.updatedAt : 0,
  };
}

export function getConsentState(): ConsentState {
  const state = defaultState();
  if (typeof window === "undefined") return state;
  try {
    const raw = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) ?? "{}");
    for (const scope of CONSENT_SCOPES) state[scope] = parseRecord(raw?.[scope]);
  } catch {
    // Corrupt storage reads as "nothing granted".
  }
  return state;
}

export function hasConsent(scope: ConsentScope): boolean {
  if (scope === "public_export" && !isPersonalDataPublicationAllowed()) return false;
  const record = getConsentState()[scope];
  return record.granted && record.policyVersion === CONSENT_POLICY_VERSION;
}

/** True once the rider has answered for this scope under the current policy. */
export function hasAnsweredConsent(scope: ConsentScope): boolean {
  const record = getConsentState()[scope];
  return record.updatedAt > 0 && record.policyVersion === CONSENT_POLICY_VERSION;
}

/**
 * Records a decision locally, mirrors it to the server when signed in
 * (best-effort; the server rejects consent-gated writes until it has the
 * grant), then notifies subscribers so dependent work runs after the server
 * knows about it.
 */
export async function setConsent(scope: ConsentScope, granted: boolean): Promise<void> {
  if (typeof window === "undefined") return;
  const state = getConsentState();
  state[scope] = { granted, policyVersion: CONSENT_POLICY_VERSION, updatedAt: Date.now() };
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
  try {
    await fetch("/api/consent", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, granted, policyVersion: CONSENT_POLICY_VERSION }),
    });
  } catch {
    // Signed-out or offline: local decision still applies to client gates.
  } finally {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: { scope, granted } }));
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONSENT_STORAGE_KEY) onChange();
  };
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reactive consent flag plus a setter. Renders as "not granted" on the server. */
export function useConsent(scope: ConsentScope): [boolean, (granted: boolean) => Promise<void>] {
  const granted = useSyncExternalStore(subscribe, () => hasConsent(scope), () => false);
  const set = useCallback((g: boolean) => setConsent(scope, g), [scope]);
  return [granted, set];
}

/** Reactive "has the rider answered" flag, for one-time prompts. */
export function useConsentAnswered(scope: ConsentScope): boolean {
  return useSyncExternalStore(subscribe, () => hasAnsweredConsent(scope), () => true);
}
