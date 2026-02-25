"use client";

/**
 * RideProgress - Workout progress visualization
 * 
 * Core Principles:
 * - MODULAR: Separated from ride logic
 * - PERFORMANT: Minimal re-renders with memoized calculations
 * - CLEAN: Clear separation of data transformation and rendering
 */

import { useMemo } from "react";
import type { WorkoutInterval, WorkoutPlan } from "@/app/lib/workout-plan";
import { formatTime } from "@/app/lib/formatters";

interface RideProgressProps {
  workoutPlan: WorkoutPlan | null;
  currentIntervalIndex: number;
  intervalProgress: number;
  intervalRemaining: number;
  rideProgress: number;
  elapsedTime: number;
  telemetry: {
    heartRate: number;
    power: number;
    cadence: number;
    effort: number;
  };
  currentInterval: WorkoutInterval | null;
  isRiding: boolean;
}

// Phase color mapping - single source of truth
const PHASE_COLORS: Record<string, string> = {
  sprint: "bg-red-500",
  interval: "bg-yellow-500",
  warmup: "bg-green-500",
  recovery: "bg-blue-500",
  cooldown: "bg-indigo-400",
  default: "bg-purple-500",
};

export function RideProgress({
  workoutPlan,
  currentIntervalIndex,
  intervalProgress,
  intervalRemaining,
  rideProgress,
  elapsedTime,
  telemetry,
  currentInterval,
  isRiding,
}: RideProgressProps) {
  // Memoized phase color lookup
  const getPhaseColor = useMemo(() => {
    return (phase: string) => PHASE_COLORS[phase] || PHASE_COLORS.default;
  }, []);

  return (
    <>
      {/* Segmented Progress Bar */}
      <div className="absolute inset-x-0 bottom-0 h-2 sm:h-3 bg-black/50 flex">
        {workoutPlan ? (
          // Workout plan segments
          workoutPlan.intervals.map((interval, i) => {
            const widthPct = (interval.durationSeconds / workoutPlan.totalDuration) * 100;
            const isCurrent = i === currentIntervalIndex;
            const isComplete = i < currentIntervalIndex;
            const phaseColor = getPhaseColor(interval.phase);

            return (
              <div
                key={i}
                className="relative h-full border-r border-black/30 last:border-r-0"
                style={{ width: `${widthPct}%` }}
              >
                <div
                  className={`h-full transition-all duration-300 ${phaseColor} ${
                    isComplete ? "opacity-100" : isCurrent ? "opacity-80" : "opacity-20"
                  }`}
                  style={{ width: isCurrent ? `${intervalProgress * 100}%` : isComplete ? "100%" : "0%" }}
                />
                {isCurrent && (
                  <div
                    className="absolute top-0 right-0 bottom-0 w-0.5 bg-white animate-pulse"
                    style={{ left: `${intervalProgress * 100}%` }}
                  />
                )}
              </div>
            );
          })
        ) : (
          // Simple progress bar for free ride
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
            style={{ width: `${rideProgress}%` }}
          />
        )}
      </div>

      {/* Current Interval Banner & Stats */}
      {isRiding && (
        <div className="mb-3 sm:mb-4">
          {/* Interval Status */}
          {currentInterval && (
            <div className="mb-2 flex items-center justify-between rounded-lg bg-black/60 backdrop-blur border border-white/10 px-3 py-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${getPhaseColor(currentInterval.phase)}`}
                  aria-hidden="true"
                />
                <span className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wider">
                  {currentInterval.phase}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-mono text-white/70">
                {formatTime(Math.ceil(intervalRemaining))} left
              </span>
              {/* Target RPM Zone */}
              {currentInterval.targetRpm && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/40">RPM</span>
                  <span
                    className={`text-xs font-bold ${
                      telemetry.cadence >= currentInterval.targetRpm[0] &&
                      telemetry.cadence <= currentInterval.targetRpm[1]
                        ? "text-green-400"
                        : telemetry.cadence < currentInterval.targetRpm[0]
                          ? "text-blue-400"
                          : "text-red-400"
                    }`}
                  >
                    {telemetry.cadence}
                    <span className="text-white/30 font-normal">
                      {" "}
                      / {currentInterval.targetRpm[0]}-{currentInterval.targetRpm[1]}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Main Stats Row */}
          <div className="flex items-center justify-between text-white">
            <Stat label="Progress" value={`${rideProgress.toFixed(0)}%`} />
            <Stat label="Time" value={formatTime(elapsedTime)} />
            <Stat label="Effort" value={telemetry.effort.toString()} valueColor="text-purple-400" />
          </div>
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  valueColor = "text-white",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-[10px] sm:text-sm text-white/50">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
