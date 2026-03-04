"use client";

/**
 * WorkoutPlanBuilder - Select or build a multi-interval workout plan
 *
 * Core Principles:
 * - MODULAR: Composable on top of single-ride infrastructure
 * - CLEAN: Props-based, no external state dependencies
 * - PERFORMANT: Static preset list, no unnecessary re-renders
 */

import { useState } from "react";
import { useWorkoutPlan } from "@/app/hooks/common/use-workout-plan";
import { type WorkoutPlan, type IntervalPhase } from "@/app/lib/workout-plan";
import { formatTime } from "@/app/lib/formatters";

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  moderate: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  hard: "text-red-400 border-red-400/30 bg-red-400/10",
};

const PHASE_COLORS: Record<IntervalPhase, string> = {
  warmup: "bg-blue-400/20 text-blue-300",
  endurance: "bg-green-400/20 text-green-300",
  interval: "bg-amber-400/20 text-amber-300",
  sprint: "bg-red-400/20 text-red-300",
  recovery: "bg-slate-400/20 text-slate-300",
  cooldown: "bg-blue-300/20 text-blue-200",
};

interface WorkoutPlanBuilderProps {
  onPlanSelected: (plan: WorkoutPlan) => void;
  onClose?: () => void;
}

export function WorkoutPlanBuilder({ onPlanSelected, onClose }: WorkoutPlanBuilderProps) {
  const {
    plan,
    presets,
    selectPreset,
    savePlanToWalrus,
    isSaving,
    walrusBlobId,
    error,
  } = useWorkoutPlan();

  const [activeTab, setActiveTab] = useState<"presets" | "custom">("presets");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const handleSelectPreset = (id: string) => {
    setSelectedPresetId(id);
    selectPreset(id);
  };

  const handleConfirm = () => {
    if (plan) onPlanSelected(plan);
  };

  const handleSaveToWalrus = async () => {
    if (plan) await savePlanToWalrus(plan);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-900/90 to-purple-900/90 border border-white/20 p-6 max-w-2xl w-full backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-white">Workout Plan</h2>
          <p className="text-sm text-white/50">Choose a preset or build your own</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(["presets", "custom"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all ${
              activeTab === tab
                ? "bg-white/20 text-white"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {tab === "presets" ? "Preset Plans" : "Custom Builder"}
          </button>
        ))}
      </div>

      {/* Presets Tab */}
      {activeTab === "presets" && (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {presets.map(preset => (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset.id)}
              className={`w-full text-left rounded-xl border p-4 transition-all ${
                selectedPresetId === preset.id
                  ? "border-indigo-400/60 bg-indigo-500/20"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white text-sm">{preset.name}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${DIFFICULTY_COLORS[preset.difficulty]}`}>
                  {preset.difficulty}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-white/50">
                <span>⏱ {formatTime(preset.totalDuration)}</span>
                <span>📊 {preset.intervals.length} intervals</span>
                {preset.tags.map(tag => (
                  <span key={tag} className="rounded-full bg-white/10 px-2 py-0.5">{tag}</span>
                ))}
              </div>
              {/* Interval bar */}
              <div className="mt-3 flex gap-0.5 h-2 rounded-full overflow-hidden">
                {preset.intervals.map((interval, i) => (
                  <div
                    key={i}
                    className={`${PHASE_COLORS[interval.phase].split(" ")[0]} rounded-sm`}
                    style={{ flex: interval.durationSeconds }}
                    title={`${interval.phase} — ${formatTime(interval.durationSeconds)}`}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Custom Tab */}
      {activeTab === "custom" && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-white/50 text-sm">
          <p className="mb-2">🛠 Custom interval builder</p>
          <p className="text-xs">Select a preset and modify it, or use the API:</p>
          <pre className="mt-2 text-left text-[10px] bg-black/30 rounded-lg p-3 text-emerald-300 overflow-x-auto">{`const { buildCustomPlan } = useWorkoutPlan();
buildCustomPlan("My Plan", [
  { phase: "warmup", durationSeconds: 300 },
  { phase: "sprint", durationSeconds: 30 },
  { phase: "recovery", durationSeconds: 90 },
], "hard");`}</pre>
        </div>
      )}

      {/* Selected plan detail */}
      {plan && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white">Selected: {plan.name}</span>
            <span className="text-xs text-white/40">{formatTime(plan.totalDuration)}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {plan.intervals.map((interval, i) => (
              <span
                key={i}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PHASE_COLORS[interval.phase]}`}
              >
                {interval.phase} {formatTime(interval.durationSeconds)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-3 text-xs text-red-400">⚠ {error.message}</p>
      )}

      {/* Walrus save confirmation */}
      {walrusBlobId && (
        <p className="mt-2 text-xs text-emerald-400 truncate">
          ✓ Saved to Walrus: {walrusBlobId}
        </p>
      )}

      {/* Actions */}
      <div className="mt-5 flex gap-3">
        <button
          onClick={handleSaveToWalrus}
          disabled={!plan || isSaving}
          className="rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white font-semibold transition-all hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving…" : "💾 Save to Walrus"}
        </button>
        <button
          onClick={handleConfirm}
          disabled={!plan}
          className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 text-sm text-white font-semibold shadow-lg shadow-indigo-500/40 transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start This Plan →
        </button>
      </div>
    </div>
  );
}
