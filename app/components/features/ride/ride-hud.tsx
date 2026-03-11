"use client";

import { YellowRewardTicker } from "@/app/components/features/common/yellow-reward-ticker";
import type { RewardStreamState } from "@/app/hooks/rewards/use-rewards";
import type { IntervalPhase } from "@/app/lib/workout-plan";
import type { GhostState } from "@/app/lib/analytics/ghost-service";

export interface TelemetryData {
  heartRate: number;
  power: number;
  cadence: number;
  speed: number;
  effort: number;
  currentGear?: number;
  gearRatio?: number;
  source?: 'ble' | 'healthkit' | 'simulated';
}

interface RideHUDProps {
  telemetry: TelemetryData;
  ghostState?: GhostState;
  deviceType: "mobile" | "tablet" | "desktop";
  orientation: "portrait" | "landscape";
  hudMode: "full" | "compact" | "minimal";
  isRiding: boolean;
  rideProgress: number;
  rewardsActive: boolean;
  rewardsStreamState: RewardStreamState | null;
  rewardsMode: "yellow-stream" | "zk-batch" | "sui-native";
  intervalPhase?: IntervalPhase | null;
  aiLog?: { type: string; message: string; timestamp: number } | null;
  mobileBridgeStatus?: {
    isBackgroundActive: boolean;
    isHealthKitActive: boolean;
  };
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

function MobileStatusBadges({ status }: { status?: RideHUDProps["mobileBridgeStatus"] }) {
  if (!status || (!status.isBackgroundActive && !status.isHealthKitActive)) return null;

  return (
    <div className="flex gap-2 mb-3">
      {status.isBackgroundActive && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
          <span className="h-1 w-1 rounded-full bg-indigo-400 animate-pulse" />
          Background Sync
        </div>
      )}
      {status.isHealthKitActive && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-300 uppercase tracking-wider">
          <span className="h-1 w-1 rounded-full bg-rose-400 animate-pulse" />
          HealthKit HR
        </div>
      )}
    </div>
  );
}

function GhostLeadLag({ leadLagTime, distanceGap }: { leadLagTime: number; distanceGap: number }) {
  const isLeading = leadLagTime < 0; // Negative leadLagTime means ghost is behind (in our logic)
  const absTime = Math.abs(leadLagTime);
  const color = isLeading ? "text-emerald-400" : "text-rose-400";
  const label = isLeading ? "Lead" : "Lag";

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/20 bg-black/40 px-3 py-1.5 backdrop-blur-xl transition-all">
      <span className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5">Ghost Pacer</span>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-lg font-black ${color} tracking-tighter`}>
          {isLeading ? "+" : "-"}{absTime.toFixed(1)}s
        </span>
        <span className="text-[10px] font-bold text-white/60 uppercase">{label}</span>
      </div>
      <div className="text-[9px] font-mono text-white/30">
        {Math.abs(distanceGap).toFixed(0)}m {isLeading ? "ahead" : "behind"}
      </div>
    </div>
  );
}

function GearBadge({ gear, ratio }: { gear?: number; ratio?: number }) {
  if (!gear) return null;
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 backdrop-blur-xl shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all animate-in zoom-in duration-300">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[8px] font-black text-indigo-400/70 uppercase tracking-widest">Gear</span>
        <div className="flex gap-0.5">
          <div className="w-1 h-1 rounded-full bg-indigo-400/40" />
          <div className="w-1 h-1 rounded-full bg-indigo-400" />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-black text-indigo-300 tracking-tighter">{gear}</span>
        {ratio && <span className="text-[9px] font-mono text-indigo-400/50 italic">{ratio.toFixed(2)}</span>}
      </div>
    </div>
  );
}

/**
 * RideHUD - Telemetry display with responsive layouts
...
 * Shows heart rate, power, cadence, speed based on device and HUD mode
 */
