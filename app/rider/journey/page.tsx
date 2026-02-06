"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PrimaryNav } from "../../components/layout/nav";
import { BulletList, SectionHeader, SurfaceCard, Tag } from "../../components/ui/ui";

function JourneyContent() {
  const searchParams = useSearchParams();
  const isCompleted = searchParams.get("completed") === "true";

  const journeySteps = [
    "Connect wearable + privacy preferences",
    "Buy ticket (wallet abstracted)",
    "Ride with live effort feedback",
    "Generate proof + earn rewards",
    "Share proof card",
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
            <p className="text-white/70 mb-6">Your effort has been recorded and rewards are being processed.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 text-green-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Proof Generated
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
          title={isCompleted ? "Your Journey" : "From ticket to proof in one flow"}
          description={isCompleted 
            ? "You've completed all steps! Here's what happened:"
            : "Every rider action is designed to keep health data private while unlocking rewards."
          }
          className="bg-[color:var(--surface-strong)]"
        >
          <div className="mt-6 flex flex-wrap gap-3">
            <Tag>Privacy-first</Tag>
            <Tag>1-click ticket</Tag>
            <Tag>Auto rewards</Tag>
          </div>
          <div className="mt-6">
            <BulletList items={journeySteps} />
          </div>
        </SurfaceCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard
            eyebrow="Onboarding"
            title="Consent + device linking"
            description="Riders control what metrics are shared and can opt out per class."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              HR data stays on device. Only proof of thresholds is submitted.
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Ticketing"
            title="Mint attendance NFT"
            description="Tickets are programmable, transferable, and verifiable."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              Early-bird pricing + loyalty discounts applied automatically.
            </div>
          </SurfaceCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard
            eyebrow="Live Ride"
            title="Effort feedback, no wallet prompts"
            description="Live progress ring with private proof generation."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              Effort zone tracking • streak updates • pacing cues
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Rewards"
            title="Claim rewards automatically"
            description="Proofs mint rewards and unlock discounts."
          >
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
              10 SPIN + 20% off next class (7-day window)
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard
          eyebrow="Share Card"
          title="Proof of effort, shareable anywhere"
          description="A single card for social + onchain verification."
        >
          <SectionHeader
            eyebrow="Export"
            title="Generate story-ready proof"
            description="Auto-branded with instructor + class info."
            actions={
              <>
                <button className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition hover:text-white">
                  Preview card
                </button>
                <button className="rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20">
                  Share proof
                </button>
              </>
            }
          />
        </SurfaceCard>
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
