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

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface DemoCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: {
    duration: number; // seconds
    avgHeartRate: number;
    maxHeartRate: number;
    effortScore: number;
    spinEarned: string;
  };
}

export function DemoCompleteModal({ isOpen, onClose, stats }: DemoCompleteModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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
                {showConfetti && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 rounded-full"
                        style={{
                          background: ["#6d7cff", "#6ef3c6", "#fbbf24", "#f87171"][i % 4],
                          left: `${Math.random() * 100}%`,
                          top: "-10%",
                        }}
                        animate={{
                          y: [0, 400],
                          x: [0, (Math.random() - 0.5) * 200],
                          rotate: [0, 360],
                          opacity: [1, 0],
                        }}
                        transition={{
                          duration: 2 + Math.random() * 2,
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
                  className="text-5xl mb-3"
                >
                  🎉
                </motion.div>
                <h2 className="text-2xl font-bold text-[color:var(--foreground)] mb-1">
                  You Did It!
                </h2>
                <p className="text-sm text-[color:var(--muted)]">
                  Here&apos;s how you performed
                </p>
              </div>

              {/* Stats Grid */}
              <div className="p-5">
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

                {/* Earnings Preview */}
                <div className="rounded-xl bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[color:var(--muted)] mb-0.5">
                        You would have earned
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
                </div>

                {/* Benefits */}
                <div className="space-y-2 mb-4">
                  <BenefitRow icon="🚴" text="Book live classes with top instructors" />
                  <BenefitRow icon="💰" text="Earn SPIN tokens for every workout" />
                  <BenefitRow icon="🔒" text="Privacy-first: ZK proofs protect your data" />
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
