"use client";

import { memo, useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RideControls } from "./ride-controls";
import type { WorkoutPlan, IntervalPhase } from "@/app/lib/workout-plan";
import type {
  PanelState,
  PanelKey,
  WidgetMode,
} from "@/app/hooks/ui/use-panel-state";
import { Z_LAYERS } from "@/app/lib/ui/z-layers";
import { useRideStore, selectRidePhase } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useUIStore } from "@/app/stores/ui-store";
import { EASE_SMOOTH } from "@/app/lib/motion";
import type { HapticType } from "@/app/hooks/use-haptic";

interface RideBottomPanelProps {
  walletConnected: boolean;
  workoutPlan: WorkoutPlan | null;
  connectionHint: string | null;
  panelState: PanelState;
  onTogglePanel: (key: PanelKey) => void;
  onSetWidgetsMode: (mode: WidgetMode) => void;
  onStartRide: () => void;
  onPauseRide: () => void;
  onSetWorkoutPlan: (plan: WorkoutPlan | null) => void;
  onSetUseSimulator: (v: boolean) => void;
  onBleMetrics: (metrics: { heartRate?: number; power?: number; cadence?: number; speed?: number; effort?: number; distance?: number; timestamp?: number }) => void;
  onSimulatorMetrics: (metrics: { heartRate: number; power: number; cadence: number; speed: number; effort: number; distance?: number; timestamp?: number }) => void;
  onHaptic: (type?: HapticType) => boolean;
  formatTime: (seconds: number) => string;
}

