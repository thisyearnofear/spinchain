"use client";

import { YellowRewardTicker } from "@/app/components/features/common/yellow-reward-ticker";
import type { RewardStreamState } from "@/app/hooks/rewards/use-rewards";
import type { IntervalPhase } from "@/app/lib/workout-plan";

export interface TelemetryData {
  heartRate: number;
  power: number;
  cadence: number;
  speed: number;
  effort: number;
}

interface RideHUDProps {
  telemetry: TelemetryData;
  deviceType: "mobile" | "tablet" | "desktop";
  orientation: "portrait" | "landscape";
  hudMode: "full" | "compact" | "minimal";
  isRiding: boolean;
  rideProgress: number;
  rewardsActive: boolean;
  rewardsStreamState: RewardStreamState | null;
  rewardsMode: "yellow-stream" | "zk-batch" | "sui-native";
  intervalPhase?: IntervalPhase | null;
}

function getPhaseAccent(phase?: IntervalPhase | null) {
  if (phase === "sprint") return { color: "text-rose-400", border: "border-rose-400/30", bg: "bg-rose-500/12" };
  if (phase === "recovery" || phase === "cooldown") return { color: "text-sky-300", border: "border-sky-400/30", bg: "bg-sky-500/12" };
  if (phase === "interval") return { color: "text-orange-300", border: "border-orange-400/30", bg: "bg-orange-500/12" };
  if (phase === "warmup") return { color: "text-emerald-300", border: "border-emerald-400/30", bg: "bg-emerald-500/12" };
  return { color: "text-yellow-300", border: "border-yellow-400/30", bg: "bg-yellow-500/12" };
}

function getPhaseMetrics(telemetry: TelemetryData, phase?: IntervalPhase | null) {
  if (phase === "sprint") {
    return {
      primary: { label: "Cadence", value: telemetry.cadence, unit: "rpm", color: "text-blue-300" },
      secondary: [
        { label: "Power", value: telemetry.power, unit: "W", color: "text-yellow-300" },
        { label: "Heart Rate", value: telemetry.heartRate, unit: "bpm", color: "text-rose-300" },
      ],
    };
  }

  if (phase === "recovery" || phase === "cooldown") {
    return {
      primary: { label: "Heart Rate", value: telemetry.heartRate, unit: "bpm", color: "text-sky-300" },
      secondary: [
        { label: "Cadence", value: telemetry.cadence, unit: "rpm", color: "text-blue-300" },
        { label: "Power", value: telemetry.power, unit: "W", color: "text-yellow-300" },
      ],
    };
  }

  return {
    primary: { label: "Power", value: telemetry.power, unit: "W", color: "text-yellow-300" },
    secondary: [
      { label: "Heart Rate", value: telemetry.heartRate, unit: "bpm", color: "text-rose-300" },
      { label: "Cadence", value: telemetry.cadence, unit: "rpm", color: "text-blue-300" },
    ],
  };
}

/**
 * RideHUD - Telemetry display with responsive layouts
 * Shows heart rate, power, cadence, speed based on device and HUD mode
 */
export function RideHUD({
  telemetry,
  deviceType,
  orientation,
  hudMode,
  isRiding,
  rideProgress,
  rewardsActive,
  rewardsStreamState,
  rewardsMode,
  intervalPhase,
}: RideHUDProps) {
  // Don't show if minimal mode or not riding
  if (hudMode === "minimal" || (!isRiding && rideProgress === 0)) {
    return null;
  }

  const phaseAccent = getPhaseAccent(intervalPhase);
  const phaseMetrics = getPhaseMetrics(telemetry, intervalPhase);
  const phaseLabel = intervalPhase ? intervalPhase.charAt(0).toUpperCase() + intervalPhase.slice(1) : "Cruise";

  // Mobile Compact Layout
  if (deviceType === "mobile" && hudMode === "compact") {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-3">
        <div className="flex flex-col gap-2 w-full max-w-[200px]">
          {rewardsActive && rewardsStreamState && (
            <YellowRewardTicker
              streamState={rewardsStreamState}
              mode={rewardsMode}
              symbol="SPIN"
              compact
            />
          )}

          <div className={`rounded-xl border bg-black/70 p-4 text-center backdrop-blur-xl ${phaseAccent.border}`}>
            <p className="mb-1 text-xs uppercase tracking-wider text-white/50">{phaseMetrics.primary.label}</p>
            <p className={`text-4xl font-bold ${phaseMetrics.primary.color}`}>{phaseMetrics.primary.value}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/45">{phaseLabel}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {phaseMetrics.secondary.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-white/10 bg-black/60 p-2 text-center backdrop-blur-xl">
                <p className="text-[10px] uppercase text-white/40">{metric.label}</p>
                <p className={`text-xl font-bold ${metric.color}`}>{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Tablet Portrait Layout
  if (deviceType === "tablet" && orientation === "portrait") {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {[
            phaseMetrics.primary,
            ...phaseMetrics.secondary,
            { label: "Speed", value: telemetry.speed.toFixed(1), unit: "km/h", color: "text-green-400" },
          ].map((metric, index) => (
            <div
              key={metric.label}
              className={`rounded-xl border bg-black/60 p-3 backdrop-blur-xl ${index === 0 ? `${phaseAccent.border} ${phaseAccent.bg}` : "border-white/20"}`}
            >
              <p className="text-xs uppercase tracking-wider text-white/50 mb-1">{metric.label}</p>
              <p className={`text-3xl font-bold ${metric.color}`}>
                {metric.value}
                <span className="text-sm text-white/50 ml-2">{metric.unit}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Desktop/Tablet Landscape Full Layout
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
      <div className="flex flex-col gap-4">
        {rewardsActive && rewardsStreamState && (
          <div className="flex justify-center">
            <YellowRewardTicker
              streamState={rewardsStreamState}
              mode={rewardsMode}
              symbol="SPIN"
            />
          </div>
        )}

        <div className="flex items-center justify-center">
          <div className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/70 backdrop-blur ${phaseAccent.border} ${phaseAccent.bg}`}>
            {phaseLabel}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          <MetricCard label={phaseMetrics.primary.label} value={phaseMetrics.primary.value} unit={phaseMetrics.primary.unit} color={phaseMetrics.primary.color} emphasized />
          <MetricCard label={phaseMetrics.secondary[0].label} value={phaseMetrics.secondary[0].value} unit={phaseMetrics.secondary[0].unit} color={phaseMetrics.secondary[0].color} />
          <MetricCard label={phaseMetrics.secondary[1].label} value={phaseMetrics.secondary[1].value} unit={phaseMetrics.secondary[1].unit} color={phaseMetrics.secondary[1].color} />
          <MetricCard label="Speed" value={telemetry.speed.toFixed(1)} unit="km/h" color="text-green-400" />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  color,
  emphasized = false,
}: {
  label: string;
  value: string | number;
  unit: string;
  color: string;
  emphasized?: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-black/60 backdrop-blur-xl border p-4 sm:p-6 min-w-[160px] sm:min-w-[180px] ${emphasized ? "border-white/35 shadow-[0_0_40px_rgba(255,255,255,0.08)]" : "border-white/20"}`}>
      <p className="text-xs uppercase tracking-wider text-white/50 mb-2">{label}</p>
      <p className={`text-4xl sm:text-5xl font-bold ${color}`}>
        {value}
        <span className="text-lg sm:text-xl text-white/50 ml-2">{unit}</span>
      </p>
    </div>
  );
}
