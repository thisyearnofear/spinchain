"use client";

import { motion } from "framer-motion";
import { Bike, Zap, TrendingUp, Users } from "lucide-react";
import { useRiderStats } from "@/app/hooks/common/use-rider-stats";
import { useClasses } from "@/app/hooks/evm/use-class-data";
import { useInstructors } from "@/app/hooks/evm/use-instructors";
import { modalTransition } from "@/app/lib/motion";

export function RiderHero() {
  const { totalRides, prs } = useRiderStats();
  const { classes } = useClasses();
  const { instructors } = useInstructors();

  const activeRoutes = classes.length;
  const aiCoaches = instructors.length || 3;
  const avgReward = totalRides > 0
    ? `${prs.bestSpin.toFixed(0)} SPIN`
    : "—";

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
        <motion.div
          className="absolute -top-1/2 -left-1/4 w-[60%] h-[120%] rounded-full blur-[100px]"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
          animate={{ opacity: [0.08, 0.15, 0.08], x: [0, 30, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
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
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...modalTransition, duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color:var(--accent)]/10 border border-[color:var(--accent)]/20 mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[color:var(--accent)]">
                On-chain cycling
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...modalTransition, duration: 0.4, delay: 0.05 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-[color:var(--foreground)] leading-[1.05]"
            >
              Ride smarter.
              <br />
              <span className="bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-strong)] bg-clip-text text-transparent">
                Earn on-chain.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...modalTransition, duration: 0.4, delay: 0.1 }}
              className="mt-5 text-base sm:text-lg text-[color:var(--muted)] max-w-lg leading-relaxed"
            >
              Immersive cycling classes with AI coaching, real-time telemetry,
              and crypto rewards. Powered by Sui &amp; Walrus.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...modalTransition, duration: 0.4, delay: 0.15 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <a
                href="/rider#classes"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[color:var(--accent)] text-white font-semibold text-sm transition-[transform,opacity] duration-150 active:scale-95 hover:opacity-90 shadow-lg shadow-[color:var(--accent)]/20"
              >
                <Bike className="w-4 h-4" />
                Browse Classes
              </a>
              <a
                href="/instructor"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)] font-semibold text-sm transition-[transform,background-color] duration-150 active:scale-95 hover:bg-[color:var(--surface-elevated)]"
              >
                <Zap className="w-4 h-4" />
                Host a Class
              </a>
            </motion.div>
          </div>

          {/* Right: Live stats */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...modalTransition, duration: 0.4, delay: 0.2 }}
            className="grid grid-cols-2 gap-3 w-full lg:w-auto"
          >
            {stats.map((stat, i) => (
              <motion.div
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
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
