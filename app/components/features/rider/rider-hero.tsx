"use client";

import dynamic from "next/dynamic";
import { m } from "framer-motion";
import { Bike, Zap, TrendingUp, Users } from "lucide-react";
import { useRiderStats } from "@/app/hooks/common/use-rider-stats";
import { useClasses } from "@/app/hooks/evm/use-class-data";
import { useInstructors } from "@/app/hooks/evm/use-instructors";
import { modalTransition } from "@/app/lib/motion";
import type { WeeklyLoad } from "@/app/lib/analytics/training-load";

// The rider's character greets them on the front door (docs/CHARACTER-SYSTEM.md
// — Act 1). Store-driven: with no ride active it shows the pre-ride posture —
// eager when fresh, heavy when the week's load says recovery.
const RiveRider = dynamic(
  () => import("@/app/components/features/ride/rive-rider").then((mod) => mod.RiveRider),
  { ssr: false },
);

export function RiderHero({
  initialGreeting,
  weeklyLoad,
}: {
  initialGreeting?: string;
  weeklyLoad?: WeeklyLoad;
}) {
  const fatigued = weeklyLoad?.fatigued ?? false;
  const { prs } = useRiderStats();
  const { classes } = useClasses();
  const { instructors } = useInstructors();

  const greeting = initialGreeting || "Ready to ride?";

  const activeRoutes = classes.length;
  const aiCoaches = instructors.length || 3;
  const avgReward = prs.bestSpin > 0 ? `${prs.bestSpin.toFixed(0)} SPIN` : "—";

  const stats = [
    { icon: Bike, label: "Active Routes", value: activeRoutes.toString() },
    { icon: Users, label: "AI Coaches", value: aiCoaches.toString() },
    { icon: Zap, label: "Best Effort", value: prs.bestEffort > 0 ? `${prs.bestEffort}` : "—" },
    { icon: TrendingUp, label: "Top Reward", value: avgReward },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 backdrop-blur">
      {/* Animated gradient mesh */}
      <div className="absolute inset-0 pointer-events-none">
        <m.div
          className="absolute -top-1/2 -left-1/4 w-[60%] h-[120%] rounded-full blur-[100px]"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
          animate={{ opacity: [0.08, 0.15, 0.08], x: [0, 30, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <m.div
          className="absolute -bottom-1/2 -right-1/4 w-[60%] h-[120%] rounded-full blur-[100px]"
          style={{ background: "radial-gradient(circle, var(--accent-strong) 0%, transparent 70%)" }}
          animate={{ opacity: [0.06, 0.12, 0.06], x: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative px-6 py-12 sm:px-10 sm:py-16 lg:px-16 lg:py-20">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          {/* Left: Copy */}
          <div className="flex-1 max-w-2xl">
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...modalTransition, duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color:var(--accent)]/10 border border-[color:var(--accent)]/20 mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[color:var(--accent)]">
                Immersive cycling
              </span>
            </m.div>

            <div className="flex items-center gap-4 sm:gap-6">
              <m.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...modalTransition, duration: 0.4, delay: 0.05 }}
                className="shrink-0"
              >
                <RiveRider size={96} ready={!fatigued} fatigued={fatigued} />
              </m.div>
              <m.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...modalTransition, duration: 0.4, delay: 0.05 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-[color:var(--foreground)] leading-[1.05]"
              >
                {greeting}
              </m.h1>
            </div>

            <m.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...modalTransition, duration: 0.4, delay: 0.1 }}
              className="mt-5 text-base sm:text-lg text-[color:var(--muted)] max-w-lg leading-relaxed"
            >
              {fatigued && weeklyLoad ? (
                /* Recovery-respecting: the character is proud of rest, not
                   just intensity (docs/CHARACTER-SYSTEM.md health principles). */
                <>
                  {weeklyLoad.minutesLast7d} minutes in the legs over 7 days — an easy
                  spin today makes you faster tomorrow.{" "}
                  <span className="font-bold text-[color:var(--foreground)]">Recovery is training.</span>
                </>
              ) : prs.bestPower > 0 ? (
                /* Returning rider: greet with memory, not marketing
                   (docs/CHARACTER-SYSTEM.md — Act 1). */
                <>
                  Your PR on the board:{" "}
                  <span className="font-bold text-[color:var(--foreground)]">{prs.bestPower}W average power</span>.
                  Today we chase it — or build the base beneath it.
                </>
              ) : (
                <>
                  Immersive cycling classes with AI coaching, real-time telemetry,
                  and rewards that celebrate your effort.
                </>
              )}
            </m.p>

            <m.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...modalTransition, duration: 0.4, delay: 0.15 }}
              className="mt-8 flex flex-wrap items-center gap-4 text-sm"
            >
              <a
                href="/rider#classes"
                className="inline-flex items-center gap-1.5 text-[color:var(--muted)] font-medium transition-colors hover:text-[color:var(--foreground)]"
              >
                <Bike className="w-3.5 h-3.5" />
                Browse classes
              </a>
              <a
                href="/instructor"
                className="inline-flex items-center gap-1.5 text-[color:var(--muted)]/80 font-medium transition-colors hover:text-[color:var(--foreground)]"
              >
                <Zap className="w-3.5 h-3.5" />
                Host a class
              </a>
            </m.div>
          </div>

          {/* Right: Live stats */}
          <m.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...modalTransition, duration: 0.4, delay: 0.2 }}
            className="grid grid-cols-2 gap-3 w-full lg:w-auto"
          >
            {stats.map((stat, i) => (
              <m.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...modalTransition, delay: 0.25 + i * 0.05 }}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)]/60 backdrop-blur p-4 lg:w-[160px]"
              >
                <stat.icon className="w-4 h-4 text-[color:var(--accent)] mb-2" strokeWidth={1.5} />
                <p className="text-xl font-black text-[color:var(--foreground)] tracking-tight">
                  {stat.value}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted)] mt-0.5">
                  {stat.label}
                </p>
              </m.div>
            ))}
          </m.div>
        </div>
      </div>
    </section>
  );
}
