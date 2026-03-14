"use client";

import { memo } from "react";
import { Z_LAYERS } from "@/app/lib/ui/z-layers";

interface NoBikeModalProps {
  open: boolean;
  onEnableSimulator: () => void;
  onDismiss: () => void;
}

/**
 * NoBikeModal - Prompts user to enable keyboard simulator when no bike is connected.
 * Shown when user clicks "Start Ride" without BLE or simulator enabled.
 */
function NoBikeModalInternal({ open, onEnableSimulator, onDismiss }: NoBikeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: Z_LAYERS.modals }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-gray-900/95 backdrop-blur-xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10">
          <svg className="h-7 w-7 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>

        <h3 className="text-center text-lg font-semibold text-white mb-2">
          No Bike Connected
        </h3>
        <p className="text-center text-sm text-white/60 mb-6">
          Would you like to use keyboard controls to simulate your ride? Hold ↑ to pedal, or press ←/→ to alternate legs.
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={onEnableSimulator}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-indigo-500/50 active:scale-[0.98]"
          >
            🎮 Use Keyboard Controls
          </button>
          <button
            onClick={onDismiss}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/70 transition-all hover:bg-white/10 active:scale-[0.98]"
          >
            Connect a Bluetooth Bike Instead
          </button>
        </div>
      </div>
    </div>
  );
}

export const NoBikeModal = memo(NoBikeModalInternal);
