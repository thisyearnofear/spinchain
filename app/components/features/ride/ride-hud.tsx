"use client";

import { YellowRewardTicker } from "@/app/components/features/common/yellow-reward-ticker";
import type { RewardStreamState } from "@/app/hooks/rewards/use-rewards";

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
}: RideHUDProps) {
  // Don't show if minimal mode or not riding
  if (hudMode === "minimal" || (!isRiding && rideProgress === 0)) {
    return null;
  }

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

          {/* Primary Metric - Heart Rate */}
          <div className="rounded-xl bg-black/70 backdrop-blur-xl border border-white/20 p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-white/50 mb-1">Heart Rate</p>
            <p className="text-4xl font-bold text-red-400">{telemetry.heartRate}</p>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-black/60 backdrop-blur-xl border border-white/10 p-2 text-center">
              <p className="text-[10px] uppercase text-white/40">Power</p>
              <p className="text-xl font-bold text-yellow-400">{telemetry.power}</p>
            </div>
            <div className="rounded-lg bg-black/60 backdrop-blur-xl border border-white/10 p-2 text-center">
              <p className="text-[10px] uppercase text-white/40">RPM</p>
              <p className="text-xl font-bold text-blue-400">{telemetry.cadence}</p>
            </div>
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
            { label: "Heart Rate", value: telemetry.heartRate, unit: "bpm", color: "text-red-400" },
            { label: "Power", value: telemetry.power, unit: "W", color: "text-yellow-400" },
            { label: "Cadence", value: telemetry.cadence, unit: "rpm", color: "text-blue-400" },
            { label: "Speed", value: telemetry.speed.toFixed(1), unit: "km/h", color: "text-green-400" },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl bg-black/60 backdrop-blur-xl border border-white/20 p-3"
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

        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          <MetricCard label="Heart Rate" value={telemetry.heartRate} unit="bpm" color="text-red-400" />
          <MetricCard label="Power" value={telemetry.power} unit="W" color="text-yellow-400" />
          <MetricCard label="Cadence" value={telemetry.cadence} unit="rpm" color="text-blue-400" />
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
}: {
  label: string;
  value: string | number;
  unit: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 p-4 sm:p-6 min-w-[160px] sm:min-w-[180px]">
      <p className="text-xs uppercase tracking-wider text-white/50 mb-2">{label}</p>
      <p className={`text-4xl sm:text-5xl font-bold ${color}`}>
        {value}
        <span className="text-lg sm:text-xl text-white/50 ml-2">{unit}</span>
      </p>
    </div>
  );
}
