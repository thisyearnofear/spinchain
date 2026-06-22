"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, TrendingUp, Flame } from "lucide-react";
import { getPRs, getRideHistory } from "@/app/lib/analytics/ride-history";

/**
 * PrPacingIndicator — Shows real-time comparison against personal records.
 *
 * Compares current effort and power against stored PRs.
 * Only displays when within ±15% of a PR to avoid noise.
 */
export function PrPacingIndicator({
  currentEffort,
  currentPower,
  isActive,
}: {
  currentEffort: number;
  currentPower: number;
  isActive: boolean;
}) {
  const prs = useMemo(() => {
    const rides = getRideHistory();
    if (rides.length === 0) return null;
    return getPRs(rides);
  }, []);

  const [showFlash, setShowFlash] = useState(false);
  const lastEffortRef = useRef(0);

  useEffect(() => {
    if (!isActive || !prs) return;

    // Trigger flash when effort crosses PR threshold
    if (currentEffort > 0 && prs.bestEffort > 0) {
      if (currentEffort >= prs.bestEffort && lastEffortRef.current < prs.bestEffort) {
        setShowFlash(true);
        const timer = setTimeout(() => setShowFlash(false), 2000);
        return () => clearTimeout(timer);
      }
    }
    lastEffortRef.current = currentEffort;
  }, [currentEffort, prs, isActive]);

  if (!isActive || !prs || prs.bestEffort === 0) return null;

  const effortRatio = prs.bestEffort > 0 ? currentEffort / prs.bestEffort : 0;
  const powerRatio = prs.bestPower > 0 ? currentPower / prs.bestPower : 0;

  const effortNearPR = effortRatio > 0.85 && effortRatio < 1.0;
  const effortAtPR = effortRatio >= 1.0;
  const powerNearPR = powerRatio > 0.85 && powerRatio < 1.0;
  const powerAtPR = powerRatio >= 1.0;

  if (!effortNearPR && !effortAtPR && !powerNearPR && !powerAtPR) return null;

  const getEffortLabel = () => {
    if (effortAtPR) return { text: "NEW PR!", color: "text-emerald-400", icon: Flame };
    if (effortNearPR) {
      const pct = Math.round((1 - effortRatio) * 100);
      return { text: `${pct}% to PR`, color: "text-amber-400", icon: TrendingUp };
    }
    return null;
  };

  const getPowerLabel = () => {
    if (powerAtPR) return { text: "POWER PR!", color: "text-emerald-400", icon: Zap };
    if (powerNearPR) {
      const pct = Math.round((1 - powerRatio) * 100);
      return { text: `${pct}% to power PR`, color: "text-amber-400", icon: Zap };
    }
    return null;
  };

  const effortLabel = getEffortLabel();
  const powerLabel = getPowerLabel();

  return (
    <>
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: 2 }}
              className="text-6xl font-black text-emerald-400 tracking-tighter drop-shadow-[0_0_30px_rgba(16,185,129,0.8)]"
            >
              NEW PR!
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        {effortLabel && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-1.5 rounded-full border bg-black/60 px-3 py-1 backdrop-blur ${
              effortAtPR ? "border-emerald-500/40" : "border-amber-500/30"
            }`}
          >
            <effortLabel.icon className={`w-3 h-3 ${effortLabel.color}`} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${effortLabel.color}`}>
              {effortLabel.text}
            </span>
          </motion.div>
        )}
        {powerLabel && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-1.5 rounded-full border bg-black/60 px-3 py-1 backdrop-blur ${
              powerAtPR ? "border-emerald-500/40" : "border-amber-500/30"
            }`}
          >
            <powerLabel.icon className={`w-3 h-3 ${powerLabel.color}`} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${powerLabel.color}`}>
              {powerLabel.text}
            </span>
          </motion.div>
        )}
      </div>
    </>
  );
}
