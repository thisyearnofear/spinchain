"use client";

import { memo, useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { RideControls } from "./ride-controls";
import type { WorkoutPlan, IntervalPhase } from "@/app/lib/workout-plan";
import type {
  PanelState,
  PanelKey,
  WidgetMode,
} from "@/app/hooks/ui/use-panel-state";
import { Z_LAYERS } from "@/app/lib/ui/z-layers";

interface RideBottomPanelProps {
  isRiding: boolean;
  isStarting: boolean;
  rideProgress: number;
  elapsedTime: number;
  hudMode: "full" | "compact" | "minimal";
  deviceType: "mobile" | "tablet" | "desktop";
  widgetsMode: WidgetMode;
  useSimulator: boolean;
  isPracticeMode: boolean;
  isTrainingMode: boolean;
  bleConnected: boolean;
  walletConnected: boolean;
  connectionHint: string | null;
  // Focus mode control
  showIntervalBanner?: boolean;
  showAiCoach?: boolean;
  // Telemetry
  telemetryEffort: number;
  telemetryCadence: number;
  // Workout
  workoutPlan: WorkoutPlan | null;
  currentInterval: {
    phase: IntervalPhase;
    coachCue?: string;
    targetRpm?: [number, number];
    durationSeconds: number;
  } | null;
  currentIntervalIndex: number;
  intervalRemaining: number;
  // AI
  aiActive: boolean;
  agentName: string;
  reasonerState: string;
  lastDecision: {
    thoughtProcess: string;
    action?: string;
    confidence?: number;
    reasoning?: string;
  } | null;
  thoughtLog: string[];
  // Coach
  isSpeaking: boolean;
  // Panel state
  panelState: PanelState;
  // Callbacks
  onTogglePanel: (key: PanelKey) => void;
  onStartRide: () => void;
  onPauseRide: () => void;
  onSetWorkoutPlan: (plan: WorkoutPlan | null) => void;
  onSetUseSimulator: (v: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onBleMetrics: (metrics: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSimulatorMetrics: (metrics: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onHaptic: (type?: any) => any;
  formatTime: (seconds: number) => string;
}

export const RideBottomPanel = memo(function RideBottomPanel({
  isRiding,
  isStarting,
  rideProgress,
  elapsedTime,
  hudMode,
  deviceType,
  widgetsMode,
  useSimulator,
  isPracticeMode,
  isTrainingMode,
  bleConnected,
  walletConnected,
  connectionHint,
  telemetryEffort,
  telemetryCadence,
  workoutPlan,
  currentInterval,
  currentIntervalIndex,
  intervalRemaining,
  aiActive,
  agentName,
  reasonerState,
  lastDecision,
  thoughtLog,
  isSpeaking,
  panelState,
  onTogglePanel,
  onStartRide,
  onPauseRide,
  onSetWorkoutPlan,
  onSetUseSimulator,
  onBleMetrics,
  onSimulatorMetrics,
  onHaptic,
  formatTime,
}: RideBottomPanelProps) {
  const isWidgetsMinimized = widgetsMode === "minimized";
  const isWidgetsCollapsed = widgetsMode === "collapsed";
  const [desktopOffset, setDesktopOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    pointerX: number;
    pointerY: number;
  } | null>(null);

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (deviceType === "mobile" || !isRiding || isWidgetsMinimized) return;
      // Don't start drag if user clicked an interactive element (button, toggle, link)
      const target = event.target as HTMLElement;
      if (target.closest('button, a, [role="button"], input, select, textarea'))
        return;
      dragRef.current = {
        startX: desktopOffset.x,
        startY: desktopOffset.y,
        pointerX: event.clientX,
        pointerY: event.clientY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [
      desktopOffset.x,
      desktopOffset.y,
      deviceType,
      isRiding,
      isWidgetsMinimized,
    ],
  );

  const handleDragMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      const deltaX = event.clientX - dragRef.current.pointerX;
      const deltaY = event.clientY - dragRef.current.pointerY;
      setDesktopOffset({
        x: dragRef.current.startX + deltaX,
        y: Math.min(0, dragRef.current.startY + deltaY),
      });
    },
    [],
  );

  const handleDragEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    },
    [],
  );

  // Show a minimized pill during ride when widgets are minimized
  if (isRiding && isWidgetsMinimized) {
    return (
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto"
        style={{ zIndex: Z_LAYERS.widgets }}
      >
        <div className="rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-xs text-white/80 shadow-lg backdrop-blur">
          Widgets minimized (use focus control to restore)
        </div>
      </div>
    );
  }

  if (isRiding && isWidgetsCollapsed) {
    return (
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto"
        style={{ zIndex: Z_LAYERS.widgets }}
      >
        <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/75 px-3 py-1.5 text-xs text-white/80 shadow-lg backdrop-blur">
          <span>Widgets collapsed</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent pointer-events-auto safe-bottom transition-all duration-300 ${isRiding && useSimulator && deviceType === "mobile" ? "pb-52 pt-3 px-3" : "p-3 sm:p-6"} ${!isRiding && deviceType === "desktop" ? "sm:max-h-[50vh] sm:flex sm:flex-col" : ""}`}
      style={{
        zIndex: Z_LAYERS.widgets,
        ...(deviceType !== "mobile" && isRiding
          ? {
              transform: `translate(${desktopOffset.x}px, ${desktopOffset.y}px)`,
            }
          : {}),
      }}
    >
      <div
        className={`max-w-7xl mx-auto ${!isRiding && deviceType === "desktop" ? "overflow-y-auto flex-1 min-h-0" : ""}`}
      >
        {isRiding && (
          <div
            className="mb-2 flex items-center justify-between rounded-lg bg-black/40 px-3 py-1.5 text-[11px] text-white/70"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <span>
              {deviceType === "mobile" ? "Ride stats" : "Drag widgets bar"}
            </span>
          </div>
        )}

        {/* Progress Info + Interval Status */}
        {hudMode !== "minimal" && (
          <div className="mb-3 sm:mb-4">
            {/* Current Interval Banner */}
            {isRiding && currentInterval && (
              <IntervalBanner
                currentInterval={currentInterval}
                currentIntervalIndex={currentIntervalIndex}
                intervalRemaining={intervalRemaining}
                telemetryCadence={telemetryCadence}
                workoutPlan={workoutPlan}
                formatTime={formatTime}
              />
            )}

            {/* AI Feedback */}
            {isRiding && aiActive && (
              <AgentFeedback
                agentName={agentName}
                reasonerState={reasonerState}
                lastDecision={lastDecision}
                thoughtLog={thoughtLog}
              />
            )}

            {/* Main stats row */}
            <div className="flex items-center justify-between text-white">
              <div className="text-left">
                <p className="text-[10px] sm:text-sm text-white/50">Progress</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {rideProgress.toFixed(0)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] sm:text-sm text-white/50">Time</p>
                <div className="flex items-center gap-2 justify-center">
                  <p className="text-xl sm:text-2xl font-bold">
                    {formatTime(elapsedTime)}
                  </p>
                  {isRiding && (
                    <button
                      onClick={onPauseRide}
                      className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white transition-all active:scale-95 touch-manipulation"
                      aria-label="Pause ride"
                    >
                      ⏸ Pause
                    </button>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] sm:text-sm text-white/50">Effort</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-400">
                  {telemetryEffort}
                </p>
              </div>
            </div>
          </div>
        )}

        <RideControls
          isRiding={isRiding}
          isStarting={isStarting}
          rideProgress={rideProgress}
          isPracticeMode={isPracticeMode}
          isTrainingMode={isTrainingMode}
          useSimulator={useSimulator}
          deviceType={deviceType}
          workoutPlan={workoutPlan}
          bleConnected={bleConnected}
          walletConnected={walletConnected}
          canStartRide={bleConnected || useSimulator}
          startHint={connectionHint}
          onStartRide={onStartRide}
          onPauseRide={onPauseRide}
          onSetWorkoutPlan={onSetWorkoutPlan}
          onSetUseSimulator={onSetUseSimulator}
          onBleMetrics={onBleMetrics}
          onSimulatorMetrics={onSimulatorMetrics}
          onHaptic={onHaptic}
          panelState={panelState}
          onTogglePanel={onTogglePanel}
        />

        {/* Coach voice indicator */}
        {isRiding && isSpeaking && (
          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] text-indigo-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Speaking
          </div>
        )}
      </div>
    </div>
  );
});

/** Interval phase banner with RPM zone comparison */
function IntervalBanner({
  currentInterval,
  currentIntervalIndex,
  intervalRemaining,
  telemetryCadence,
  workoutPlan,
  formatTime,
}: {
  currentInterval: {
    phase: IntervalPhase;
    targetRpm?: [number, number];
    durationSeconds: number;
  };
  currentIntervalIndex: number;
  intervalRemaining: number;
  telemetryCadence: number;
  workoutPlan: WorkoutPlan | null;
  formatTime: (s: number) => string;
}) {
  const phaseColor =
    currentInterval.phase === "sprint"
      ? "bg-red-500"
      : currentInterval.phase === "interval"
        ? "bg-yellow-500"
        : currentInterval.phase === "warmup"
          ? "bg-green-500"
          : currentInterval.phase === "recovery"
            ? "bg-blue-500"
            : currentInterval.phase === "cooldown"
              ? "bg-indigo-400"
              : "bg-purple-500";

  return (
    <div className="mb-2 flex items-center justify-between rounded-lg bg-black/60 backdrop-blur border border-white/10 px-3 py-1.5">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${phaseColor}`}
        />
        <span className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wider">
          {currentInterval.phase}
        </span>
      </div>
      <span className="text-xs sm:text-sm font-mono text-white/70">
        {formatTime(Math.ceil(intervalRemaining))} left
      </span>
      {/* Coming up next */}
      {workoutPlan &&
        currentIntervalIndex < workoutPlan.intervals.length - 1 &&
        (() => {
          const next = workoutPlan.intervals[currentIntervalIndex + 1];
          return (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-white/40">
              <span>Next:</span>
              <span
                className={`font-semibold ${
                  next.phase === "sprint"
                    ? "text-red-400"
                    : next.phase === "recovery"
                      ? "text-blue-400"
                      : next.phase === "interval"
                        ? "text-yellow-400"
                        : "text-white/60"
                }`}
              >
                {next.phase}
              </span>
              <span>{formatTime(next.durationSeconds)}</span>
            </span>
          );
        })()}
      {/* Target RPM zone */}
      {currentInterval.targetRpm && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/40">RPM</span>
          <span
            className={`text-xs font-bold ${
              telemetryCadence >= currentInterval.targetRpm[0] &&
              telemetryCadence <= currentInterval.targetRpm[1]
                ? "text-green-400"
                : telemetryCadence < currentInterval.targetRpm[0]
                  ? "text-blue-400"
                  : "text-red-400"
            }`}
          >
            {telemetryCadence}
            <span className="text-white/30 font-normal">
              {" "}
              / {currentInterval.targetRpm[0]}-{currentInterval.targetRpm[1]}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

/** AI agent reasoning feedback */
function AgentFeedback({
  agentName,
  reasonerState,
  lastDecision,
  thoughtLog,
}: {
  agentName: string;
  reasonerState: string;
  lastDecision: {
    thoughtProcess: string;
    action?: string;
    confidence?: number;
    reasoning?: string;
  } | null;
  thoughtLog: string[];
}) {
  return (
    <div className="mb-2">
      <div className="rounded-xl border border-indigo-500/25 bg-black/70 backdrop-blur px-3 py-2">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="relative">
            <span className="text-sm">🧠</span>
            {reasonerState === "thinking" && (
              <motion.div
                layoutId="brain-thinking"
                className="absolute inset-0 bg-indigo-500/30 rounded-full"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
            {agentName}
          </span>
          <span
            className={`ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
              reasonerState === "thinking"
                ? "bg-amber-500/20 text-amber-300"
                : reasonerState === "acting"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-white/10 text-white/40"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                reasonerState === "thinking"
                  ? "bg-amber-400 animate-pulse"
                  : reasonerState === "acting"
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-white/30"
              }`}
            />
            {reasonerState === "thinking"
              ? "Reasoning…"
              : reasonerState === "acting"
                ? "Acting"
                : "Monitoring"}
          </span>
        </div>

        {lastDecision ? (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-white/90">
              &ldquo;{lastDecision.thoughtProcess}&rdquo;
            </p>
            {lastDecision.action && (
              <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                <span className="text-[9px] font-bold uppercase text-indigo-400/80">
                  Action:
                </span>
                <span className="text-[10px] text-emerald-300 font-mono">
                  {lastDecision.action.replace("_", " ")}
                </span>
                {lastDecision.confidence && (
                  <div className="ml-auto flex items-center gap-1">
                    <div className="w-8 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${lastDecision.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-[8px] text-white/30">
                      {Math.round(lastDecision.confidence * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : thoughtLog.length > 0 ? (
          <p className="text-[11px] leading-relaxed text-white/70 italic">
            &ldquo;{thoughtLog[0]}&rdquo;
          </p>
        ) : (
          <p className="text-[11px] text-white/40 italic">
            Analyzing telemetry stream…
          </p>
        )}
      </div>
    </div>
  );
}
