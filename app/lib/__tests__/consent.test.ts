// @vitest-environment jsdom
// Granular consent: defaults off, per-scope, policy-versioned, client gates.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_POLICY_VERSION,
  CONSENT_SCOPES,
  CONSENT_STORAGE_KEY,
  ConsentRequiredError,
  getConsentState,
  hasAnsweredConsent,
  hasConsent,
  setConsent,
} from "@/app/lib/privacy/consent";
import { generateSpeech } from "@/app/lib/elevenlabs/client";

describe("client consent store", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
  });

  it("every scope defaults to off and unanswered", () => {
    for (const scope of CONSENT_SCOPES) {
      expect(hasConsent(scope)).toBe(false);
      expect(hasAnsweredConsent(scope)).toBe(false);
    }
  });

  it("scopes are independent", async () => {
    await setConsent("cloud_history", true);
    expect(hasConsent("cloud_history")).toBe(true);
    expect(hasConsent("ai_voice")).toBe(false);
    expect(hasConsent("instructor_live")).toBe(false);
  });

  it("a refusal counts as answered but not granted", async () => {
    await setConsent("ai_voice", false);
    expect(hasAnsweredConsent("ai_voice")).toBe(true);
    expect(hasConsent("ai_voice")).toBe(false);
  });

  it("mirrors the decision to /api/consent, then notifies", async () => {
    const order: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      order.push(`fetch:${String(input)}:${init?.method}`);
      return new Response("{}", { status: 200 });
    });
    window.addEventListener(CONSENT_CHANGED_EVENT, () => order.push("event"), { once: true });
    await setConsent("cloud_history", true);
    expect(order).toEqual(["fetch:/api/consent:PUT", "event"]);
  });

  it("still applies locally when the server is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await setConsent("cloud_history", true);
    expect(hasConsent("cloud_history")).toBe(true);
  });

  it("grants under an older policy version do not count", () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ cloud_history: { granted: true, policyVersion: "consent-v0", updatedAt: 1 } }),
    );
    expect(hasConsent("cloud_history")).toBe(false);
    expect(hasAnsweredConsent("cloud_history")).toBe(false);
  });

  it("corrupt storage reads as nothing granted", () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, "{not json");
    expect(getConsentState().cloud_history.granted).toBe(false);
  });

  it("public_export stays denied while publication is globally off", () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ public_export: { granted: true, policyVersion: CONSENT_POLICY_VERSION, updatedAt: 1 } }),
    );
    expect(hasConsent("public_export")).toBe(false);
  });

  it("third-party TTS refuses without ai_voice consent and never fetches", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(generateSpeech({ text: "push", voice_id: "v" })).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
