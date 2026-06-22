"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { PrimaryNav } from "../components/layout/nav";
import { SurfaceCard, Tag } from "../components/ui/ui";
import { ConnectWallet } from "../components/features/wallet/connect-wallet";

export default function InstructorPage() {
  const { isConnected } = useAccount();

  const builderSteps = [
    { title: "Choose a route", description: "Pick from real 3D routes with elevation, scenery, and story beats." },
    { title: "Set class details", description: "Name, description, schedule, and rider capacity." },
    { title: "Customize visuals", description: "Select avatar, bike, and world theme for the ride." },
    { title: "Configure pricing", description: "Set base and max prices with smart demand-based curves." },
    { title: "Define rewards", description: "Set effort thresholds and SPIN token rewards for riders." },
    { title: "Review & publish", description: "Review everything and deploy on-chain. Wallet needed here." },
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
            <Tag>Class Builder</Tag>
            <h1 className="mt-4 text-3xl font-black tracking-tighter text-[color:var(--foreground)] md:text-5xl">
              Build your first class.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--muted)] md:text-base">
              Choose a route, set pricing, configure rewards, and publish on-chain — all in one flow. You can explore everything without a wallet. Connect when you&apos;re ready to deploy.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/instructor/builder"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--accent)] px-8 py-3 font-semibold text-white transition-opacity hover:opacity-90"
              >
                Open Class Builder
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              {!isConnected && <ConnectWallet />}
            </div>

            <p className="mt-4 text-sm text-[color:var(--muted)]">
              No wallet needed to start building. Connect when you&apos;re ready to publish.
            </p>
          </div>

          <SurfaceCard
            eyebrow="What you can do now"
            title="The builder flow"
            className="bg-[color:var(--surface)]/70"
          >
            <div className="mt-4 space-y-4">
              {builderSteps.map((step, index) => (
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

        <section className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard eyebrow="No wallet needed" title="Build and preview first">
            <ul className="mt-4 space-y-3 text-sm text-[color:var(--muted)]">
              <li>Explore routes, pricing, and rewards configuration</li>
              <li>Try a practice run with AI coaching before deploying</li>
              <li>Everything saves automatically as you go</li>
            </ul>
          </SurfaceCard>

          <SurfaceCard eyebrow="When you connect" title="Publish on-chain">
            <ul className="mt-4 space-y-3 text-sm text-[color:var(--muted)]">
              <li>Deploy your class as an on-chain contract</li>
              <li>Track rider signups and earnings in analytics</li>
              <li>Manage payouts and reward distribution</li>
            </ul>
          </SurfaceCard>
        </section>

        <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/50 p-12 text-center">
          <span className="mb-6 block text-5xl">✨</span>
          <h2 className="mb-3 text-2xl font-semibold text-[color:var(--foreground)]">
            Ready to build your first class?
          </h2>
          <p className="mx-auto mb-6 max-w-md text-[color:var(--muted)]">
            Start with the class builder. You can connect your wallet whenever you&apos;re ready to publish.
          </p>
          <Link
            href="/instructor/builder"
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-8 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          >
            Open Class Builder
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          {!isConnected && (
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              Optional: connect a wallet to publish when ready
            </p>
          )}
        </div>

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
              Configure how the AI coach adapts pacing and cues during your classes.
            </p>
          </a>

          <a
            href="/instructor/yellow"
            className="group rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6 transition-colors hover:border-yellow-500/50"
          >
            <span className="mb-4 block text-3xl">💛</span>
            <h3 className="mb-2 font-semibold text-[color:var(--foreground)]">
              Revenue & Payouts
            </h3>
            <p className="text-sm text-[color:var(--muted)]">
              Review how ticket sales and rider rewards are distributed.
            </p>
          </a>
        </div>
      </main>
    </div>
  );
}
