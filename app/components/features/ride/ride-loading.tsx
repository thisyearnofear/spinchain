"use client";

import { useState, useEffect } from "react";
import { Bike, Brain, Route as RouteIcon, Coins, Sparkles } from "lucide-react";

const LOADING_TIPS = [
  "Warm-up tip: keep cadence steady for better early effort scoring.",
  "Stay in control zones first, then push for sprint windows.",
  "No wallet connected? You can still ride in practice mode.",
  "Your AI coach adapts to your effort in real-time via Walrus-stored prompts.",
  "ZK proofs verify your effort without revealing raw biometric data.",
];

const LOADING_STEPS = [
  { icon: RouteIcon, label: "Loading route data", desc: "Fetching course coordinates & elevation" },
  { icon: Brain, label: "Initializing AI coach", desc: "Loading Walrus-stored system prompt" },
  { icon: Coins, label: "Setting up rewards", desc: "Configuring on-chain incentive pipeline" },
  { icon: Bike, label: "Calibrating telemetry", desc: "Preparing 10Hz sensor pipeline" },
];

interface RideLoadingProps {
  classId: string;
  isPracticeMode: boolean;
  practiceClassName?: string;
  rewardModeLabel: string;
  loadStartedAt: number;
  onPracticeMode: () => void;
  onBack: () => void;
}

export function RideLoading({
  classId,
  isPracticeMode,
  practiceClassName,
  rewardModeLabel,
  loadStartedAt,
  onPracticeMode,
  onBack,
}: RideLoadingProps) {
  const [elapsedMs, setElapsedMs] = useState(() => Date.now() - loadStartedAt);
  const isLikelyStuck = elapsedMs > 12000;

  useEffect(() => {
    const interval = setInterval(() => setElapsedMs(Date.now() - loadStartedAt), 100);
    return () => clearInterval(interval);
  }, [loadStartedAt]);

  const currentStep = Math.min(LOADING_STEPS.length - 1, Math.floor(elapsedMs / 1500));
  const tipIndex = Math.floor((elapsedMs / 3000) % LOADING_TIPS.length);

  const loadingStats = [
    {
      label: "Class",
      value: isPracticeMode
        ? practiceClassName || "Practice Ride"
        : classId.slice(0, 6).concat("…"),
    },
    {
      label: "Mode",
      value: isPracticeMode ? "Practice" : "Live Class",
    },
    ...(!isPracticeMode ? [{ label: "Rewards" as const, value: rewardModeLabel }] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-4 border-white/10 border-t-cyan-300 animate-spin" />
            <Bike className="absolute inset-0 m-auto w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <p className="text-base font-bold text-white">Preparing your ride</p>
            <p className="text-xs text-white/50">{isPracticeMode ? "Loading route and coach profile…" : "Loading route, coach, and reward pipeline…"}</p>
          </div>
        </div>

        {/* Loading steps with progress */}
        <div className="mb-5 space-y-2">
          {LOADING_STEPS.map((step, idx) => {
            const isDone = idx < currentStep;
            const isActive = idx === currentStep;
            const Icon = step.icon;
            return (
              <div
                key={step.label}
                className={`flex items-center gap-3 rounded-xl border p-2.5 transition-all duration-500 ${
                  isActive
                    ? "border-cyan-500/30 bg-cyan-500/5"
                    : isDone
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-white/5 bg-black/20 opacity-40"
                }`}
              >
                <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                  isDone ? "bg-emerald-500/20 text-emerald-400" :
                  isActive ? "bg-cyan-500/20 text-cyan-300" :
                  "bg-white/5 text-white/30"
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${isActive ? "text-white" : isDone ? "text-emerald-300" : "text-white/40"}`}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-white/40 truncate">{step.desc}</p>
                </div>
                {isDone && <span className="text-[10px] text-emerald-400 font-bold">✓</span>}
                {isActive && <div className="w-1 h-1 rounded-full bg-cyan-300 animate-pulse" />}
              </div>
            );
          })}
        </div>

        {/* Stats grid */}
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {loadingStats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-[10px] uppercase tracking-wide text-white/50">{stat.label}</p>
              <p className="mt-1 truncate text-sm font-medium text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Rotating tip */}
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3 h-3 text-cyan-300" />
            <p className="text-[11px] uppercase tracking-wide text-cyan-100/80">Rider insight</p>
          </div>
          <p className="text-sm text-cyan-50">
            {LOADING_TIPS[tipIndex]}
          </p>
        </div>

        {/* Stuck warning */}
        {isLikelyStuck && (
          <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-500/10 p-3">
            <p className="text-sm text-amber-100">
              This is taking longer than expected. If your wallet isn&apos;t connected yet, you can continue in practice mode.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={onPracticeMode}
                className="rounded-lg bg-amber-300/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-200"
              >
                Open Practice Mode
              </button>
              <button
                onClick={onBack}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:text-white"
              >
                Back to Classes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RideNotFound({ onExit }: { onExit: () => void }) {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-red-400 mb-4">Route not found</p>
        <button
          onClick={onExit}
          className="text-white/60 hover:text-white text-sm"
        >
          ← Back to classes
        </button>
      </div>
    </div>
  );
}