export const RideBottomPanel = memo(function RideBottomPanel({
  walletConnected,
  workoutPlan,
  connectionHint,
  panelState,
  onTogglePanel,
  onSetWidgetsMode,
  onStartRide,
  onPauseRide,
  onSetWorkoutPlan,
  onSetUseSimulator,
  onBleMetrics,
  onSimulatorMetrics,
  onHaptic,
  formatTime,
}: RideBottomPanelProps) {
  const phase = useRideStore(selectRidePhase);
  const isRiding = phase === "active";
  const rideProgress = useRideStore((s) => s.rideProgress);
  const elapsedTime = useRideStore((s) => s.elapsedTime);

  const hudMode = useUIStore((s) => s.hudMode);
  const deviceType = useUIStore((s) => s.deviceType);
  const widgetsMode = useUIStore((s) => s.widgetsMode);
  const useSimulator = useUIStore((s) => s.useSimulator);
  const isPracticeMode = useUIStore((s) => s.isPracticeMode);
  const isTrainingMode = useUIStore((s) => s.isTrainingMode);
  const bleConnected = useUIStore((s) => s.bleConnected);

  const telemetryEffort = useTelemetryStore((s) => s.snapshot.effort);
  const telemetryCadence = useTelemetryStore((s) => s.snapshot.cadence);

  const currentInterval = useCoachingStore((s) => s.currentInterval);
  const currentIntervalIndex = useCoachingStore((s) => s.currentIntervalIndex);
  const intervalProgress = useCoachingStore((s) => s.intervalProgress);
  const intervalRemaining = useCoachingStore((s) => s.intervalRemaining);
  const isSpeaking = useCoachingStore((s) => s.isSpeaking);
  const agentName = useCoachingStore((s) => s.currentInterval ? "Coach" : "");
  const reasonerState = useCoachingStore((s) => s.reasonerState);
  const lastDecision = useCoachingStore((s) => s.lastDecision);
  const thoughtLog = useCoachingStore((s) => s.thoughtLog);

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
      const deltaY = event.clientY - dragRef.current.pointerY;
      // Constrain to vertical-only, max 200px up
      const newY = Math.min(0, Math.max(-200, dragRef.current.startY + deltaY));
      setDesktopOffset({
        x: 0,
        y: newY,
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

  const isActivePhase = phase === "active" || phase === "paused";

  if (isActivePhase && isWidgetsMinimized) {
    return (
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto"
        style={{ zIndex: Z_LAYERS.widgets }}
      >
        <button
          onClick={() => onSetWidgetsMode("expanded")}
          className="rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-xs text-white/80 shadow-lg backdrop-blur transition-all hover:bg-black/80 active:scale-95"
          aria-label="Restore widgets"
        >
          Restore widgets
        </button>
      </div>
    );
  }

  if (isActivePhase && isWidgetsCollapsed) {
    return (
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto"
        style={{ zIndex: Z_LAYERS.widgets }}
      >
        <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/75 px-3 py-1.5 text-xs text-white/80 shadow-lg backdrop-blur">
          <span>Widgets collapsed</span>
          <button
            onClick={() => onSetWidgetsMode("expanded")}
            className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white hover:bg-white/25"
          >
            Expand
          </button>
          <button
            onClick={() => onSetWidgetsMode("minimized")}
            className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white hover:bg-white/25"
          >
            Minimize
          </button>
        </div>
      </div>
    );
  }

  const containerClass = `absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent pointer-events-auto safe-bottom transition-all duration-300 ${isRiding && useSimulator && deviceType === "mobile" ? "pb-52 pt-3 px-3" : "p-3 sm:p-6"} ${phase === "preRide" && deviceType === "desktop" ? "sm:max-h-[50vh] sm:flex sm:flex-col" : ""}`;
  const containerStyle = {
    zIndex: Z_LAYERS.widgets,
    ...(deviceType !== "mobile" && isRiding
      ? { transform: `translate(${desktopOffset.x}px, ${desktopOffset.y}px)` }
      : {}),
  } as const;

  return (
    <div className={containerClass} style={containerStyle}>
      <div className={`max-w-7xl mx-auto ${phase === "preRide" && deviceType === "desktop" ? "overflow-y-auto flex-1 min-h-0" : ""}`}>
        <AnimatePresence mode="wait">
          {/* ─── Pre-ride: Setup + Start ─── */}
          {phase === "preRide" && (
            <motion.div
              key="pre-ride"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: EASE_SMOOTH }}
            >
              <RideControls
                isRiding={false}
                isStarting={false}
                rideProgress={0}
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
            </motion.div>
          )}

          {/* ─── Starting: Loading state ─── */}
          {phase === "starting" && (
            <motion.div
              key="starting"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: EASE_SMOOTH }}
              className="flex items-center justify-center py-8"
            >
              <div className="flex items-center gap-3 text-white/70">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" opacity="0.3" />
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="15 45" opacity="0.8" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                </svg>
                <span className="text-sm font-medium">Starting ride…</span>
              </div>
            </motion.div>
          )}

          {/* ─── Active ride: Tray with stats + controls ─── */}
          {phase === "active" && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: EASE_SMOOTH }}
            >
              {/* Widget controls */}
              <div className="mb-1 flex items-center justify-center gap-2">
                <div
                  className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-[10px] text-white/50 cursor-grab active:cursor-grabbing touch-none"
                  onPointerDown={handleDragStart}
                  onPointerMove={handleDragMove}
                  onPointerUp={handleDragEnd}
                  title="Drag up to reveal more, drag down to hide"
                >
                  <span className="text-white/30 select-none" aria-hidden="true">⠿</span>
                  <span className="hidden sm:inline">Drag to reposition</span>
                </div>
                <button
                  onClick={() => onSetWidgetsMode("collapsed")}
                  className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/60 hover:bg-white/20 transition-colors"
                >
                  Collapse
                </button>
                <button
                  onClick={() => onSetWidgetsMode("minimized")}
                  className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/60 hover:bg-white/20 transition-colors"
                >
                  Minimize
                </button>
              </div>

              {hudMode !== "minimal" && (
                <div className="mb-3 sm:mb-4">
                  {/* Progress bar */}
                  <div className="mb-3 rounded-full border border-white/10 bg-black/50 p-1 shadow-lg shadow-black/30 backdrop-blur">
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
                      {workoutPlan ? (
                        workoutPlan.intervals.map((interval, i) => {
                          const widthPct = (interval.durationSeconds / workoutPlan.totalDuration) * 100;
                          const isCurrent = i === currentIntervalIndex;
                          const isComplete = i < currentIntervalIndex;
                          const phaseColor =
                            interval.phase === "sprint" ? "bg-red-500"
                              : interval.phase === "interval" ? "bg-yellow-500"
                              : interval.phase === "warmup" ? "bg-green-500"
                              : interval.phase === "recovery" ? "bg-blue-500"
                              : interval.phase === "cooldown" ? "bg-indigo-400"
                              : "bg-purple-500";
                          return (
                            <div
                              key={i}
                              className="relative h-full border-r border-black/20 last:border-r-0"
                              style={{ width: `${widthPct}%` }}
                            >
                              <div
                                className={`h-full origin-left transition-transform duration-300 ${phaseColor} ${
                                  isComplete ? "opacity-90" : isCurrent ? "opacity-75" : "opacity-20"
                                }`}
                                style={{ transform: `scaleX(${isCurrent ? intervalProgress : isComplete ? 1 : 0})` }}
                              />
                            </div>
                          );
                        })
                      ) : (
                        <div
                          className="h-full origin-left bg-gradient-to-r from-indigo-500 to-purple-500 transition-transform duration-300"
                          style={{ transform: `scaleX(${rideProgress / 100})` }}
                        />
                      )}
                    </div>
                  </div>

                  {currentInterval && (
                    <IntervalBanner
                      currentInterval={currentInterval}
                      currentIntervalIndex={currentIntervalIndex}
                      intervalRemaining={intervalRemaining}
                      telemetryCadence={telemetryCadence}
                      workoutPlan={workoutPlan}
                      formatTime={formatTime}
                    />
                  )}

                  <AgentFeedback
                    agentName={agentName}
                    reasonerState={reasonerState}
                    lastDecision={lastDecision}
                    thoughtLog={thoughtLog}
                  />

                  <div className="flex items-center justify-between text-white">
                    <div className="text-left">
                      <p className="text-[10px] sm:text-sm text-white/50">Time</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xl sm:text-2xl font-bold">
                          {formatTime(elapsedTime)}
                        </p>
                        <button
                          onClick={onPauseRide}
                          className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white transition-all active:scale-95 touch-manipulation"
                          aria-label="Pause ride"
                        >
                          ⏸ Pause
                        </button>
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

              {isSpeaking && (
                <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] text-indigo-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  Speaking
                </div>
              )}
            </motion.div>
          )}

          {/* ─── Paused: Resume prompt ─── */}
          {phase === "paused" && (
            <motion.div
              key="paused"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: EASE_SMOOTH }}
              className="flex flex-col items-center gap-4 py-6"
            >
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-1">Paused</p>
                <p className="text-3xl font-bold text-white tabular-nums">
                  {formatTime(elapsedTime)}
                </p>
                <p className="text-xs text-white/40 mt-1">
                  {Math.round(rideProgress)}% complete
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { onHaptic("medium"); onStartRide(); }}
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/50 transition-all active:scale-95 touch-manipulation"
                  aria-label="Resume ride"
                >
                  ▶ Resume
                </button>
                <button
                  onClick={onPauseRide}
                  className="rounded-full bg-white/10 px-4 py-3 text-sm font-medium text-white/60 hover:bg-white/20 transition-all active:scale-95 touch-manipulation"
                  aria-label="Exit ride"
                >
                  Exit
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

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
