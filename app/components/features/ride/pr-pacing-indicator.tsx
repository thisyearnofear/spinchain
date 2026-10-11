"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Zap, TrendingUp, Flame } from "lucide-react";
import { springSnappy } from "@/app/lib/motion";
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
  // PR events counted, not just a boolean: the flash is keyed on the count so
  // a second (and third) PR in one ride re-celebrates instead of being deduped.
  const [prCount, setPrCount] = useState(0);
  const lastEffortRef = useRef(0);

  useEffect(() => {
    if (!isActive || !prs) return;
    if (
      currentEffort > 0 &&
      prs.bestEffort > 0 &&
      currentEffort >= prs.bestEffort &&
      lastEffortRef.current < prs.bestEffort
    ) {
      setPrCount((c) => c + 1);
    }
    lastEffortRef.current = currentEffort;
  }, [currentEffort, prs, isActive]);

  useEffect(() => {
    if (prCount === 0) return;
    setShowFlash(true);
    const timer = setTimeout(() => setShowFlash(false), 2000);
    return () => clearTimeout(timer);
  }, [prCount]);

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
          <m.div
            key={`pr-flash-${prCount}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center"
          >
            <m.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: 2 }}
              className="text-6xl font-black text-emerald-400 tracking-tighter drop-shadow-[0_0_30px_rgba(16,185,129,0.8)]"
            >
              NEW PR!
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        {/* Chips swap "X% to PR" ↔ "NEW PR!" through AnimatePresence keyed on the
            at/near state (not the % text — that would remount every commit). */}
        <AnimatePresence mode="popLayout" initial={false}>
          {effortLabel && (
            <m.div
              key={effortAtPR ? "effort-at" : "effort-near"}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={springSnappy}
              className={`flex items-center gap-1.5 rounded-full border bg-black/60 px-3 py-1 backdrop-blur ${
                effortAtPR ? "border-emerald-500/40" : "border-amber-500/30"
              }`}
            >
              <effortLabel.icon className={`w-3 h-3 ${effortLabel.color}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${effortLabel.color}`}>
                {effortLabel.text}
              </span>
            </m.div>
          )}
          {powerLabel && (
            <m.div
              key={powerAtPR ? "power-at" : "power-near"}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={springSnappy}
              className={`flex items-center gap-1.5 rounded-full border bg-black/60 px-3 py-1 backdrop-blur ${
                powerAtPR ? "border-emerald-500/40" : "border-amber-500/30"
              }`}
            >
              <powerLabel.icon className={`w-3 h-3 ${powerLabel.color}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${powerLabel.color}`}>
                {powerLabel.text}
              </span>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
