/**
 * Demo Complete Modal
 *
 * Gentle offboarding for guest users after demo ride.
 * Celebrates the effort first, then offers clear next steps.
 */

"use client";

import { useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAccount } from "wagmi";
import { modalTransition } from "@/app/lib/motion";
import { Clock, Zap, Heart, Flame, Bike, Wallet, Trophy } from "lucide-react";

export interface DemoCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: {
    duration: number; // seconds
    avgHeartRate: number;
    maxHeartRate: number;
    effortScore: number;
    spinEarned: string;
    /** When true, spinEarned reflects real Yellow streaming rewards (not a projection) */
    rewardsWereActive?: boolean;
  };
}

export function DemoCompleteModal({ isOpen, onClose, stats }: DemoCompleteModalProps) {
  const { isConnected } = useAccount();
  const [confettiPositions] = useState(() =>
    Array.from({ length: 20 }, (_, i) => ({
      index: i,
      left: Math.random() * 100,
      xOffset: (Math.random() - 0.5) * 200,
      duration: 2 + Math.random() * 2,
    }))
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80"
            onClick={onClose}
          />

          {/* Modal */}
          <m.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={modalTransition}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-2xl">
              {/* Header */}
              <div className="relative p-6 text-center">
                {/* Confetti effect */}
                {isOpen && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    {confettiPositions.map((confetti) => (
                      <m.div
                        key={confetti.index}
                        className="absolute h-2 w-2 rounded-full bg-[color:var(--accent)]"
                        style={{
                          left: `${confetti.left}%`,
                          top: "-10%",
                        }}
                        animate={{
                          y: [0, 400],
                          x: [0, confetti.xOffset],
                          rotate: [0, 360],
                          opacity: [1, 0],
                        }}
                        transition={{
                          duration: confetti.duration,
                          ease: "easeOut",
                        }}
                      />
                    ))}
                  </div>
                )}

                <m.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="relative mx-auto mb-4 h-16 w-16 sm:h-20 sm:w-20"
                >
                  <div className="absolute inset-0 animate-pulse rounded-full bg-[color:var(--accent)] opacity-20" />
                  <div className="relative flex h-full w-full items-center justify-center rounded-full border-2 border-white/20 bg-[color:var(--accent)] text-white shadow-xl">
                    <Trophy className="h-8 w-8 sm:h-10 sm:w-10" />
                  </div>
                </m.div>

                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--accent)]">
                  Demo Complete
                </p>
                <h2 className="mb-1 text-2xl font-bold text-[color:var(--foreground)]">
                  Great ride.
                </h2>
                <p className="text-sm text-[color:var(--muted)]">
                  Session summary • {formatTime(stats.duration)}
                </p>
              </div>

              {/* Coach narrative */}
              <div className="px-5 pt-2">
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4 text-left">
                  <p className="text-xs italic leading-relaxed text-[color:var(--foreground)] opacity-90 sm:text-sm">
                    &ldquo;Solid effort today. Your power and heart rate stayed in a strong aerobic range. Effort score: {stats.effortScore}/1000. Keep this up and the world will keep reacting.&rdquo;
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="p-5 pt-4">
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <StatCard
                    label="Duration"
                    value={formatTime(stats.duration)}
                    icon={<Clock className="h-4 w-4" />}
                  />
                  <StatCard
                    label="Effort Score"
                    value={`${stats.effortScore}/1000`}
                    icon={<Zap className="h-4 w-4" />}
                    highlight
                  />
                  <StatCard
                    label="Avg Heart Rate"
                    value={`${stats.avgHeartRate} BPM`}
                    icon={<Heart className="h-4 w-4" />}
                  />
                  <StatCard
                    label="Max Heart Rate"
                    value={`${stats.maxHeartRate} BPM`}
                    icon={<Flame className="h-4 w-4" />}
                  />
                </div>

                {/* Earnings */}
                <div className="mb-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="mb-0.5 text-xs text-[color:var(--muted)]">
                        {isConnected && stats.rewardsWereActive && parseFloat(stats.spinEarned) > 0
                          ? "You earned"
                          : "You would have earned"}
                      </p>
                      <p className="text-2xl font-bold text-[color:var(--accent)]">
                        {stats.spinEarned} <span className="text-base">SPIN</span>
                      </p>
                    </div>
                  </div>
                  {(!isConnected || !stats.rewardsWereActive) && (
                    <p className="mt-3 text-[10px] text-[color:var(--muted)]">
                      Connect a wallet after your first real ride to start earning.
                    </p>
                  )}
                </div>

                {/* Benefits */}
                <div className="mb-4 space-y-2">
                  <BenefitRow icon={<Bike className="h-4 w-4" />} text="Book live and on-demand classes" />
                  <BenefitRow icon={<Trophy className="h-4 w-4" />} text="Earn rewards for hitting effort goals" />
                  <BenefitRow icon={<Wallet className="h-4 w-4" />} text="Your data stays private until you choose to share" />
                </div>

                {/* CTAs */}
                <div className="space-y-2">
                  <Link
                    href="/rider"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--accent)] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <Bike className="h-4 w-4" />
                    Browse Classes
                  </Link>

                  <Link
                    href="/?showConnect=true"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-6 py-2.5 text-sm font-semibold text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-elevated)]"
                  >
                    <Wallet className="h-4 w-4" />
                    Connect Wallet to Save Rides
                  </Link>

                  <button
                    onClick={onClose}
                    className="w-full py-2 text-xs text-[color:var(--muted)] transition-colors hover:text-[color:var(--foreground)]"
                  >
                    Continue browsing as guest →
                  </button>
                </div>
              </div>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-2.5 text-center ${
        highlight
          ? "border border-[color:var(--accent)]/20 bg-[color:var(--accent)]/10"
          : "bg-[color:var(--surface-strong)]"
      }`}
    >
      <span className="mb-0.5 flex justify-center text-[color:var(--accent)]">{icon}</span>
      <p className="text-base font-bold text-[color:var(--foreground)]">{value}</p>
      <p className="text-xs text-[color:var(--muted)]">{label}</p>
    </div>
  );
}

function BenefitRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[color:var(--accent)]">{icon}</span>
      <span className="text-[color:var(--foreground)]">{text}</span>
    </div>
  );
}
