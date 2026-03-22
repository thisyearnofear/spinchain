"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { Coins, ShieldCheck, Zap } from "lucide-react";

interface SettlementStreamProps {
  isActive: boolean;
  accumulated: number;
  rate: number; // tokens per second
}

export function SettlementStream({ isActive, accumulated, rate }: SettlementStreamProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number }>>([]);

  // Generate "Coin" particles that flow upwards based on the rate
  useEffect(() => {
    if (!isActive || rate <= 0) {
      setParticles([]);
      return;
    }

    const interval = setInterval(() => {
      setParticles(prev => [
        { 
          id: Date.now(), 
          x: Math.random() * 80 + 10, // 10% to 90%
          delay: Math.random() * 0.5 
        },
        ...prev
      ].slice(0, 10));
    }, Math.max(200, 1000 / (rate * 10))); // Scale frequency with rate

    return () => clearInterval(interval);
  }, [isActive, rate]);

  return (
    <div className="fixed bottom-32 left-1/2 -translate-x-1/2 pointer-events-none z-20 w-full max-w-lg h-64 overflow-hidden">
      {/* The Particle Stream */}
      <AnimatePresence>
        {isActive && particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 100, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0], y: -200, scale: [0.5, 1.2, 0.8], x: `${p.x}%` }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, ease: "easeOut", delay: p.delay }}
            className="absolute bottom-0"
          >
            <div className="p-1 rounded-full bg-yellow-500/20 border border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
              <Coins className="w-3 h-3 text-yellow-400" />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Floating Status Badge */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <div className="flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-black/80 backdrop-blur-2xl border border-yellow-500/30 shadow-[0_0_40px_rgba(234,179,8,0.15)]">
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex flex-col items-start">
                <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">Live Settlement</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-white tabular-nums">{(accumulated / 1e18).toFixed(4)}</span>
                  <span className="text-[10px] font-bold text-yellow-500">SPIN</span>
                </div>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20">
                <Zap className="w-2.5 h-2.5 text-yellow-400" />
                <span className="text-[9px] font-black text-yellow-400 tabular-nums">{(rate / 1e18 * 60).toFixed(1)}/min</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
