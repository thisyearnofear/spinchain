"use client";

import { useState, useEffect } from "react";
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

  // Agent Intelligence Section
  const agentInsight = (
    <div className="mt-4 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex items-center gap-2 mb-2 mt-4">
        <div className="relative">
          <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-400 absolute -top-0.5 -right-0.5 animate-ping opacity-75" />
          <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-500 relative shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">
          Coach Insights
        </span>
      </div>

      <div className="relative group max-w-[280px]">
        {/* Subtle Accent Glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-indigo-500/10 rounded-xl blur opacity-30"></div>

        <div className="relative rounded-xl bg-black/60 border border-white/10 px-4 py-3 backdrop-blur-2xl shadow-2xl">
          <p className="text-[13px] text-white/90 leading-relaxed font-medium tracking-tight">
            <span className="text-indigo-400 mr-2">●</span>
            {aiLog?.message || "Keep your breathing steady. You're crushing this climb!"}
          </p>

          {rewardsMode === "yellow-stream" && (
            <div className="mt-2 flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 w-fit">
              <span className="h-1 w-1 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-[8px] font-black text-yellow-400 uppercase tracking-tighter">Live Rewards Active</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Mobile Compact Layout - Floating pill that expands on tap
  if (deviceType === "mobile" && hudMode === "compact") {
    return (
      <MobileCompactHUD
        telemetry={telemetry}
        phaseMetrics={phaseMetrics}
        phaseLabel={phaseLabel}
        phaseAccent={phaseAccent}
        isRiding={isRiding}
        rewardsActive={rewardsActive}
        rewardsStreamState={rewardsStreamState}
        rewardsMode={rewardsMode}
        mobileBridgeStatus={mobileBridgeStatus}
        ghostState={ghostState}
        agentInsight={agentInsight}
      />
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

// Mobile Compact HUD - Single floating pill with expandable metrics
function MobileCompactHUD({
  telemetry,
  phaseMetrics,
  phaseLabel,
  phaseAccent,
  isRiding,
  rewardsActive,
  rewardsStreamState,
  rewardsMode,
  mobileBridgeStatus,
  ghostState,
  agentInsight,
}: {
  telemetry: TelemetryData;
  phaseMetrics: { primary: { label: string; value: number; unit: string; color: string }; secondary: { label: string; value: number; unit: string; color: string }[] };
  phaseLabel: string;
  phaseAccent: { border: string };
  isRiding: boolean;
  rewardsActive: boolean;
  rewardsStreamState?: RewardStreamState | null;
  rewardsMode?: "yellow-stream" | "zk-batch" | "sui-native";
  mobileBridgeStatus?: {
    isBackgroundActive: boolean;
    isHealthKitActive: boolean;
  };
  ghostState?: GhostState;
  agentInsight?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [visibleWidget, setVisibleWidget] = useState<"primary" | "power" | "heartrate" | "cadence">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mobile-widget-preference");
      if (saved && ["primary", "power", "heartrate", "cadence"].includes(saved)) {
        return saved as "primary" | "power" | "heartrate" | "cadence";
      }
    }
    return "primary";
  });
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  // Persist widget preference to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("mobile-widget-preference", visibleWidget);
    }
  }, [visibleWidget]);

  // Auto-cycle through widgets every 5 seconds when not expanded
  useEffect(() => {
    if (expanded || !isRiding) return;
    const interval = setInterval(() => {
      setVisibleWidget((prev) => {
        const widgets: typeof prev[] = ["primary", "power", "heartrate", "cadence"];
        const currentIdx = widgets.indexOf(prev);
        return widgets[(currentIdx + 1) % widgets.length];
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [expanded, isRiding]);

  // Tap to cycle when collapsed, long-press to expand
  const handleTap = () => {
    if (expanded) {
      setExpanded(false);
    } else {
      setVisibleWidget((prev) => {
        const widgets: typeof prev[] = ["primary", "power", "heartrate", "cadence"];
        const currentIdx = widgets.indexOf(prev);
        return widgets[(currentIdx + 1) % widgets.length];
      });
    }
  };

  // Swipe gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const deltaX = e.changedTouches[0].clientX - touchStart.x;
    const deltaY = e.changedTouches[0].clientY - touchStart.y;
    
    // Only trigger if horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      setVisibleWidget((prev) => {
        const widgets: typeof prev[] = ["primary", "power", "heartrate", "cadence"];
        const currentIdx = widgets.indexOf(prev);
        const direction = deltaX > 0 ? 1 : -1; // Right swipe = next, left swipe = prev
        const newIdx = (currentIdx + direction + widgets.length) % widgets.length;
        return widgets[newIdx];
      });
    }
    setTouchStart(null);
  };

  const metrics = [
    { key: "primary", label: phaseMetrics.primary.label, value: phaseMetrics.primary.value, color: phaseMetrics.primary.color, unit: phaseMetrics.primary.unit },
    { key: "power", label: "Power", value: `${telemetry.power || 0}`, color: "text-orange-400", unit: "W" },
    { key: "heartrate", label: "Heart Rate", value: `${telemetry.heartRate || "--"}`, color: "text-red-400", unit: "BPM" },
    { key: "cadence", label: "Cadence", value: `${telemetry.cadence || "--"}`, color: "text-cyan-400", unit: "RPM" },
  ];

  const currentMetric = metrics.find((m) => m.key === visibleWidget) || metrics[0];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none p-2 pb-8">
      {/* Status indicators at top - minimal - only show when expanded */}
      {expanded && (
        <div className="flex items-center gap-2 mb-3 pointer-events-auto">
          {/* Connection status */}
          {mobileBridgeStatus?.isBackgroundActive && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          )}
          {/* Rewards ticker if active */}
          {rewardsActive && rewardsStreamState && rewardsMode && (
            <YellowRewardTicker streamState={rewardsStreamState} mode={rewardsMode} symbol="SPIN" compact />
          )}
        </div>
      )}

      {/* Main floating pill - tap to cycle/expand - more minimal on mobile */}
      <button
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onMouseDown={() => (window as any).__longPress = setTimeout(() => setExpanded(true), 500)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onMouseUp={() => clearTimeout((window as any).__longPress)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onMouseLeave={() => clearTimeout((window as any).__longPress)}
        className={`pointer-events-auto relative rounded-full border bg-black/60 backdrop-blur-md transition-all duration-300 shadow-lg ${
          expanded ? "w-full max-w-xs p-4" : "px-3 py-2"
        } ${phaseAccent.border}`}
      >
        {!expanded ? (
          // Collapsed: show single metric - more compact
          <div className="flex items-center gap-2">
            <span className={`text-[10px] uppercase tracking-wider ${currentMetric.color}`}>{currentMetric.label}</span>
            <span className={`text-lg font-bold ${currentMetric.color}`}>
              {currentMetric.value}
              <span className="text-[10px] font-medium text-white/40 ml-0.5">{currentMetric.unit}</span>
            </span>
          </div>
        ) : (
          // Expanded: show all metrics in a grid - more compact
          <div className="flex flex-col gap-2">
            {/* Primary metric */}
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-white/50">{phaseMetrics.primary.label}</p>
              <p className={`text-3xl font-bold ${phaseMetrics.primary.color}`}>{phaseMetrics.primary.value}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">{phaseLabel}</p>
            </div>
            {/* Secondary metrics grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {phaseMetrics.secondary.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-center">
                  <p className="text-[8px] uppercase text-white/40">{metric.label}</p>
                  <p className={`text-base font-bold ${metric.color}`}>{metric.value}</p>
                </div>
              ))}
            </div>
            {/* Gear and ghost */}
            <div className="flex justify-center gap-2">
              <GearBadge gear={telemetry.currentGear} ratio={telemetry.gearRatio} />
              {ghostState && <GhostLeadLag leadLagTime={ghostState.leadLagTime} distanceGap={ghostState.distanceGap} />}
            </div>
            {/* Collapse hint */}
            <p className="text-center text-[8px] text-white/30">Tap to collapse</p>
          </div>
        )}
      </button>

      {/* Agent insight at bottom - only when expanded */}
      {isRiding && agentInsight && expanded && (
        <div className="mt-2 pointer-events-auto">
          {agentInsight}
        </div>
      )}
    </div>
  );
}
