"use client";

import { Bluetooth, BluetoothConnected, BluetoothSearching } from "lucide-react";
import type { ClassWithRoute } from "@/app/hooks/evm/use-class-data";

export interface RideStartBike {
  connected: boolean;
  pending: boolean;
  failed: boolean;
  name?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

interface RideStartScreenProps {
  classData: ClassWithRoute;
  isPracticeMode: boolean;
  effectiveIsFocus: boolean;
  canRender3d: boolean;
  onToggleViewMode: () => void;
  onStart: () => void;
  /** Practice-mode duration selector */
  practiceDurationSec?: number;
  onPracticeDurationChange?: (sec: number) => void;
  /** Touch device: pedal with the on-screen L / R pads, no keyboard. */
  isTouch?: boolean;
  /** Bluetooth pairing; omitted where this browser has no Bluetooth. */
  bike?: RideStartBike;
}

export function RideStartScreen({
  classData,
  isPracticeMode,
  effectiveIsFocus,
  canRender3d,
  onToggleViewMode,
  onStart,
  practiceDurationSec = 45,
  onPracticeDurationChange,
  isTouch = false,
  bike,
}: RideStartScreenProps) {
  const duration = classData.metadata?.duration ?? 45;
  const instructor = classData.metadata?.instructor;

  return (
    <div className="fixed inset-0 z-[65] flex flex-col items-center justify-center gap-6 pointer-events-none px-4">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl px-6 py-5 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[color:var(--accent)]/80 mb-2">
          {isPracticeMode ? "Practice Ride" : "Class"}
        </p>
        <h2 className="text-lg font-black text-white tracking-tight leading-snug">
          {classData.metadata?.name ?? "Untitled Class"}
        </h2>
        <p className="mt-1.5 text-xs text-white/50">
          {instructor ? `${instructor} · ` : ""}
          {isPracticeMode ? `${practiceDurationSec}s demo` : `${duration} min`}
        </p>
      </div>

      {/* Practice duration selector */}
      {isPracticeMode && onPracticeDurationChange && (
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-black/60 backdrop-blur-xl p-1">
          {[45, 120, 300].map((sec) => (
            <button
              key={sec}
              onClick={() => onPracticeDurationChange(sec)}
              className={`rounded-full px-4 py-1.5 text-xs font-black transition-colors ${
                practiceDurationSec === sec
                  ? "bg-[color:var(--accent)] text-black shadow"
                  : "text-white/60 hover:text-white"
              }`}
              aria-pressed={practiceDurationSec === sec}
            >
              {sec === 45 ? "45 s" : sec === 120 ? "2 min" : "5 min"}
            </button>
          ))}
        </div>
      )}

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
      <p className="pointer-events-none text-[10px] font-bold uppercase tracking-[0.3em] text-white/25">{isTouch ? "Preview updates instantly" : "Press V to toggle · Preview updates instantly"}</p>

      {bike && (
        <div className="pointer-events-auto flex flex-col items-center gap-1.5">
          {bike.connected ? (
            <div className="flex items-center gap-1 rounded-full border border-emerald-400/30 bg-black/60 backdrop-blur-xl p-1 pl-3">
              <BluetoothConnected className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
              <span className="px-1.5 text-xs font-black text-white" data-testid="bike-status">
                {bike.name ?? "Bike"} connected
              </span>
              <button
                onClick={bike.onDisconnect}
                className="rounded-full px-3 py-1.5 text-xs font-bold text-white/60 hover:text-white transition-colors"
                aria-label="Disconnect bike"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={bike.onConnect}
              disabled={bike.pending}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 backdrop-blur-xl px-4 py-2 text-xs font-black text-white/80 hover:text-white transition-colors disabled:cursor-wait disabled:opacity-60"
              aria-label="Connect bike"
            >
              {bike.pending ? (
                <BluetoothSearching className="h-3.5 w-3.5 animate-pulse" aria-hidden />
              ) : (
                <Bluetooth className="h-3.5 w-3.5" aria-hidden />
              )}
              {bike.pending ? "Searching for bike…" : "Connect bike"}
            </button>
          )}
          {bike.failed && !bike.connected && !bike.pending && (
            <p className="text-[10px] font-bold text-amber-300/80" role="status">
              {isPracticeMode
                ? "Couldn't connect — you can still pedal with the keyboard"
                : "Couldn't connect — check the bike is awake and nearby"}
            </p>
          )}
        </div>
      )}

      <button
        onClick={onStart}
        className="pointer-events-auto group relative rounded-full bg-[color:var(--accent)] px-10 py-4 text-base font-black text-black shadow-[0_0_60px_var(--glow)] hover:scale-105 hover:bg-[color:var(--accent-strong)] active:scale-95 transition-[transform,background-color]"
        aria-label="Start ride"
      >
        Start Ride
        <span className="block text-[10px] font-bold uppercase tracking-[0.3em] text-black/60 mt-0.5">
          {bike?.connected ? "Pedal your bike to ride" : isTouch ? "Tap L / R to pedal" : "Keyboard: ← → / A D"}
        </span>
      </button>
    </div>
  );
}
