"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrimaryNav } from "../../components/layout/nav";
import { BulletList, SectionHeader, SurfaceCard, Tag } from "../../components/ui/ui";

function JourneyContent() {
  const searchParams = useSearchParams();
  const isCompleted = searchParams.get("completed") === "true";
  const [showPreview, setShowPreview] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");

  async function handleShareProof() {
    const url = window.location.href;
    const text = "I just completed a SpinChain ride and earned SPIN tokens! 🚴‍♂️🔒 Proof of effort, privacy-first.";
    if (navigator.share) {
      await navigator.share({ title: "SpinChain Proof of Effort", text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    }
  }

  const journeySteps = [
    "Connect devices & set privacy",
    "Secure your ticket",
    "Ride with live coaching",
    "Verify effort & earn rewards",
    "Share your achievement",
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        {isCompleted && (
          <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/20 to-emerald-500/10 p-8 text-center">
            <div className="h-20 w-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 flex items-center justify-center">
              <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Ride Complete! 🎉</h2>
            <p className="text-white/70 mb-6">Your effort has been verified and rewards are on the way.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 text-green-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Effort Verified
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 text-purple-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                +10 SPIN Earned
              </span>
            </div>
          </div>
        )}

        <SurfaceCard
          eyebrow="Rider Journey"
          title={isCompleted ? "Your Journey" : "From ticket to trophy in one flow"}
          description={isCompleted 
            ? "You've completed all steps! Here's what happened:"
            : "Every action is designed to keep your health data private while unlocking real rewards."
          }
          className="bg-[color:var(--surface-strong)]"
        >
          <div className="mt-6 flex flex-wrap gap-3">
            <Tag>Privacy-First</Tag>
            <Tag>Instant Access</Tag>
            <Tag>Auto Rewards</Tag>
          </div>
          <div className="mt-6">
            <BulletList items={journeySteps} />
          </div>
        </SurfaceCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard
            eyebrow="Onboarding"
            title="Setup & Preferences"
            description="You control which metrics are shared. Opt out anytime."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              HR data stays on your device. Only your results are verified.
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Ticketing"
            title="Secure Your Ticket"
            description="Tickets unlock the class and are yours to keep or transfer."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              Early-bird pricing + loyalty discounts applied automatically.
            </div>
          </SurfaceCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard
            eyebrow="Live Ride"
            title="Live Coaching & Feedback"
            description="Real-time progress ring with private verification."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              Effort zone tracking • streak updates • pacing cues
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Rewards"
            title="Claim Your Rewards"
            description="Completing the ride unlocks SPIN tokens and perks."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              10 SPIN + 20% off next class (7-day window)
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard
          eyebrow="Share Card"
          title="Share Your Success"
          description="A beautiful card to celebrate your effort."
        >
          <SectionHeader
            eyebrow="Export"
            title="Generate Story-Ready Proof"
            description="Auto-branded with instructor + class info."
            actions={
              <>
                <button
                  onClick={() => setShowPreview(true)}
                  className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition hover:text-white"
                >
                  Preview Card
                </button>
                <button
                  onClick={handleShareProof}
                  className="rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20"
                >
                  {shareStatus === "copied" ? "Copied! ✓" : "Share"}
                </button>
              </>
            }
          />
        </SurfaceCard>

        {/* Proof card preview modal */}
        {showPreview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowPreview(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-1 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="rounded-[22px] bg-[#0d0f1e] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400">SpinChain</span>
                  <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-400">Verified ✓</span>
                </div>
                <h3 className="mb-1 text-2xl font-bold text-white">Proof of Effort</h3>
                <p className="mb-6 text-sm text-white/50">Privacy-preserving ride certificate</p>
                <div className="mb-6 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="text-lg font-bold text-white">45m</div>
                    <div className="text-xs text-white/40">Duration</div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="text-lg font-bold text-white">142</div>
                    <div className="text-xs text-white/40">Avg HR</div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <div className="text-lg font-bold text-indigo-400">+10</div>
                    <div className="text-xs text-white/40">SPIN</div>
                  </div>
                </div>
                <div className="mb-4 rounded-xl bg-indigo-500/10 px-4 py-3 text-xs text-indigo-300">
                  🔒 Private Verification — no raw biometrics shared
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-medium text-white/70 hover:bg-white/20 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function RiderJourneyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
          <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
            <PrimaryNav />
          </div>
          <div className="flex items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          </div>
        </main>
      </div>
    }>
      <JourneyContent />
    </Suspense>
  );
}
