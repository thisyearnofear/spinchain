"use client";

import { DeviceSelector } from "@/app/components/features/ble/device-selector";
import { PedalSimulator } from "@/app/components/features/common/pedal-simulator";
import { CollapseToggle } from "@/app/components/features/common/collapse-toggle";
import { PRESET_WORKOUTS, type WorkoutPlan } from "@/app/lib/workout-plan";
import type { PanelState, PanelKey } from "@/app/hooks/ui/use-panel-state";

interface RideControlsProps {
  isRiding: boolean;
  isStarting: boolean;
  rideProgress: number;
  isPracticeMode: boolean;
  isTrainingMode?: boolean;
  useSimulator: boolean;
  deviceType: "mobile" | "tablet" | "desktop";
  workoutPlan: WorkoutPlan | null;
  bleConnected: boolean;
  walletConnected?: boolean;
  canStartRide?: boolean;
  startHint?: string | null;
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
  // Haptic feedback callback for mobile
  onHaptic?: (type: "light" | "medium" | "heavy" | "success" | "warning" | "error") => void;
  // Collapsible panel state
  panelState?: PanelState;
  onTogglePanel?: (key: PanelKey) => void;
}

/**
 * RideControls - Pre-ride setup and ride controls
 * Includes workout plan selector, input mode toggle, and start/pause buttons
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Extended with collapsible behavior
 * - DRY: Uses shared CollapseToggle component
 */
export function RideControls({
  isRiding,
  isStarting,
  rideProgress,
  isPracticeMode,
  isTrainingMode,
  useSimulator,
  deviceType,
  workoutPlan,
  bleConnected,
  walletConnected,
  canStartRide = true,
  startHint,
  onStartRide,
  onPauseRide: _onPauseRide,
  onSetWorkoutPlan,
  onSetUseSimulator,
  onBleMetrics,
  onSimulatorMetrics,
  onHaptic,
  panelState,
  onTogglePanel,
}: RideControlsProps) {
  // Default to expanded if no panel state provided (backward compatible)
  const isWorkoutExpanded = panelState?.workoutPlan ?? true;
  const isInputModeExpanded = panelState?.inputMode ?? true;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Pre-ride Setup */}
      {!isRiding && rideProgress === 0 && (
        <div className="mb-4 max-w-sm mx-auto space-y-3">
          {/* Workout Plan Selector */}
          <WorkoutSelector
            workoutPlan={workoutPlan}
            onSelect={onSetWorkoutPlan}
            isCollapsed={!isWorkoutExpanded}
            onToggle={() => onTogglePanel?.('workoutPlan')}
          />

          {/* Input Mode Toggle */}
          <InputModeSelector
            useSimulator={useSimulator}
            deviceType={deviceType}
            onSelect={onSetUseSimulator}
            isTrainingMode={isTrainingMode}
            walletConnected={walletConnected}
            isCollapsed={!isInputModeExpanded}
            onToggle={() => onTogglePanel?.('inputMode')}
          />

          {/* BLE Device Selector - only shown when not using simulator */}
          {!useSimulator && (
            <DeviceSelector
              onMetricsUpdate={onBleMetrics}
              className="bg-black/80 backdrop-blur-xl border-white/10"
            />
          )}
        </div>
      )}

      {/* Main Controls - Start/Resume only; Pause is shown inline with the Time stat during a ride */}
      {!isRiding && (
        <div className="flex items-center justify-center gap-3 sm:sticky sm:bottom-0 sm:pt-3 sm:pb-1 sm:bg-gradient-to-t sm:from-black/80 sm:to-transparent">
          <button
            onClick={() => {
              onHaptic?.("medium");
              onStartRide();
            }}
            disabled={isStarting || !canStartRide}
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
        </div>
      )}

      {/* BLE Status */}
      {bleConnected && (
        <div className="mt-3 flex items-center justify-center gap-2 text-green-400 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
          Live telemetry connected
        </div>
      )}

      {startHint && (
        <div className="mt-2 text-center text-xs text-amber-300">
          {startHint}
        </div>
      )}

      {/* Pedal Simulator */}
      {useSimulator && (
        <PedalSimulator isActive={isRiding} onMetricsUpdate={onSimulatorMetrics} />
      )}
    </div>
  );
}

interface CollapsiblePanelProps {
  isCollapsed: boolean;
  onToggle?: () => void;
}

function WorkoutSelector({
  workoutPlan,
  onSelect,
  isCollapsed,
  onToggle,
}: {
  workoutPlan: WorkoutPlan | null;
  onSelect: (plan: WorkoutPlan | null) => void;
} & CollapsiblePanelProps) {
  // Collapsed preview badge
  if (isCollapsed) {
    return (
      <button
        onClick={onToggle}
        className="w-full rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        aria-label="Expand Workout Plan"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-white/50">Workout Plan</span>
          {workoutPlan && (
            <span className="text-xs text-indigo-400 font-medium">
              {workoutPlan.name}
            </span>
          )}
          {!workoutPlan && (
            <span className="text-xs text-white/40">Free Ride</span>
          )}
        </div>
        <CollapseToggle
          isCollapsed={true}
          onToggle={() => {}}
          label="Workout Plan"
        />
      </button>
    );
  }

  return (
    <div
      className="rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 p-3"
      id="workout-plan-panel"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-white/50">Workout Plan</p>
        <CollapseToggle
          isCollapsed={false}
          onToggle={onToggle ?? (() => {})}
          label="Workout Plan"
        />
      </div>
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
  isCollapsed,
  onToggle,
  isTrainingMode,
  walletConnected,
}: {
  useSimulator: boolean;
  deviceType: string;
  onSelect: (use: boolean) => void;
  isTrainingMode?: boolean;
  walletConnected?: boolean;
} & CollapsiblePanelProps) {
  // Determine help text based on mode
  const getHelpText = () => {
    if (useSimulator) {
      if (deviceType === "mobile") {
        return isTrainingMode ? "Training mode - no rewards earned" : "Tap buttons to pedal";
      }
      return isTrainingMode ? "Training mode - no rewards earned" : "Use arrow keys to pedal";
    }
    return "Connect your bike via Bluetooth";
  };

  // Collapsed preview badge
  if (isCollapsed) {
    return (
      <button
        onClick={onToggle}
        className="w-full rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        aria-label="Expand Input Mode"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-white/50">Input Mode</span>
          <span className="text-xs">
            {useSimulator ? (isTrainingMode ? '🎯 Training Mode' : '⌨️ Simulator') : '🚴 BLE Device'}
          </span>
        </div>
        <CollapseToggle
          isCollapsed={true}
          onToggle={() => {}}
          label="Input Mode"
        />
      </button>
    );
  }

  return (
    <div
      className="rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 p-3"
      id="input-mode-panel"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-white/50">Input Mode</p>
        <CollapseToggle
          isCollapsed={false}
          onToggle={onToggle ?? (() => {})}
          label="Input Mode"
        />
      </div>
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
          {isTrainingMode ? '🎯 Training Mode' : '⌨️ Simulator'}
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-white/40">
        {getHelpText()}
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
