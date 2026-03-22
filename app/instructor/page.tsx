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

  const liveSignals = [
    { title: "Classes Created", value: "12" },
    { title: "Total Riders", value: "348" },
    { title: "Revenue Earned", value: "3.8 ETH" },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
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

        {/* Hospitality & Performance Section */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="group relative rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur-3xl shadow-2xl overflow-hidden">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 rounded-3xl blur opacity-30"></div>

              <div className="relative">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tighter">
                      Your Business Overview
                    </h2>
                    <p className="text-sm text-white/40">
                      Hospitality metrics for the last 30 days.
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <span className="text-lg">📈</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">
                      Retention
                    </p>
                    <p className="text-2xl font-black text-white tracking-tighter">
                      84%
                    </p>
                    <p className="text-[10px] text-green-400 font-bold mt-1">
                      +12% vs LY
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">
                      Avg Rating
                    </p>
                    <p className="text-2xl font-black text-white tracking-tighter">
                      4.92
                    </p>
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} className="text-[10px] text-yellow-400">
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">
                      Occupancy
                    </p>
                    <p className="text-2xl font-black text-white tracking-tighter">
                      92%
                    </p>
                    <p className="text-[10px] text-indigo-400 font-bold mt-1">
                      Near Capacity
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">
                      New Riders
                    </p>
                    <p className="text-2xl font-black text-white tracking-tighter">
                      142
                    </p>
                    <p className="text-[10px] text-white/30 font-bold mt-1">
                      This month
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href="/instructor/builder"
                className="group rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition-all"
              >
                <h3 className="font-bold text-white mb-1 flex items-center gap-2">
                  <span className="text-sm">🏗️</span> List a New Class
                </h3>
                <p className="text-xs text-white/40">
                  Create a scheduled or AI-hosted experience.
                </p>
              </a>
              <a
                href="/instructor/live"
                className="group rounded-2xl border border-red-500/20 bg-red-500/5 p-6 hover:bg-red-500/10 transition-all"
              >
                <h3 className="font-bold text-white mb-1 flex items-center gap-2">
                  <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />{" "}
                  Live Command Center
                </h3>
                <p className="text-xs text-white/40">
                  Monitor active classes and override AI coaching.
                </p>
              </a>
            </div>
          </div>

          <div className="space-y-6">
            <SurfaceCard
              eyebrow="Earnings"
              title="Real-time Revenue"
              className="bg-indigo-500/10 border-indigo-500/20"
            >
              <div className="mt-4">
                <p className="text-3xl font-black text-white tracking-tighter">
                  3.82 ETH
                </p>
                <p className="text-xs text-white/40 mb-6">
                  ~$9,450.20 Available
                </p>
                <button className="w-full py-3 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-all">
                  Withdraw Funds
                </button>
              </div>
            </SurfaceCard>

            <SurfaceCard
              eyebrow="Insights"
              title="Coach Atlas Says"
              className="bg-amber-500/10 border-amber-500/20"
            >
              <p className="text-xs text-amber-200/80 leading-relaxed italic">
                &quot;Riders are dropping off around the 35-minute mark on
                Alpine routes. Suggest adding a sprint beat to maintain
                engagement.&quot;
              </p>
            </SurfaceCard>
          </div>
        </section>

        {/* Create Class CTA */}
        {!showWizard && (
          <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-12 text-center">
            <span className="text-5xl mb-6 block">✨</span>
            <h2 className="text-2xl font-semibold text-[color:var(--foreground)] mb-3">
              Ready to create your next class?
            </h2>
            <p className="text-[color:var(--muted)] mb-6 max-w-md mx-auto">
              Our simplified wizard will guide you through setting up your
              class, route, and pricing in just a few steps.
            </p>
            <button
              onClick={() => setShowWizard(true)}
              disabled={!isConnected}
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-8 py-3 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
              <p className="mt-3 text-sm text-[color:var(--muted)]">
                Connect your wallet to get started
              </p>
            )}
          </div>
        )}

        {/* Simplified Wizard */}
        {showWizard && (
          <div className="py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[color:var(--foreground)]">
                Create New Class
              </h2>
              <button
                onClick={() => setShowWizard(false)}
                className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
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
              className="group rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-6 hover:border-[color:var(--accent)]/50 transition-colors"
            >
              <span className="text-3xl mb-4 block">🗺️</span>
              <h3 className="font-semibold text-[color:var(--foreground)] mb-2">
                Route Builder
              </h3>
              <p className="text-sm text-[color:var(--muted)]">
                Create custom 3D routes with story beats and terrain
              </p>
            </a>

            <a
              href="/instructor/ai"
              className="group rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-6 hover:border-indigo-500/50 transition-colors"
            >
              <span className="text-3xl mb-4 block">🤖</span>
              <h3 className="font-semibold text-[color:var(--foreground)] mb-2">
                AI Coach Settings
              </h3>
              <p className="text-sm text-[color:var(--muted)]">
                Configure your autonomous twin to teach 24/7
              </p>
            </a>

            <a
              href="/instructor/yellow"
              className="group rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6 hover:border-yellow-500/50 transition-colors"
            >
              <span className="text-3xl mb-4 block">💛</span>
              <h3 className="font-semibold text-[color:var(--foreground)] mb-2">
                Revenue & Settlements
              </h3>
              <p className="text-sm text-[color:var(--muted)]">
                Manage payouts and view rider reward distributions
              </p>
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
