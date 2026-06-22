"use client";

import { useState, useRef, useEffect } from "react";
import { Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface WalletInfoTooltipProps {
  variant?: "evm" | "sui";
}

const CONTENT = {
  evm: {
    title: "Why connect a wallet?",
    body: "A wallet is like your account for blockchain apps. SpinChain uses it to track your class tickets, reward you with SPIN tokens for your effort, and process payouts to instructors. You can try demo rides without one — connect when you're ready to earn rewards.",
    label: "Rewards & Tickets",
  },
  sui: {
    title: "Why a second wallet?",
    body: "SpinChain uses two networks. This Sui wallet handles real-time ride telemetry (heart rate, power, speed) and session tracking at high speed. Your other wallet handles ticket sales and SPIN token rewards on Avalanche.",
    label: "Ride Telemetry",
  },
};

export function WalletInfoTooltip({ variant = "evm" }: WalletInfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const content = CONTENT[variant];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={`What is this? ${content.title}`}
        className="flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--muted)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--surface)]/50 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full mt-2 w-72 max-w-[90vw] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl backdrop-blur-xl p-4 z-[9999]"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--accent)]">
                  {content.label}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <h3 className="text-sm font-semibold text-[color:var(--foreground)] mb-1.5">
              {content.title}
            </h3>
            <p className="text-xs leading-relaxed text-[color:var(--muted)]">
              {content.body}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
