"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings2, Loader2 } from "lucide-react";
import { useRiderProfile } from "@/app/stores/rider-profile-store";

/**
 * UpdatePreferencesButton — Opens the rider quiz with pre-filled answers.
 *
 * When clicked, stores current answers in sessionStorage and redirects
 * to the home page with ?welcome=true&prefill=true, which triggers
 * the quiz to pre-fill from sessionStorage.
 */
export function UpdatePreferencesButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const profile = useRiderProfile();

  const handleClick = () => {
    setLoading(true);
    const prefill = {
      goal: profile.goal,
      experience: profile.experience,
      frequency: profile.frequency,
      motivation: profile.motivation,
      coach: profile.coachPersonality,
    };
    if (typeof window !== "undefined") {
      sessionStorage.setItem("spinchain-quiz-prefill", JSON.stringify(prefill));
    }
    router.push("/?welcome=true&prefill=true");
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/80 transition-[transform,background-color] duration-150 active:scale-95 hover:bg-white/10 disabled:opacity-50 ${className ?? ""}`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Settings2 className="w-3.5 h-3.5" />
      )}
      Update Preferences
    </button>
  );
}
