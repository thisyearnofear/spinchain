"use client";

import { DeviceSelector } from "@/app/components/features/ble/device-selector";
import { PedalSimulator } from "@/app/components/features/common/pedal-simulator";
import { PRESET_WORKOUTS, type WorkoutPlan } from "@/app/lib/workout-plan";
import { formatTime } from "@/app/lib/formatters";

interface RideControlsProps {
  isRiding: boolean;
  isStarting: boolean;
  rideProgress: number;
  isPracticeMode: boolean;
  useSimulator: boolean;
  deviceType: "mobile" | "tablet" | "desktop";
  workoutPlan: WorkoutPlan | null;
  bleConnected: boolean;
  onStartRide: () => void;
  onPauseRide: () => void;
  onSetWorkoutPlan: (plan: WorkoutPlan | null) => void;
  onSetUseSimulator: (use: boolean) => void;
  onBleMetrics: (metrics: {
    heartRate?: number;
    power?: number;
    cadence?: number;
    speed?: number;
    effort?: number;
  }) => void;
  onSimulatorMetrics: (metrics: {
    heartRate: number;
    power: number;
    cadence: number;
    speed: number;
    effort: number;
  }) => void;
}

/**
 * RideControls - Pre-ride setup and ride controls
 * Includes workout plan selector, input mode toggle, and start/pause buttons
 */
export function RideControls({
  isRiding,
  isStarting,
  rideProgress,
  isPracticeMode,
  useSimulator,
  deviceType,
  workoutPlan,
  bleConnected,
  onStartRide,
  onPauseRide,
  onSetWorkoutPlan,
  onSetUseSimulator,
  onBleMetrics,
  onSimulatorMetrics,
}: RideControlsProps) {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Pre-ride Setup */}
      {!isRiding && rideProgress === 0 && (
        <div className="mb-4 max-w-sm mx-auto space-y-3">
          {/* Workout Plan Selector */}
          <WorkoutSelector
            workoutPlan={workoutPlan}
            onSelect={onSetWorkoutPlan}
          />

          {/* Input Mode Toggle - Practice Mode Only */}
          {isPracticeMode && (
            <InputModeSelector
              useSimulator={useSimulator}
              deviceType={deviceType}
              onSelect={onSetUseSimulator}
            />
          )}

          {/* BLE Device Selector */}
          {(!isPracticeMode || !useSimulator) && (
            <DeviceSelector
              onMetricsUpdate={onBleMetrics}
              className="bg-black/80 backdrop-blur-xl border-white/10"
            />
          )}
        </div>
      )}

      {/* Main Controls */}
      <div className="flex items-center justify-center gap-3">
        {!isRiding ? (
          <button
            onClick={onStartRide}
            disabled={isStarting}
            className="relative rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white shadow-lg shadow-indigo-500/50 transition-all active:scale-95 touch-manipulation min-h-[56px] disabled:opacity-80 disabled:cursor-not-allowed"
            aria-label={rideProgress > 0 ? "Resume ride" : "Start ride"}
          >
            {isStarting ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                <span>Starting...</span>
              </span>
            ) : (
              <span>{rideProgress > 0 ? "Resume" : "Start Ride"}</span>
            )}
          </button>
        ) : (
          <button
            onClick={onPauseRide}
            className="rounded-full bg-white/20 backdrop-blur px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white transition-all active:scale-95 touch-manipulation min-h-[56px]"
            aria-label="Pause ride"
          >
            Pause
          </button>
        )}
      </div>

      {/* BLE Status */}
      {bleConnected && (
        <div className="mt-3 flex items-center justify-center gap-2 text-green-400 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
          Live telemetry connected
        </div>
      )}

      {/* Pedal Simulator - Practice Mode Only */}
      {isPracticeMode && useSimulator && (
        <PedalSimulator isActive={isRiding} onMetricsUpdate={onSimulatorMetrics} />
      )}
    </div>
  );
}

function WorkoutSelector({
  workoutPlan,
  onSelect,
}: {
  workoutPlan: WorkoutPlan | null;
  onSelect: (plan: WorkoutPlan | null) => void;
}) {
  return (
    <div className="rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 p-3">
      <p className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Workout Plan</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PRESET_WORKOUTS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-95 touch-manipulation ${
              workoutPlan?.id === preset.id
                ? "bg-indigo-500 text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
            aria-pressed={workoutPlan?.id === preset.id}
          >
            {preset.name}
          </button>
        ))}
        <button
          onClick={() => onSelect(null)}
          className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-95 touch-manipulation ${
            !workoutPlan ? "bg-indigo-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"
          }`}
          aria-pressed={!workoutPlan}
        >
          Free Ride
        </button>
      </div>
      {workoutPlan && (
        <p className="mt-1.5 text-[10px] text-white/40">
          {workoutPlan.intervals.length} intervals · {Math.round(workoutPlan.totalDuration / 60)} min ·{" "}
          {workoutPlan.difficulty}
        </p>
      )}
    </div>
  );
}

function InputModeSelector({
  useSimulator,
  deviceType,
  onSelect,
}: {
  useSimulator: boolean;
  deviceType: string;
  onSelect: (use: boolean) => void;
}) {
  return (
    <div className="rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 p-3">
      <p className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Input Mode</p>
      <div className="flex gap-2">
        <button
          onClick={() => onSelect(false)}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all active:scale-95 touch-manipulation ${
            !useSimulator ? "bg-indigo-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"
          }`}
          aria-pressed={!useSimulator}
        >
          🚴 BLE Device
        </button>
        <button
          onClick={() => onSelect(true)}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all active:scale-95 touch-manipulation ${
            useSimulator ? "bg-indigo-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"
          }`}
          aria-pressed={useSimulator}
        >
          ⌨️ Simulator
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-white/40">
        {useSimulator
          ? deviceType === "mobile"
            ? "Tap buttons to pedal"
            : "Use arrow keys to pedal"
          : "Connect your bike via Bluetooth"}
      </p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" opacity="0.3" />
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="15 45" opacity="0.8" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
