"use client";

import type { ClassWithRoute } from "@/app/hooks/evm/use-class-data";

interface RideStartScreenProps {
  classData: ClassWithRoute;
  isPracticeMode: boolean;
  effectiveIsFocus: boolean;
  canRender3d: boolean;
  onToggleViewMode: () => void;
  onStart: () => void;
}

export function RideStartScreen({
  classData,
  isPracticeMode,
  effectiveIsFocus,
  canRender3d,
  onToggleViewMode,
  onStart,
}: RideStartScreenProps) {
  const duration = classData.metadata?.duration ?? 45;
  const instructor = classData.metadata?.instructor;

  return (
    <div className="fixed inset-0 z-[65] flex flex-col items-center justify-center gap-6 pointer-events-none px-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl px-6 py-5 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300/80 mb-2">
          {isPracticeMode ? "Practice Ride" : "Class"}
        </p>
        <h2 className="text-lg font-black text-white tracking-tight leading-snug">
          {classData.metadata?.name ?? "Untitled Class"}
        </h2>
        <p className="mt-1.5 text-xs text-white/50">
          {instructor ? `${instructor} · ` : ""}
          {isPracticeMode ? "~1 min demo" : `${duration} min`}
        </p>
      </div>

      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-black/60 backdrop-blur-xl p-1">
        <button
          onClick={() => { if (!effectiveIsFocus) onToggleViewMode(); }}
          className={`rounded-full px-4 py-1.5 text-xs font-black transition-colors ${effectiveIsFocus ? "bg-white text-black shadow" : "text-white/60 hover:text-white"}`}
          aria-pressed={effectiveIsFocus}
          aria-label="Switch to 2D Focus view"
        >
          2D Focus
        </button>
        <button
          onClick={() => { if (effectiveIsFocus) onToggleViewMode(); }}
          className={`rounded-full px-4 py-1.5 text-xs font-black transition-colors flex items-center gap-1.5 ${!effectiveIsFocus ? "bg-white text-black shadow" : "text-white/60 hover:text-white"}`}
          aria-pressed={!effectiveIsFocus}
          aria-label="Switch to immersive 3D view"
        >
          3D Immersive
          {!canRender3d && <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">Low GPU</span>}
        </button>
      </div>
      <p className="pointer-events-none text-[10px] font-bold uppercase tracking-[0.3em] text-white/25">Press V to toggle · Preview updates instantly</p>

      <button
        onClick={onStart}
        className="pointer-events-auto group relative rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-10 py-4 text-base font-black text-white shadow-[0_0_60px_rgba(245,158,11,0.5)] hover:scale-105 active:scale-95 transition-transform"
        aria-label="Start ride"
      >
        Start Ride
        <span className="block text-[10px] font-bold uppercase tracking-[0.3em] text-white/60 mt-0.5">
          Keyboard: ← → / A D
        </span>
      </button>
    </div>
  );
}
