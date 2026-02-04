"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { PrimaryNav } from "../components/nav";
import { InstructorWizard } from "../components/instructor-wizard";
import { SurfaceCard, Tag } from "../components/ui";
import { ConnectWallet } from "../components/connect-wallet";

export default function InstructorPage() {
  const { isConnected } = useAccount();
  const [showWizard, setShowWizard] = useState(false);

  const liveSignals = [
    { title: "Classes Created", value: "12" },
    { title: "Total Riders", value: "348" },
    { title: "Revenue Earned", value: "3.8 ETH" },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-radial pointer-events-none" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-(--border) bg-(--surface)/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        {/* Connect Wallet Banner */}
        {!isConnected && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 backdrop-blur">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="text-2xl">🎓</span>
                <div>
                  <h3 className="text-lg font-semibold text-amber-600 dark:text-amber-400 mb-1">
                    Become an Instructor
                  </h3>
                  <p className="text-sm text-amber-900 dark:text-amber-200/80">
                    Connect your wallet to create classes, set pricing, and
                    start earning.
                  </p>
                </div>
              </div>
              <ConnectWallet />
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <SurfaceCard
          eyebrow="Instructor Console"
          title="Your teaching dashboard"
          description="Create immersive classes and build your community."
          className="bg-(--surface-strong)"
        >
          <div className="mt-6 flex flex-wrap gap-3">
            <Tag>Dynamic pricing</Tag>
            <Tag>Private metrics</Tag>
            <Tag>Auto payouts</Tag>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {liveSignals.map((signal) => (
              <div
                key={signal.title}
                className="rounded-2xl border border-(--border) bg-(--surface) px-4 py-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-(--muted)">
                  {signal.title}
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {signal.value}
                </p>
              </div>
            ))}
          </div>
        </SurfaceCard>

        {/* Create Class CTA */}
        {!showWizard && (
          <div className="rounded-3xl border border-dashed border-(--border) bg-(--surface)/50 p-12 text-center">
            <span className="text-5xl mb-6 block">✨</span>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              Ready to create your next class?
            </h2>
            <p className="text-(--muted) mb-6 max-w-md mx-auto">
              Our simplified wizard will guide you through setting up your
              class, route, and pricing in just a few steps.
            </p>
            <button
              onClick={() => setShowWizard(true)}
              disabled={!isConnected}
              className="inline-flex items-center gap-2 rounded-full bg-(--accent) px-8 py-3 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create New Class
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </button>
            {!isConnected && (
              <p className="mt-3 text-sm text-(--muted)">
                Connect your wallet to get started
              </p>
            )}
          </div>
        )}

        {/* Simplified Wizard */}
        {showWizard && (
          <div className="py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                Create New Class
              </h2>
              <button
                onClick={() => setShowWizard(false)}
                className="text-sm text-(--muted) hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
            <InstructorWizard />
          </div>
        )}

        {/* Quick Links */}
        {!showWizard && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="/routes/builder"
              className="group rounded-2xl border border-(--border) bg-(--surface)/50 p-6 hover:border-(--accent)/50 transition-colors"
            >
              <span className="text-3xl mb-4 block">🗺️</span>
              <h3 className="font-semibold text-foreground mb-2">
                Route Builder
              </h3>
              <p className="text-sm text-(--muted)">
                Create custom 3D routes with story beats and terrain
              </p>
            </a>

            <a
              href="/instructor/ai"
              className="group rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-6 hover:border-indigo-500/50 transition-colors"
            >
              <span className="text-3xl mb-4 block">🤖</span>
              <h3 className="font-semibold text-foreground mb-2">
                Agentic Finance
              </h3>
              <p className="text-sm text-(--muted)">
                Deploy autonomous instructors and optimize revenue with V4 hooks
              </p>
            </a>

            <div className="rounded-2xl border border-(--border) bg-(--surface)/50 p-6">
              <span className="text-3xl mb-4 block">📊</span>
              <h3 className="font-semibold text-foreground mb-2">Analytics</h3>
              <p className="text-sm text-(--muted)">
                Coming soon: Detailed class performance insights
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
