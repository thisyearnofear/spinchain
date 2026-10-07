"use client";

import { useEffect } from "react";
import { CONSENT_CHANGED_EVENT, type ConsentScope } from "@/app/lib/privacy/consent";
import { applyConsentToOutbox } from "@/app/lib/sync/outbox";
import { drainCloudOutbox } from "@/app/lib/sync/cloud-history";

const DRAIN_INTERVAL_MS = 60_000;

/** App-root drainer: startup, reconnect, tab focus, consent change, slow tick. */
export function OutboxDrainer() {
  useEffect(() => {
    const drain = () => void drainCloudOutbox();
    const onVisible = () => {
      if (document.visibilityState === "visible") drain();
    };
    const onConsent = (e: Event) => {
      const detail = (e as CustomEvent<{ scope: ConsentScope; granted: boolean }>).detail;
      if (detail) applyConsentToOutbox(detail.scope, detail.granted);
      drain();
    };

    drain();
    window.addEventListener("online", drain);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsent);
    const id = setInterval(drain, DRAIN_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", drain);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(CONSENT_CHANGED_EVENT, onConsent);
      clearInterval(id);
    };
  }, []);
  return null;
}