export function RideHUD({
  telemetry,
  ghostState,
  deviceType,
  orientation,
  hudMode,
  isRiding,
  rideProgress,
  rewardsActive,
  rewardsStreamState,
  rewardsMode,
  intervalPhase,
  aiLog,
  mobileBridgeStatus,
}: RideHUDProps) {
  // Don't show if minimal mode or not riding
  if (hudMode === "minimal" || (!isRiding && rideProgress === 0)) {
    return null;
  }

  const phaseAccent = getPhaseAccent(intervalPhase);
  const phaseMetrics = getPhaseMetrics(telemetry, intervalPhase);
  const phaseLabel = intervalPhase ? intervalPhase.charAt(0).toUpperCase() + intervalPhase.slice(1) : "Cruise";

  // Yellow Protocol Monitor (Technical Stats for Accelerator)
  const yellowMonitor = rewardsMode === "yellow-stream" && isRiding && (
    <div className="mt-4 flex flex-col items-center animate-in fade-in zoom-in duration-500">
      <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 backdrop-blur-md shadow-lg w-full max-w-[280px]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">
            Nitrolite Protocol v0.4
          </span>
          <div className="flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-yellow-400 animate-ping" />
            <span className="text-[8px] font-mono text-yellow-400/80">L3_LIVE</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-black/40 rounded p-1.5 border border-yellow-500/10">
            <p className="text-[8px] text-yellow-500/60 uppercase font-bold">Sequence</p>
            <p className="text-sm font-mono font-bold text-yellow-200">#{yellowSequence}</p>
          </div>
          <div className="bg-black/40 rounded p-1.5 border border-yellow-500/10">
            <p className="text-[8px] text-yellow-500/60 uppercase font-bold">Session Key</p>
            <p className="text-[9px] font-mono text-yellow-200 truncate">{sessionAddress}</p>
          </div>
        </div>
        
        <div className="mt-1.5 flex items-center justify-between text-[7px] font-mono text-yellow-500/40 uppercase">
          <span>Quorum: Unanimous (100)</span>
          <span>Settlement: EIP-712</span>
        </div>
      </div>
    </div>
  );

  // Agent Intelligence Section
  const agentInsight = (
    <div className="mt-4 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {yellowMonitor}
      <div className="flex items-center gap-2 mb-2 mt-4">
        <div className="relative">
          <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-400 absolute -top-0.5 -right-0.5 animate-ping opacity-75" />
          <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-500 relative shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">
          Neural Intelligence Stream
        </span>
      </div>

      <div className="relative group max-w-[280px]">
        {/* Tactical Border Glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 via-sky-500/20 to-indigo-500/20 rounded-xl blur opacity-30 group-hover:opacity-100 transition duration-1000"></div>

        <div className="relative rounded-xl bg-black/40 border border-indigo-500/30 px-4 py-3 backdrop-blur-2xl shadow-2xl">
          <div className="flex gap-1.5 mb-2">
            <div className="h-1 w-8 rounded-full bg-indigo-500/40" />
            <div className="h-1 w-2 rounded-full bg-indigo-500/20" />
          </div>

          <p className="text-[12px] text-indigo-100/90 leading-relaxed font-mono italic tracking-tight">
            <span className="text-indigo-400 mr-2 font-black">▶</span>
            {aiLog?.message || "DePIN for Biometrics: Optimizing Sui telemetry packets for maximum yield..."}
          </p>

          <div className="mt-2 flex justify-between items-center">
            {rewardsMode === "yellow-stream" && (
              <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                <span className="h-1 w-1 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-[8px] font-black text-yellow-400 uppercase tracking-tighter">Yellow Live</span>
              </div>
            )}
            <span className="text-[8px] font-bold text-indigo-400/50 uppercase tracking-tighter italic ml-auto">Process Node: 0xSUI_ALPHA</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Mobile Compact Layout
  if (deviceType === "mobile" && hudMode === "compact") {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-3">
        <div className="flex flex-col gap-2 w-full max-w-[200px]">
          <MobileStatusBadges status={mobileBridgeStatus} />

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

          <div className="flex justify-center -mt-1 gap-2">
            <GearBadge gear={telemetry.currentGear} ratio={telemetry.gearRatio} />
            {ghostState && (
              <GhostLeadLag 
                leadLagTime={ghostState.leadLagTime} 
                distanceGap={ghostState.distanceGap} 
              />
            )}
          </div>

          {isRiding && agentInsight}
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
          <div className="flex justify-center mt-2 gap-3">
            <GearBadge gear={telemetry.currentGear} ratio={telemetry.gearRatio} />
            {ghostState && (
              <GhostLeadLag 
                leadLagTime={ghostState.leadLagTime} 
                distanceGap={ghostState.distanceGap} 
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Desktop/Tablet Landscape Full Layout
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-center">
          <MobileStatusBadges status={mobileBridgeStatus} />
        </div>

        {rewardsActive && rewardsStreamState && (
          <div className="flex justify-center">
            <YellowRewardTicker
              streamState={rewardsStreamState}
              mode={rewardsMode}
              symbol="SPIN"
            />
          </div>
        )}

        <div className="flex items-center justify-center gap-4">
          <div className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/70 backdrop-blur ${phaseAccent.border} ${phaseAccent.bg}`}>
            {phaseLabel}
          </div>
          <GearBadge gear={telemetry.currentGear} ratio={telemetry.gearRatio} />
          {ghostState && (
            <GhostLeadLag 
              leadLagTime={ghostState.leadLagTime} 
              distanceGap={ghostState.distanceGap} 
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          <MetricCard label={phaseMetrics.primary.label} value={phaseMetrics.primary.value} unit={phaseMetrics.primary.unit} color={phaseMetrics.primary.color} emphasized />
          <MetricCard label={phaseMetrics.secondary[0].label} value={phaseMetrics.secondary[0].value} unit={phaseMetrics.secondary[0].unit} color={phaseMetrics.secondary[0].color} />
          <MetricCard label={phaseMetrics.secondary[1].label} value={phaseMetrics.secondary[1].value} unit={phaseMetrics.secondary[1].unit} color={phaseMetrics.secondary[1].color} />
          <MetricCard label="Speed" value={telemetry.speed.toFixed(1)} unit="km/h" color="text-green-400" />
        </div>

        {isRiding && (
          <div className="flex justify-center mt-2">
            {agentInsight}
          </div>
        )}
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
    <div className={`
      relative group rounded-2xl overflow-hidden
      bg-black/40 backdrop-blur-2xl border
      p-4 sm:p-6 min-w-[160px] sm:min-w-[190px]
      transition-all duration-500 hover:scale-[1.02]
      ${emphasized
        ? "border-white/30 shadow-[0_0_50px_rgba(255,255,255,0.05)] ring-1 ring-white/10"
        : "border-white/10 hover:border-white/20"}
    `}>
      {/* Decorative inner glow */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] sm:text-xs uppercase font-black tracking-[0.2em] text-white/40 drop-shadow-sm">{label}</p>
        <div className="flex gap-1">
          <span className={`h-1 w-1 rounded-full ${color.replace('text-', 'bg-')} animate-pulse opacity-50`} />
          <span className={`h-1 w-3 rounded-full ${color.replace('text-', 'bg-')} opacity-20`} />
        </div>
      </div>

      <div className="relative">
        <p className={`text-4xl sm:text-6xl font-black tracking-tighter ${color} drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]`}>
          {value}
          <span className="text-sm sm:text-base font-medium text-white/30 ml-2 tracking-normal">{unit}</span>
        </p>
      </div>

      {/* Subtle data pulse indicator at bottom */}
      <div className="absolute bottom-1 right-3 flex items-center gap-1.5 opacity-30">
        <span className="text-[8px] font-mono text-white/50 uppercase">Live</span>
        <div className="flex gap-0.5">
          {[1, 2, 3].map(i => (
            <div key={i} className={`w-0.5 h-1.5 bg-current ${color} animate-bounce`} style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
