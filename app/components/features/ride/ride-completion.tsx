"use client";

/**
 * RideCompletion - Post-ride summary and actions
 * 
 * Core Principles:
 * - MODULAR: Self-contained completion screen
 * - ACCESSIBLE: Focus management for modal
 * - CLEAN: Props-based, no external dependencies
 */

import { useEffect, useRef } from "react";
import { formatTime } from "@/app/lib/formatters";

interface RideCompletionProps {
  isPracticeMode: boolean;
  elapsedTime: number;
  avgHeartRate: number;
  avgPower: number;
  avgEffort: number;
  onExit: () => void;
  onDeploy?: () => void;
}

export function RideCompletion({
  isPracticeMode,
  elapsedTime,
  avgHeartRate,
  avgPower,
  avgEffort,
  onExit,
  onDeploy,
}: RideCompletionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus for accessibility
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center pointer-events-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-title"
      tabIndex={-1}
    >
      <div className="rounded-3xl bg-gradient-to-br from-indigo-900/90 to-purple-900/90 border border-white/20 p-6 sm:p-12 text-center max-w-lg w-full backdrop-blur-xl">
        {/* Success Icon */}
        <div className="h-16 w-16 sm:h-24 sm:w-24 mx-auto mb-4 sm:mb-6 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 flex items-center justify-center">
          <svg
            className="h-8 w-8 sm:h-12 sm:w-12 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Title */}
        <h2
          id="completion-title"
          className="text-3xl sm:text-4xl font-bold text-white mb-2 sm:mb-3"
        >
          {isPracticeMode ? "Practice Complete!" : "Ride Complete!"}
        </h2>
        <p className="text-lg sm:text-xl text-white/70 mb-6 sm:mb-8">
          {isPracticeMode
            ? "Great way to preview your class!"
            : `Total Time: ${formatTime(elapsedTime)}`}
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <Stat label="Avg HR" value={avgHeartRate} />
          <Stat label="Avg Power" value={`${avgPower}W`} />
          <Stat label="Effort" value={avgEffort} highlight />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={onExit}
            className="flex-1 rounded-full border border-white/20 bg-white/10 py-3 text-white font-semibold transition-all active:scale-95 touch-manipulation min-h-[56px] hover:bg-white/20"
            aria-label={isPracticeMode ? "Back to builder" : "View journey"}
          >
            {isPracticeMode ? "Back to Builder" : "View Journey"}
          </button>

          {isPracticeMode && onDeploy ? (
            <button
              onClick={onDeploy}
              className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-3 text-white font-semibold shadow-lg shadow-indigo-500/50 transition-all active:scale-95 touch-manipulation min-h-[56px] hover:opacity-90"
              aria-label="Deploy class"
            >
              Deploy Class
            </button>
          ) : (
            <button
              className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-3 text-white font-semibold shadow-lg shadow-indigo-500/50 transition-all active:scale-95 touch-manipulation min-h-[56px] hover:opacity-90"
              aria-label="Claim rewards"
            >
              Claim Rewards
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/10 p-3 sm:p-4">
      <p className="text-xs sm:text-sm text-white/50">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold ${highlight ? "text-purple-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
