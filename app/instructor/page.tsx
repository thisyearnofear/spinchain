"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { PrimaryNav } from "../components/layout/nav";
import { InstructorWizard } from "../components/features/class/instructor-wizard";
import { SurfaceCard, Tag } from "../components/ui/ui";
import { ConnectWallet } from "../components/features/wallet/connect-wallet";

export default function InstructorPage() {
  const { isConnected } = useAccount();
  const [showWizard, setShowWizard] = useState(false);

  const previewSteps = [
    {
      title: "Draft the class",
      description: "Name the session, set duration, and outline the rider promise.",
    },
    {
      title: "Choose delivery mode",
      description: "Compare a human-led experience with an AI-supported class concept.",
    },
    {
      title: "Shape route and pricing",
      description: "Preview the route, rider cap, and pricing logic before publishing.",
    },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="fixed inset-0 pointer-events-none bg-gradient-radial" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-8 backdrop-blur">
            <Tag>Instructor Preview</Tag>
            <h1 className="mt-4 text-3xl font-black tracking-tighter text-[color:var(--foreground)] md:text-5xl">
              Draft your first class before you connect anything.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--muted)] md:text-base">
              This page now works like a low-friction preview funnel. You can explore the class wizard, compare teaching modes, and review the shape of the workflow before deciding whether to connect a wallet.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setShowWizard(true)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--accent)] px-8 py-3 font-semibold text-white transition-opacity hover:opacity-90"
              >
                Preview class wizard
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
              {!isConnected && <ConnectWallet />}
            </div>

            <p className="mt-4 text-sm text-[color:var(--muted)]">
              Wallet connection is available for users who want to keep exploring, but it no longer blocks the preview experience.
            </p>
          </div>

          <SurfaceCard
            eyebrow="What you can do now"
            title="Preview the instructor journey"
            className="bg-[color:var(--surface)]/70"
          >
            <div className="mt-4 space-y-4">
              {previewSteps.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)]/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">
                    Step {index + 1}
                  </p>
                  <p className="mt-2 font-semibold text-[color:var(--foreground)]">{step.title}</p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">{step.description}</p>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </section>

        {!showWizard && (
          <section className="grid gap-6 lg:grid-cols-2">
            <SurfaceCard eyebrow="Today" title="What this preview already shows">
              <ul className="mt-4 space-y-3 text-sm text-[color:var(--muted)]">
                <li>Class basics, route planning, pricing, and delivery mode selection</li>
                <li>Human-led and AI-led coaching paths using the existing wizard and settings</li>
                <li>Instructor tools that help visitors understand the product before they commit</li>
              </ul>
            </SurfaceCard>

            <SurfaceCard eyebrow="Launch gap" title="What still needs to feel production-ready">
              <ul className="mt-4 space-y-3 text-sm text-[color:var(--muted)]">
                <li>Final onchain publish and route assignment inside the advanced builder</li>
                <li>Credible instructor analytics and payout data pulled from live usage</li>
                <li>Publish-time wallet flows that feel deliberate instead of mandatory upfront</li>
              </ul>
            </SurfaceCard>
          </section>
        )}

        {!showWizard && (
          <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-12 text-center">
            <span className="mb-6 block text-5xl">✨</span>
            <h2 className="mb-3 text-2xl font-semibold text-[color:var(--foreground)]">
              Ready to preview your first class?
            </h2>
            <p className="mx-auto mb-6 max-w-md text-[color:var(--muted)]">
              Start with the existing wizard to validate the flow. You can connect your wallet whenever you want to continue beyond the preview.
            </p>
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-8 py-3 font-semibold text-white transition-opacity hover:opacity-90"
            >
              Open Class Wizard
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            {!isConnected && (
              <p className="mt-3 text-sm text-[color:var(--muted)]">
                Optional: connect a wallet after you preview the flow
              </p>
            )}
          </div>
        )}

        {showWizard && (
          <div className="py-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[color:var(--foreground)]">
                Create New Class
              </h2>
              <button
                onClick={() => setShowWizard(false)}
                className="text-sm text-[color:var(--muted)] transition-colors hover:text-[color:var(--foreground)]"
              >
                Cancel
              </button>
            </div>
            <InstructorWizard />
          </div>
        )}

        {!showWizard && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="/routes/builder"
              className="group rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-6 transition-colors hover:border-[color:var(--accent)]/50"
            >
              <span className="mb-4 block text-3xl">🗺️</span>
              <h3 className="mb-2 font-semibold text-[color:var(--foreground)]">
                Route Builder
              </h3>
              <p className="text-sm text-[color:var(--muted)]">
                Create custom 3D routes with story beats and terrain.
              </p>
            </a>

            <a
              href="/instructor/ai"
              className="group rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-6 transition-colors hover:border-indigo-500/50"
            >
              <span className="mb-4 block text-3xl">🤖</span>
              <h3 className="mb-2 font-semibold text-[color:var(--foreground)]">
                AI Coach Settings
              </h3>
              <p className="text-sm text-[color:var(--muted)]">
                Explore how Coachy can support automated and adaptive class delivery.
              </p>
            </a>

            <a
              href="/instructor/yellow"
              className="group rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6 transition-colors hover:border-yellow-500/50"
            >
              <span className="mb-4 block text-3xl">💛</span>
              <h3 className="mb-2 font-semibold text-[color:var(--foreground)]">
                Revenue & Settlements
              </h3>
              <p className="text-sm text-[color:var(--muted)]">
                Review the payout and reward tooling that will support instructors after launch.
              </p>
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
