"use client";

import { useMemo, Suspense } from "react";
import Link from "next/link";
import { CoachProfile } from "./coach-profile";
import { ArrowLeft, BarChart3, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function AgentPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-[color:var(--background)]" />}
    >
      <AgentPageContent />
    </Suspense>
  );
}

function AgentPageContent() {
  const searchParams = useSearchParams();
  const coachParam = searchParams.get("coach");

  const coachConfig = useMemo(() => {
    if (coachParam === "atlas") {
      return { name: "Coach Atlas", personality: "drill-sergeant" as const };
    }
    if (coachParam === "drspin") {
      return { name: "Dr. Spin", personality: "data" as const };
    }
    if (coachParam === "zenmaster") {
      return { name: "Zen Master", personality: "zen" as const };
    }
    return { name: "Coach Atlas", personality: "drill-sergeant" as const };
  }, [coachParam]);

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] selection:bg-[color:var(--accent)]/30">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-[color:var(--accent)]/8 blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-[color:var(--accent-strong)]/5 blur-[128px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]/60 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-[color:var(--muted)] transition-colors hover:text-[color:var(--foreground)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-[color:var(--accent)] to-[color:var(--accent-strong)]" />
              <span className="font-bold tracking-tight">SpinChain</span>
            </div>
            <div className="w-24" />
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8">
          <div className="mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-6xl">
              Build a coach riders remember.
              <span className="mt-2 block text-lg font-medium tracking-normal text-[color:var(--accent)]">
                Tune personality, pacing, and presence — then let it guide every ride.
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-[color:var(--muted)]">
              Create an AI coaching persona that adapts to each rider in real time,
              delivers the right cue at the right moment, and scales your teaching
              without losing your voice.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-2">
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-[color:var(--border)] pb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-blue-400">
                    Coaching Persona
                  </h2>
                  <p className="text-[10px] text-[color:var(--muted)]">
                    How riders experience your coach
                  </p>
                </div>
              </div>
              <p className="text-sm text-[color:var(--muted)]">
                Choose a voice — encouraging, analytical, or relentless — and set
                the heart-rate and power guardrails that keep riders safe while
                pushing their limits.
              </p>
              <CoachProfile
                name={coachConfig.name}
                personality={coachConfig.personality}
              />
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-[color:var(--border)] pb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/20 text-pink-400">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-pink-400">
                    Class Economics
                  </h2>
                  <p className="text-[10px] text-[color:var(--muted)]">
                    Demand-based pricing for instructors
                  </p>
                </div>
              </div>
              <p className="text-sm text-[color:var(--muted)]">
                As a class fills up, the price adjusts automatically — higher when
                seats are scarce, lower to fill the last few spots. Riders get fair
                pricing; you get predictable revenue.
              </p>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
                <p className="text-sm text-[color:var(--muted)]">
                  Pricing simulator coming soon.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
