"use client";

import { useState, memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { YellowRewardTicker } from "@/app/components/features/common/yellow-reward-ticker";
import type { RewardStreamState } from "@/app/hooks/rewards/use-rewards";
import type { IntervalPhase } from "@/app/lib/workout-plan";
import type { GhostState } from "@/app/lib/analytics/ghost-service";

import { useRideFocusConfig, type MetricConfig, type MetricKey } from "@/app/hooks/ui/use-ride-focus-mode";

export interface TelemetryData {
  heartRate: number;
  power: number;
  cadence: number;
  speed: number;
  effort: number;
  currentGear?: number;
  gearRatio?: number;
  source?: "ble" | "healthkit" | "simulated";
}

// Hook to get telemetry from Zustand store in the expected format
// This provides backward compatibility while using granular subscriptions
import { useFullTelemetry } from "@/app/hooks/ride/use-telemetry-store";

export function useTelemetryData(): TelemetryData {
  const telemetry = useFullTelemetry();
  return {
    heartRate: telemetry.heartRate,
    power: telemetry.power,
    cadence: telemetry.cadence,
    speed: telemetry.speed,
    effort: telemetry.effort,
    currentGear: telemetry.currentGear,
    gearRatio: telemetry.gearRatio,
  };
}

function getMetricValue(key: MetricKey, telemetry: TelemetryData): string | number {
  switch (key) {
    case "power": return telemetry.power;
    case "heartRate": return telemetry.heartRate;
    case "cadence": return telemetry.cadence;
    case "speed": return telemetry.speed.toFixed(1);
    case "effort": return (telemetry.effort / 10).toFixed(0);
    case "gear": return telemetry.currentGear || "--";
    case "wBal": return "--"; // Not yet implemented in telemetry
    default: return "--";
  }
}

interface RideHUDProps {
  ghostState?: GhostState;
  multiGhostState?: Array<{
    id: string;
    name: string;
    leadLagTime: number;
    distanceGap: number;
    active: boolean;
  }>;
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
  targetRpm?: [number, number];
  showBottomPanel?: boolean;
}

function getPhaseAccent(phase?: IntervalPhase | null) {
  if (phase === "sprint")
    return {
      color: "text-rose-400",
      border: "border-rose-400/30",
      bg: "bg-rose-500/12",
      glow: "shadow-rose-500/20",
    };
  if (phase === "recovery" || phase === "cooldown")
    return {
      color: "text-sky-300",
      border: "border-sky-400/30",
      bg: "bg-sky-500/12",
      glow: "shadow-sky-500/20",
    };
  if (phase === "interval")
    return {
      color: "text-orange-300",
      border: "border-orange-400/30",
      bg: "bg-orange-500/12",
      glow: "shadow-orange-500/20",
    };
  if (phase === "warmup")
    return {
      color: "text-emerald-300",
      border: "border-emerald-400/30",
      bg: "bg-emerald-500/12",
      glow: "shadow-emerald-500/20",
    };
  return {
    color: "text-yellow-300",
    border: "border-yellow-400/30",
    bg: "bg-yellow-500/12",
    glow: "shadow-yellow-500/20",
  };
}

function MobileStatusBadges({
  status,
}: {
  status?: RideHUDProps["mobileBridgeStatus"];
}) {
  if (!status || (!status.isBackgroundActive && !status.isHealthKitActive))
    return null;

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

function GhostLeadLag({
  leadLagTime,
  distanceGap,
}: {
  leadLagTime: number;
  distanceGap: number;
}) {
  const isLeading = leadLagTime < 0; // Negative leadLagTime means ghost is behind (in our logic)
  const absTime = Math.abs(leadLagTime);
  const color = isLeading ? "text-emerald-400" : "text-rose-400";
  const label = isLeading ? "Lead" : "Lag";

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/20 bg-black/40 px-3 py-1.5 backdrop-blur transition-all">
      <span className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5">
        Ghost Pacer
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-lg font-black ${color} tracking-tighter`}>
          {isLeading ? "+" : "-"}
          {absTime.toFixed(1)}s
        </span>
        <span className="text-[10px] font-bold text-white/60 uppercase">
          {label}
        </span>
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 backdrop-blur shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[8px] font-black text-indigo-400/70 uppercase tracking-widest">
          Gear
        </span>
        <div className="flex gap-0.5">
          <div className="w-1 h-1 rounded-full bg-indigo-400/40" />
          <div className="w-1 h-1 rounded-full bg-indigo-400" />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-black text-indigo-300 tracking-tighter">
          {gear}
        </span>
        {ratio && (
          <span className="text-[9px] font-mono text-indigo-400/50 italic">
            {ratio.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * RideHUD - Telemetry display with responsive layouts
...
 * Shows heart rate, power, cadence, speed based on device and HUD mode
 * 
 * Desktop: Edge-docked cards (corners) for unobstructed 3D view
 * Mobile: Center overlay or compact pill
 */
export function RideHUD({
  ghostState,
  multiGhostState,
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
  targetRpm,
  showBottomPanel,
}: RideHUDProps) {
  // Subscribe directly to telemetry store — avoids parent re-render cascade
  const telemetry = useTelemetryData();
  const { metrics, centerHud } = useRideFocusConfig();
  
  // Filter and sort metrics based on config (Priority 4)
  const activeMetrics = useMemo(() => {
    return metrics
      .filter(m => m.visible && m.key !== "gear") // Gear is shown in status bar as badge
      .sort((a, b) => a.priority - b.priority);
  }, [metrics]);

  // Calculate intensity based on target RPM if available
  const rpmIntensity = useMemo(() => {
    if (!targetRpm || !telemetry.cadence) return telemetry.effort / 1000;
    const [min, max] = targetRpm;
    if (telemetry.cadence >= min && telemetry.cadence <= max) return 1.0;
    if (telemetry.cadence < min) return telemetry.cadence / min;
    return 1.0 - Math.min(0.5, (telemetry.cadence - max) / 100);
  }, [targetRpm, telemetry.cadence, telemetry.effort]);

  // Don't show if minimal mode or not riding
  if (centerHud === "none" || (!isRiding && rideProgress === 0)) {
    return null;
  }

  const phaseAccent = getPhaseAccent(intervalPhase);
  const phaseLabel = intervalPhase
    ? intervalPhase.charAt(0).toUpperCase() + intervalPhase.slice(1)
    : "Cruise";

  // Edge-docked layout for desktop (Priority 2: move cards from center to edges)
  const useEdgeDocked = deviceType === "desktop" && (hudMode === "full" || hudMode === "compact");

  // Agent Intelligence Section
  const agentInsight = (
    <div className="mt-4 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex items-center gap-2 mb-2 mt-4">
        <div className="relative">
          <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-400 absolute -top-0.5 -right-0.5 opacity-75" />
          <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-500 relative shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">
          Coach Insights
        </span>
      </div>

      <div className="relative group max-w-[280px]">
        {/* Subtle Accent Glow */}
        <div className="relative rounded-xl bg-black/60 border border-white/10 px-4 py-3 backdrop-blur shadow-2xl">
          <p className="text-[13px] text-white/90 leading-relaxed font-medium tracking-tight">
            <span className="text-indigo-400 mr-2">●</span>
            {aiLog?.message ||
              "Keep your breathing steady. You're crushing this climb!"}
          </p>

          {rewardsMode === "yellow-stream" && (
            <div className="mt-2 flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 w-fit">
              <span className="h-1 w-1 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-[8px] font-black text-yellow-400 uppercase tracking-tighter">
                Live Rewards Active
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Flow State Visualizer (Background)
  const flowStateVisualizer = (
    <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 opacity-40">
      <div
        className={`absolute inset-0 transition-all duration-1000 ${phaseAccent.bg}`}
        style={{ opacity: 0.3 + rpmIntensity * 0.4 }}
      />
      {rpmIntensity > 0.8 && (
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(255,255,255,0.05)_0%,transparent_70%)] animate-[spin_20s_linear_infinite]" />
        </div>
      )}
    </div>
  );

  // Mobile Compact Layout - Floating pill that expands on tap
  if (deviceType === "mobile" && hudMode === "compact") {
    return (
      <>
        {flowStateVisualizer}
        <MobileCompactHUD
          telemetry={telemetry}
          activeMetrics={activeMetrics}
          phaseLabel={phaseLabel}
          phaseAccent={phaseAccent}
          isRiding={isRiding}
          rewardsActive={rewardsActive}
          rewardsStreamState={rewardsStreamState}
          rewardsMode={rewardsMode}
          mobileBridgeStatus={mobileBridgeStatus}
          ghostState={ghostState}
          agentInsight={agentInsight}
          showBottomPanel={showBottomPanel}
        />
      </>
    );
  }

  // Tablet Portrait Layout
  if (deviceType === "tablet" && orientation === "portrait") {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
        {flowStateVisualizer}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {activeMetrics.map((metric, index) => (
            <div
              key={metric.key}
              className={`rounded-2xl border bg-black/60 p-4 backdrop-blur-xl transition-all duration-500 ${index === 0 ? `${phaseAccent.border} ${phaseAccent.bg} ${phaseAccent.glow}` : "border-white/10"}`}
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">
                {metric.label}
              </p>
              <p
                className={`text-4xl font-black ${metric.color} tracking-tighter`}
              >
                {getMetricValue(metric.key, telemetry)}
                <span className="text-sm text-white/20 ml-2 uppercase">
                  {metric.unit}
                </span>
              </p>
            </div>
          ))}
          <div className="flex justify-center mt-2 gap-3">
            <GearBadge
              gear={telemetry.currentGear}
              ratio={telemetry.gearRatio}
            />
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
      {flowStateVisualizer}
      <div className="flex flex-col gap-6">
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

        <div className="flex items-center justify-center gap-6">
          <div
            className={`rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-white/80 backdrop-blur-xl transition-all duration-500 ${phaseAccent.border} ${phaseAccent.bg} ${phaseAccent.glow}`}
          >
            {phaseLabel}
          </div>
          <GearBadge gear={telemetry.currentGear} ratio={telemetry.gearRatio} />
          {ghostState && (
            <GhostLeadLag
              leadLagTime={ghostState.leadLagTime}
              distanceGap={ghostState.distanceGap}
            />
          )}
          {multiGhostState && multiGhostState.length > 0 && (
            <div className="flex gap-2">
              {multiGhostState.map((ghost) => (
                <div key={ghost.id} className="relative group">
                  <div
                    className={`w-8 h-8 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-[10px] font-black ${ghost.leadLagTime < 0 ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {ghost.name.substring(0, 1)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-black border border-white/10 flex items-center justify-center text-[6px] font-bold">
                    {Math.abs(ghost.leadLagTime).toFixed(0)}s
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority 2: Edge-docked metrics for desktop (unobstructed 3D view) */}
        {useEdgeDocked ? (
          <div className="fixed inset-0 pointer-events-none">
            {/* Corner placements based on priority */}
            {activeMetrics.map((metric, idx) => {
              // Cycle through 4 corners
              const positions = [
                "top-24 left-6",
                "top-24 right-6",
                "bottom-32 left-6",
                "bottom-32 right-24"
              ];
              // Offset if stacking more than 4 metrics
              const stackOffset = Math.floor(idx / 4) * 90; 
              const posIndex = idx % 4;
              
              return (
                <div 
                  key={metric.key} 
                  className={`absolute ${positions[posIndex]} pointer-events-auto`}
                  style={{ 
                    marginTop: posIndex < 2 ? `${stackOffset}px` : "0px",
                    marginBottom: posIndex >= 2 ? `${stackOffset}px` : "0px"
                  }}
                >
                  <MetricCard
                    label={metric.label}
                    value={getMetricValue(metric.key, telemetry)}
                    unit={metric.unit}
                    color={metric.color}
                    emphasized={idx === 0}
                    intensity={idx === 0 ? rpmIntensity : 0.5}
                    compact
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:gap-8">
            {activeMetrics.map((metric, idx) => (
              <MetricCard
                key={metric.key}
                label={metric.label}
                value={getMetricValue(metric.key, telemetry)}
                unit={metric.unit}
                color={metric.color}
                emphasized={idx === 0}
                intensity={idx === 0 ? rpmIntensity : 0.5}
              />
            ))}
          </div>
        )}

        {isRiding && (
          <div className="flex justify-center mt-4">{agentInsight}</div>
        )}
      </div>
    </div>
  );
}

const MetricCard = memo(function MetricCard({
  label,
  value,
  unit,
  color,
  emphasized = false,
  intensity = 0, // 0-1 based on target proximity or effort
  compact = false, // Edge-docked compact mode for desktop
}: {
  label: string;
  value: string | number;
  unit: string;
  color: string;
  emphasized?: boolean;
  intensity?: number;
  compact?: boolean;
}) {
  // Compact mode: smaller, translucent, edge-docked
  if (compact) {
    return (
      <div
        className={`
        relative rounded-2xl overflow-hidden
        bg-black/30 backdrop-blur-xl border border-white/10
        p-4 min-w-[140px]
        transition-all duration-500
        hover:bg-black/40 hover:border-white/20
        shadow-lg
      `}
      >
        {/* Subtle glow for high intensity */}
        {intensity > 0.7 && (
          <div
            className={`absolute inset-0 opacity-10 blur-2xl ${color.replace("text-", "bg-")}`}
          />
        )}

        <div className="relative z-10">
          <p className="text-[9px] uppercase font-bold tracking-wider text-white/40 mb-1">
            {label}
          </p>
          <p className={`text-4xl font-black tracking-tight ${color}`}>
            {value}
          </p>
          <p className="text-xs font-medium text-white/30 mt-0.5 uppercase">
            {unit}
          </p>
        </div>
      </div>
    );
  }

  // Full mode: original large cards
  return (
    <div
      className={`
      relative rounded-[2rem] overflow-hidden
      bg-black/40 backdrop-blur-2xl border
      p-5 sm:p-8 min-w-[170px] sm:min-w-[210px]
      transition-all duration-500
      ${
        emphasized
          ? "border-white/20 shadow-[0_0_60px_rgba(255,255,255,0.08)] ring-1 ring-white/5"
          : "border-white/5 hover:border-white/10"
      }
    `}
    >
      {/* Dynamic Performance Halo */}
      {intensity > 0.5 && (
        <div
          className={`absolute inset-0 opacity-20 blur-3xl animate-pulse ${color.replace("text-", "bg-")}`}
          style={{
            transform: `scale(${1 + intensity * 0.2})`,
            transition: "transform 0.5s ease-out",
          }}
        />
      )}

      {/* Decorative inner glow */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="flex items-center justify-between mb-3 relative z-10">
        <p className="text-[10px] sm:text-[11px] uppercase font-black tracking-[0.3em] text-white/40">
          {label}
        </p>
        <div className="flex gap-1.5">
          <div
            className={`h-1.5 w-1.5 rounded-full ${color.replace("text-", "bg-")} shadow-[0_0_10px_currentColor]`}
          />
          {intensity > 0.8 && (
            <div
              className={`h-1.5 w-4 rounded-full ${color.replace("text-", "bg-")} animate-pulse`}
            />
          )}
        </div>
      </div>

      <div className="relative z-10">
        <p
          className={`text-5xl sm:text-7xl font-black tracking-tighter ${color} transition-all duration-300`}
        >
          {value}
          <span className="text-sm sm:text-lg font-bold text-white/20 ml-2 tracking-normal uppercase">
            {unit}
          </span>
        </p>
      </div>

      {/* Real-time data stream visualizer */}
      <div className="absolute bottom-2 left-8 right-8 h-0.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full ${color.replace("text-", "bg-")} transition-all duration-300`}
          style={{ width: `${Math.min(100, intensity * 100)}%` }}
        />
      </div>
    </div>
  );
});

// Mobile Compact HUD - Floating pill with swipe-to-cycle (no auto-cycle for performance)
function MobileCompactHUD({
  telemetry,
  activeMetrics,
  phaseLabel,
  phaseAccent,
  isRiding,
  rewardsActive,
  rewardsStreamState,
  rewardsMode,
  mobileBridgeStatus,
  ghostState,
  agentInsight,
  showBottomPanel,
}: {
  telemetry: TelemetryData;
  activeMetrics: MetricConfig[];
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
  showBottomPanel?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [visibleMetricIndex, setVisibleMetricIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null,
  );

  // No auto-cycle — user swipes/taps to cycle manually (performance improvement)
  const handleTap = () => {
    if (expanded) {
      setExpanded(false);
    } else {
      setVisibleMetricIndex((prev) => (prev + 1) % activeMetrics.length);
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
      const direction = deltaX > 0 ? 1 : -1; // Right swipe = next, left swipe = prev
      setVisibleMetricIndex((prev) => 
        (prev + direction + activeMetrics.length) % activeMetrics.length
      );
    }
    setTouchStart(null);
  };

  // Adjust index in render to avoid synchronous setState in useEffect
  const displayIndex = visibleMetricIndex >= activeMetrics.length ? 0 : visibleMetricIndex;
  const currentMetric = activeMetrics[displayIndex] || activeMetrics[0];
  if (!currentMetric) return null;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-end pointer-events-none p-4 ${showBottomPanel ? "pb-32" : "pb-12"}`}
      style={{ willChange: "transform" }}
    >
      {/* Status indicators at top - minimal - only show when expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center gap-2 mb-4 pointer-events-auto"
          >
            {/* Connection status */}
            {mobileBridgeStatus?.isBackgroundActive && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
            {/* Rewards ticker if active */}
            {rewardsActive && rewardsStreamState && rewardsMode && (
              <YellowRewardTicker
                streamState={rewardsStreamState}
                mode={rewardsMode}
                symbol="SPIN"
                compact
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main floating pill - tap to cycle/expand - more minimal on mobile */}
      <button
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`pointer-events-auto relative rounded-[2.5rem] border bg-black/80 backdrop-blur-2xl transition-all duration-500 shadow-2xl overflow-hidden ${
          expanded ? "w-full max-w-sm p-8" : "px-6 py-4"
        } ${phaseAccent.border}`}
      >
        {!expanded ? (
          // Collapsed: show single metric - more compact
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-start">
              <span
                className={`text-[9px] font-black uppercase tracking-[0.3em] opacity-40 ${currentMetric.color}`}
              >
                {currentMetric.label}
              </span>
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-3xl font-black tracking-tighter ${currentMetric.color}`}
                >
                  {getMetricValue(currentMetric.key, telemetry)}
                </span>
                <span className="text-[10px] font-bold text-white/20 uppercase">
                  {currentMetric.unit}
                </span>
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div
              className={`rounded-full px-3 py-1 text-[8px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-white/60`}
            >
              {phaseLabel}
            </div>
            {/* Swipe affordance dots */}
            <div className="flex items-center gap-1.5 ml-3">
              {activeMetrics.map((m, idx) => (
                <div
                  key={m.key}
                  className={`rounded-full transition-all duration-300 ${
                    idx === visibleMetricIndex
                      ? "w-4 h-1.5 bg-white/60"
                      : "w-1.5 h-1.5 bg-white/20"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          // Expanded: show all metrics in a grid - more compact
          <div className="flex flex-col gap-6">
            {/* Primary metric (First in active metrics) */}
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-1">
                {activeMetrics[0].label}
              </p>
              <p
                className={`text-6xl font-black tracking-tighter ${activeMetrics[0].color}`}
              >
                {getMetricValue(activeMetrics[0].key, telemetry)}
                <span className="text-base font-bold text-white/20 ml-2 uppercase">
                  {activeMetrics[0].unit}
                </span>
              </p>
              <div className="inline-block mt-2 rounded-full px-4 py-1 text-[9px] font-black uppercase tracking-[0.3em] bg-white/5 border border-white/10 text-white/60">
                {phaseLabel}
              </div>
            </div>

            {/* Secondary metrics grid (Rest of active metrics) */}
            <div className="grid grid-cols-3 gap-3">
              {activeMetrics.slice(1).map((metric) => (
                <div
                  key={metric.key}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center"
                >
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/30 mb-1">
                    {metric.label}
                  </p>
                  <p
                    className={`text-xl font-black tracking-tighter ${metric.color}`}
                  >
                    {getMetricValue(metric.key, telemetry)}
                  </p>
                </div>
              ))}
            </div>

            {/* Gear and ghost */}
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <GearBadge
                gear={telemetry.currentGear}
                ratio={telemetry.gearRatio}
              />
              {ghostState && (
                <GhostLeadLag
                  leadLagTime={ghostState.leadLagTime}
                  distanceGap={ghostState.distanceGap}
                />
              )}
            </div>
          </div>
        )}
      </button>

      {/* Agent insight at bottom - only when expanded */}
      <AnimatePresence>
        {isRiding && agentInsight && expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mt-4 pointer-events-auto"
          >
            {agentInsight}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
