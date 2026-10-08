"use client";

import { useState } from "react";
import { useConsentAnswered, setConsent } from "@/app/lib/privacy/consent";

/** One-time, non-blocking ask before third-party AI coaching/voice is used. */
export function AiVoiceConsentPrompt() {
  const answered = useConsentAnswered("ai_voice");
  const [saving, setSaving] = useState(false);
  if (answered) return null;

  const answer = async (granted: boolean) => {
    setSaving(true);
    await setConsent("ai_voice", granted);
    setSaving(false);
  };

  return (
    <div
      role="dialog"
      aria-label="AI coaching and voice"
      className="pointer-events-auto fixed bottom-5 left-4 z-50 w-[min(92vw,26rem)] rounded-2xl border border-white/10 bg-black/80 p-4 text-white shadow-xl backdrop-blur sm:bottom-6 sm:left-6"
    >
      <p className="text-sm font-semibold">Use the AI coach voice?</p>
      <p className="mt-1 text-[11px] text-white/50">
        Sends your ride stats and coach lines to our AI and voice providers. Not now keeps cues on this device with your
        browser&apos;s voice. You can change this in Data &amp; Privacy.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => answer(false)}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-white/60 hover:text-white disabled:opacity-50"
        >
          Not now
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => answer(true)}
          className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"
        >
          Allow
        </button>
      </div>
    </div>
  );
}
