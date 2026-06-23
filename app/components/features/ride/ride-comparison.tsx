"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, Minus, TrendingUp } from "lucide-react";
import { getRideHistory, estimateZones } from "@/app/lib/analytics/ride-history";
import { formatTime } from "@/app/lib/formatters";

/**
 * RideComparison — Side-by-side comparison with previous ride on same route.
 *
 * Finds the most recent ride with the same classId and compares:
 * effort, power, heart rate, duration, SPIN earned.
 */
export function RideComparison({
  currentRideId,
  classId,
  avgEffort,
  avgPower,
  avgHeartRate,
  durationSec,
  spinEarned,
}: {
  currentRideId?: string;
  classId?: string;
  avgEffort: number;
  avgPower: number;
  avgHeartRate: number;
  durationSec: number;
  spinEarned: string;
}) {
  const previousRide = useMemo(() => {
    const rides = getRideHistory();
    if (rides.length < 2) return null;

    // Find current ride, then the previous one on same classId
    const currentIdx = currentRideId
      ? rides.findIndex((r) => r.id === currentRideId)
      : 0;

    const searchFrom = currentIdx >= 0 ? currentIdx + 1 : 1;
    const prev = rides
      .slice(searchFrom)
      .find((r) => r.classId === (classId ?? rides[currentIdx]?.classId));

    return prev ?? null;
  }, [currentRideId, classId]);

  if (!previousRide) return null;

  const comparisons = [
    {
      label: "Effort",
      current: avgEffort,
      previous: previousRide.avgEffort,
      unit: "",
      higherIsBetter: true,
    },
    {
      label: "Power",
      current: avgPower,
      previous: previousRide.avgPower,
      unit: "W",
      higherIsBetter: true,
    },
    {
      label: "Heart Rate",
      current: avgHeartRate,
      previous: previousRide.avgHeartRate,
      unit: "bpm",
      higherIsBetter: false,
    },
    {
      label: "Duration",
      current: durationSec,
      previous: previousRide.durationSec,
      unit: "",
      higherIsBetter: true,
      format: (v: number) => formatTime(v),
    },
    {
      label: "SPIN",
      current: parseFloat(spinEarned) || 0,
      previous: previousRide.spinEarned,
      unit: "",
      higherIsBetter: true,
      format: (v: number) => v.toFixed(1),
    },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
          vs Last Ride on This Route
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {comparisons.map((cmp) => {
          const delta = cmp.current - cmp.previous;
          const pctChange = cmp.previous > 0 ? (delta / cmp.previous) * 100 : 0;
          const isImprovement = cmp.higherIsBetter ? delta > 0 : delta < 0;
          const isNeutral = Math.abs(delta) < 0.01;

          const formatVal = cmp.format ?? ((v: number) => `${v}${cmp.unit}`);

          return (
            <div key={cmp.label} className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-1">
                {cmp.label}
              </p>
              <p className="text-sm font-black text-white tracking-tight">
                {formatVal(cmp.current)}
              </p>
              <div
                className={`flex items-center justify-center gap-0.5 mt-0.5 ${
                  isNeutral
                    ? "text-white/30"
                    : isImprovement
                      ? "text-emerald-400"
                      : "text-rose-400"
                }`}
              >
                {isNeutral ? (
                  <Minus className="w-2.5 h-2.5" />
                ) : isImprovement ? (
                  <ArrowUp className="w-2.5 h-2.5" />
                ) : (
                  <ArrowDown className="w-2.5 h-2.5" />
                )}
                <span className="text-[9px] font-bold">
                  {isNeutral ? "—" : `${Math.abs(pctChange).toFixed(0)}%`}
                </span>
              </div>
              <p className="text-[8px] text-white/20 mt-0.5">
                was {formatVal(cmp.previous)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * SegmentBreakdown — Zone-based segment breakdown table.
 *
 * Shows time spent in each HR zone as segments of the total ride,
 * with visual bars and percentages.
 */
export function SegmentBreakdown({
  durationSec,
  avgEffort,
}: {
  durationSec: number;
  avgEffort: number;
}) {
  const segments = useMemo(() => {
    const zones = estimateZones(avgEffort);
    const total = zones.recovery + zones.endurance + zones.threshold + zones.sprint;

    return [
      {
        label: "Recovery",
        color: "#10b981",
        bgColor: "bg-emerald-500/20",
        borderColor: "border-emerald-500/30",
        pct: total > 0 ? zones.recovery / total : 0,
        timeSec: total > 0 ? (zones.recovery / total) * durationSec : 0,
        hrRange: "< 65% max",
      },
      {
        label: "Endurance",
        color: "#3b82f6",
        bgColor: "bg-blue-500/20",
        borderColor: "border-blue-500/30",
        pct: total > 0 ? zones.endurance / total : 0,
        timeSec: total > 0 ? (zones.endurance / total) * durationSec : 0,
        hrRange: "65-75% max",
      },
      {
        label: "Threshold",
        color: "#f59e0b",
        bgColor: "bg-amber-500/20",
        borderColor: "border-amber-500/30",
        pct: total > 0 ? zones.threshold / total : 0,
        timeSec: total > 0 ? (zones.threshold / total) * durationSec : 0,
        hrRange: "75-85% max",
      },
      {
        label: "Sprint",
        color: "#ef4444",
        bgColor: "bg-rose-500/20",
        borderColor: "border-rose-500/30",
        pct: total > 0 ? zones.sprint / total : 0,
        timeSec: total > 0 ? (zones.sprint / total) * durationSec : 0,
        hrRange: "> 85% max",
      },
    ];
  }, [durationSec, avgEffort]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
          Zone Breakdown
        </span>
        <span className="text-[10px] text-white/30">
          {formatTime(durationSec)} total
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden mb-3">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="h-full transition-all duration-500"
            style={{
              width: `${seg.pct * 100}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </div>

      {/* Segment list */}
      <div className="space-y-1.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-white/70 font-medium w-20">
              {seg.label}
            </span>
            <span className="text-white/30 text-[10px] w-20">
              {seg.hrRange}
            </span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${seg.pct * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
              </div>
              <span className="text-white/50 font-mono text-[10px] w-10 text-right">
                {(seg.pct * 100).toFixed(0)}%
              </span>
              <span className="text-white/40 font-mono text-[10px] w-12 text-right">
                {formatTime(seg.timeSec)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
