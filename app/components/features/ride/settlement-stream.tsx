"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Coins, ShieldCheck, Zap } from "lucide-react";
import { useRideStore } from "@/app/stores/ride-store";
import { useRewardsStore } from "@/app/stores/rewards-store";

export function SettlementStream() {
  const isRiding = useRideStore((s) => s.isActive);
  const isActive = useRewardsStore((s) => s.isActive && s.mode === "yellow-stream" && isRiding);
  const accumulated = useRewardsStore((s) => Number(s.accumulatedReward));
  const rate = useRewardsStore((s) => s.streamingRate);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    if (!isActive || rate <= 0) return;
    const container = containerRef.current;
    if (!container) return;

    const interval = setInterval(() => {
      const el = document.createElement("div");
      el.className = "settlement-particle";
      el.style.left = `${10 + Math.random() * 80}%`;
      el.style.animationDelay = `${Math.random() * 0.3}s`;
      container.appendChild(el);
      nextId.current++;

      el.addEventListener("animationend", () => el.remove());

      while (container.children.length > 10) {
        container.removeChild(container.firstChild!);
      }
    }, Math.max(200, 1000 / (rate * 10)));

    return () => {
      clearInterval(interval);
      if (container) container.innerHTML = "";
    };
  }, [isActive, rate]);

  if (!isActive) return null;

  return (
    <div className="fixed bottom-32 left-1/2 -translate-x-1/2 pointer-events-none z-20 w-full max-w-lg h-64 overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
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
      </div>
    </div>
  );
}
