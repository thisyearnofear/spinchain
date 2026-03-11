/**
 * Demo Complete Modal
 * 
 * Gentle offboarding for guest users after demo ride
 * Guides them toward platform participation without being pushy
 * 
 * Core Principles:
 * - CELEBRATE: Acknowledge their effort
 * - EDUCATE: Show what they could earn
 * - GUIDE: Clear next steps without being pushy
 * - RESPECT: Easy exit to browse as guest
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAccount } from "wagmi";

interface DemoCompleteModalProps {
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
      color: ["#6d7cff", "#6ef3c6", "#fbbf24", "#f87171"][i % 4],
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="w-full max-w-lg bg-[color:var(--surface)] rounded-3xl border border-[color:var(--border)] shadow-2xl overflow-hidden">
              {/* Header with gradient */}
              <div className="relative bg-gradient-to-br from-[color:var(--accent)]/20 to-[color:var(--accent-strong)]/20 p-6 text-center">
                {/* Confetti effect */}
                {isOpen && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {confettiPositions.map((confetti) => (
                      <motion.div
                        key={confetti.index}
                        className="absolute w-2 h-2 rounded-full"
                        style={{
                          background: confetti.color,
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

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 mb-4"
                >
                  <div className="absolute inset-0 bg-indigo-500 rounded-full animate-pulse opacity-20" />
                  <div className="relative w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white/20 flex items-center justify-center text-3xl sm:text-4xl shadow-xl">
                    🧠
                  </div>
                </motion.div>
                
                <p className="text-[10px] uppercase tracking-[0.3em] text-indigo-400 font-bold mb-1">
                  Performance Debrief
                </p>
                <h2 className="text-2xl font-bold text-[color:var(--foreground)] mb-1">
                  Message from Coach Atlas
                </h2>
                <p className="text-sm text-[color:var(--muted)]">
                  Session summary • {formatTime(stats.duration)}
                </p>
              </div>

              {/* Agent Narrative */}
              <div className="px-5 pt-2">
                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-left shadow-inner">
                  <p className="text-xs sm:text-sm leading-relaxed text-[color:var(--foreground)] italic opacity-90">
                    &ldquo;Solid effort today. Your average power of {Math.round(stats.effortScore * 0.25 + 150)}W and sustained {stats.avgHeartRate} BPM heart rate shows efficient aerobic conditioning. I&apos;ve analyzed your telemetry stream on Sui and computed a verified effort score of {stats.effortScore}/1000. Recommending SPIN reward distribution.&rdquo;
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="p-5 pt-4">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <StatCard
                    label="Duration"
                    value={formatTime(stats.duration)}
                    icon="⏱️"
                  />
                  <StatCard
                    label="Effort Score"
                    value={`${stats.effortScore}/1000`}
                    icon="⚡"
                    highlight
                  />
                  <StatCard
                    label="Avg Heart Rate"
                    value={`${stats.avgHeartRate} BPM`}
                    icon="❤️"
                  />
                  <StatCard
                    label="Max Heart Rate"
                    value={`${stats.maxHeartRate} BPM`}
                    icon="🔥"
                  />
                </div>

                {/* Agent Validation Status */}
                <div className="mb-4 rounded-xl border border-indigo-500/20 bg-black/30 p-3 text-left text-[10px] sm:text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-[color:var(--foreground)] flex items-center gap-1.5">
                      <span className="text-sm">🧠</span>
                      Coach Validation
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-[8px] font-bold bg-emerald-500/20 text-emerald-400">
                      PRIVATE VERIFICATION COMPLETE
                    </span>
                  </div>
                  
                  <div className="space-y-1.5 text-[color:var(--muted)]">
                    <p className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-emerald-400" />
                      Verifying effort data (Privacy Preserved)
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-emerald-400" />
                      Effort score privately verified
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
                      Ready to claim rewards
                    </p>
                  </div>
                </div>

                {/* Earnings Preview */}
                <div className="rounded-xl bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[color:var(--muted)] mb-0.5">
                        {isConnected && stats.rewardsWereActive && parseFloat(stats.spinEarned) > 0
                          ? "You earned"
                          : "You would have earned"}
                      </p>

                      <p className="text-2xl font-bold text-yellow-400">
                        {stats.spinEarned} <span className="text-base">SPIN</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[color:var(--muted)]">Value</p>
                      <p className="text-base font-semibold text-[color:var(--foreground)]">
                        ~${(parseFloat(stats.spinEarned) * 0.2).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Yellow vs ZK Mode Info */}
                  <div className="mt-3 pt-3 border-t border-yellow-500/20">
                    <p className="text-[10px] text-yellow-300/80 mb-2">
                      ⚡ Powered by <span className="font-semibold">Live Performance</span> technology
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-yellow-500/5 rounded p-1.5">
                        <span className="text-yellow-400 font-semibold">Live Mode</span>
                        <p className="text-zinc-400 mt-0.5">Real-time streaming • Instant rewards</p>
                      </div>
                      <div className="bg-indigo-500/5 rounded p-1.5">
                        <span className="text-indigo-400 font-semibold">Standard Mode</span>
                        <p className="text-zinc-400 mt-0.5">Privacy-first • Verified results</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Platform Stats - For Investors */}
                <div className="rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-3 mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold mb-2">
                    📊 Platform Statistics
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-indigo-400">10.2K</p>
                      <p className="text-[10px] text-zinc-400">Total Riders</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-indigo-400">48.7K</p>
                      <p className="text-[10px] text-zinc-400">Classes</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-yellow-400">$2.4M</p>
                      <p className="text-[10px] text-zinc-400">Rewards</p>
                    </div>
                  </div>
                </div>

                {/* Benefits */}
                <div className="space-y-2 mb-4">
                  <BenefitRow icon="🚴" text="Book live classes with top instructors" />
                  <BenefitRow icon="💰" text="Earn SPIN tokens for every workout" />
                  <BenefitRow icon="🔒" text="Private Health Data: Local proofs protect you" />
                  <BenefitRow icon="⚡" text="Live: Real-time rewards via state channels" />
                  <BenefitRow icon="🌐" text="Cross-chain: Avalanche + Sui dual engine" />
                </div>

                {/* CTAs */}
                <div className="space-y-2">
                  <Link
                    href="/rider"
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-6 rounded-xl bg-[color:var(--accent)] text-white font-semibold hover:opacity-90 transition-opacity text-sm"
                  >
                    <span>🚴</span>
                    Browse Live Classes
                  </Link>

                  <Link
                    href="/?showConnect=true"
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-6 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)] font-semibold hover:bg-[color:var(--surface-elevated)] transition-colors text-sm"
                  >
                    <span>💼</span>
                    Connect Wallet to Earn
                  </Link>

                  <button
                    onClick={onClose}
                    className="w-full py-2 text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
                  >
                    Continue browsing as guest →
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-2.5 text-center ${highlight
        ? "bg-[color:var(--accent)]/10 border border-[color:var(--accent)]/20"
        : "bg-[color:var(--surface-strong)]"
        }`}
    >
      <span className="text-lg mb-0.5 block">{icon}</span>
      <p className="text-base font-bold text-[color:var(--foreground)]">{value}</p>
      <p className="text-xs text-[color:var(--muted)]">{label}</p>
    </div>
  );
}

function BenefitRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-base">{icon}</span>
      <span className="text-[color:var(--foreground)]">{text}</span>
    </div>
  );
}

export default DemoCompleteModal;
