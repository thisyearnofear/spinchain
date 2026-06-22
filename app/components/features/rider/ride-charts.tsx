"use client";

import { useMemo } from "react";
import type { RideSummary } from "@/app/lib/analytics/ride-history";

/* ─── Effort Trend Line Chart ─── */

export function EffortTrendChart({ rides }: { rides: RideSummary[] }) {
  const data = useMemo(() => {
    const sorted = [...rides].sort((a, b) => a.completedAt - b.completedAt);
    return sorted.slice(-20);
  }, [rides]);

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[140px] text-sm text-white/40">
        Complete at least 2 rides to see your effort trend.
      </div>
    );
  }

  const width = 600;
  const height = 160;
  const padding = { top: 20, right: 16, bottom: 28, left: 36 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const efforts = data.map((d) => d.avgEffort);
  const maxEffort = Math.max(...efforts, 1000);
  const minEffort = Math.min(...efforts, 0);
  const range = maxEffort - minEffort || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.avgEffort - minEffort) / range) * chartH;
    return { x, y, effort: d.avgEffort, date: d.completedAt };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padding.top + chartH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padding.top + chartH).toFixed(1)} Z`;

  // Linear regression for trend line
  const n = data.length;
  const sumX = data.reduce((s, _, i) => s + i, 0);
  const sumY = efforts.reduce((s, e) => s + e, 0);
  const sumXY = data.reduce((s, d, i) => s + i * d.avgEffort, 0);
  const sumXX = data.reduce((s, _, i) => s + i * i, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  const trendY0 = intercept;
  const trendY1 = slope * (n - 1) + intercept;
  const trendStart = { x: padding.left, y: padding.top + chartH - ((trendY0 - minEffort) / range) * chartH };
  const trendEnd = { x: padding.left + chartW, y: padding.top + chartH - ((trendY1 - minEffort) / range) * chartH };

  const trendDirection = slope > 1 ? "up" : slope < -1 ? "down" : "flat";
  const trendLabel =
    trendDirection === "up" ? `Trending up ${((slope * (n - 1)) / (efforts[0] || 1) * 100).toFixed(0)}%` :
    trendDirection === "down" ? `Trending down ${Math.abs((slope * (n - 1)) / (efforts[0] || 1) * 100).toFixed(0)}%` :
    "Steady";

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="effortArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padding.top + chartH * t;
          const val = Math.round(maxEffort - (range * t));
          return (
            <g key={t}>
              <line x1={padding.left} y1={y} x2={padding.left + chartW} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.3)">
                {val}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#effortArea)" />

        {/* Trend line */}
        <line
          x1={trendStart.x} y1={trendStart.y}
          x2={trendEnd.x} y2={trendEnd.y}
          stroke={trendDirection === "up" ? "#34d399" : trendDirection === "down" ? "#fbbf24" : "#6b7280"}
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity="0.6"
        />

        {/* Main line */}
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="#6366f1" stroke="#1a1a2e" strokeWidth="1.5" />
            {i === points.length - 1 && (
              <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fill="#a5b4fc" fontWeight="600">
                {p.effort}
              </text>
            )}
          </g>
        ))}

        {/* X-axis labels (first, middle, last) */}
        {[0, Math.floor(data.length / 2), data.length - 1].map((idx) => {
          const p = points[idx];
          if (!p) return null;
          const date = new Date(p.date);
          const label = `${date.getMonth() + 1}/${date.getDate()}`;
          return (
            <text key={idx} x={p.x} y={height - 6} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.3)">
              {label}
            </text>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-white/50 text-center">
        <span className={trendDirection === "up" ? "text-emerald-400" : trendDirection === "down" ? "text-amber-400" : "text-white/40"}>
          {trendLabel}
        </span>
        <span className="mx-2 text-white/20">•</span>
        Last {data.length} rides
      </p>
    </div>
  );
}

/* ─── Calendar Heatmap ─── */

export function CalendarHeatmap({ rides }: { rides: RideSummary[] }) {
  const weeks = 12;
  const days = 7;

  const grid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cells: { date: Date; effort: number; rideCount: number }[][] = [];

    for (let w = weeks - 1; w >= 0; w--) {
      const column: { date: Date; effort: number; rideCount: number }[] = [];
      for (let d = 0; d < days; d++) {
        const offset = w * 7 + (6 - d);
        const date = new Date(today);
        date.setDate(date.getDate() - offset);
        const dayRides = rides.filter((r) => {
          const rd = new Date(r.completedAt);
          rd.setHours(0, 0, 0, 0);
          return rd.getTime() === date.getTime();
        });
        column.push({
          date,
          effort: dayRides.reduce((s, r) => s + r.avgEffort, 0),
          rideCount: dayRides.length,
        });
      }
      cells.push(column);
    }
    return cells;
  }, [rides]);

  const maxEffort = Math.max(...grid.flat().map((c) => c.effort), 1);

  const getColor = (effort: number, rideCount: number) => {
    if (rideCount === 0) return "rgba(255,255,255,0.04)";
    const intensity = effort / maxEffort;
    if (intensity > 0.75) return "#6366f1";
    if (intensity > 0.5) return "#818cf8";
    if (intensity > 0.25) return "#a5b4fc";
    return "#c7d2fe";
  };

  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    grid.forEach((week, col) => {
      const month = week[0].date.getMonth();
      if (month !== lastMonth) {
        labels.push({ label: week[0].date.toLocaleString("default", { month: "short" }), col });
        lastMonth = month;
      }
    });
    return labels;
  }, [grid]);

  const cellSize = 13;
  const gap = 3;
  const dayLabels = ["", "M", "", "W", "", "F", ""];

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-flex flex-col gap-1 min-w-fit">
        {/* Month labels */}
        <div className="flex gap-[3px] ml-6 mb-0.5">
          {grid.map((_, col) => {
            const label = monthLabels.find((l) => l.col === col);
            return (
              <div key={col} className="text-[9px] text-white/30 w-[13px] text-center">
                {label?.label ?? ""}
              </div>
            );
          })}
        </div>

        <div className="flex gap-[3px]">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] mr-1">
            {dayLabels.map((d, i) => (
              <div key={i} className="text-[9px] text-white/30 h-[13px] leading-[13px] w-4">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          {grid.map((week, col) => (
            <div key={col} className="flex flex-col gap-[3px]">
              {week.map((cell, row) => (
                <div
                  key={row}
                  className="rounded-sm transition-all hover:ring-1 hover:ring-white/20"
                  style={{
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    backgroundColor: getColor(cell.effort, cell.rideCount),
                  }}
                  title={cell.rideCount > 0
                    ? `${cell.date.toLocaleDateString()}: ${cell.rideCount} ride(s), ${cell.effort} total effort`
                    : `${cell.date.toLocaleDateString()}: no rides`}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-2 ml-6">
          <span className="text-[9px] text-white/30">Less</span>
          {["rgba(255,255,255,0.04)", "#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1"].map((c, i) => (
            <div key={i} className="w-[10px] h-[10px] rounded-sm" style={{ backgroundColor: c }} />
          ))}
          <span className="text-[9px] text-white/30">More</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Weekly Volume Bar Chart ─── */

export function WeeklyVolumeChart({ rides }: { rides: RideSummary[] }) {
  const data = useMemo(() => {
    const sorted = [...rides].sort((a, b) => a.completedAt - b.completedAt);
    const weeks: { weekLabel: string; building: number; strong: number; elite: number; total: number }[] = [];
    const now = new Date();

    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - w * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekRides = sorted.filter((r) => {
        const rd = new Date(r.completedAt);
        return rd >= weekStart && rd < weekEnd;
      });

      const building = weekRides.filter((r) => r.avgEffort < 500).length;
      const strong = weekRides.filter((r) => r.avgEffort >= 500 && r.avgEffort < 800).length;
      const elite = weekRides.filter((r) => r.avgEffort >= 800).length;

      weeks.push({
        weekLabel: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        building,
        strong,
        elite,
        total: weekRides.length,
      });
    }
    return weeks;
  }, [rides]);

  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const barWidth = 48;
  const gap = 12;
  const chartHeight = 120;
  const labelArea = 20;

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-flex flex-col gap-2 min-w-fit">
        <div className="flex items-end gap-3" style={{ height: `${chartHeight + labelArea}px` }}>
          {data.map((d, i) => {
            const buildingH = (d.building / maxTotal) * chartHeight;
            const strongH = (d.strong / maxTotal) * chartHeight;
            const eliteH = (d.elite / maxTotal) * chartHeight;
            const totalH = buildingH + strongH + eliteH;

            return (
              <div key={i} className="flex flex-col items-center gap-1" style={{ width: `${barWidth}px` }}>
                <div className="relative flex flex-col-reverse" style={{ height: `${chartHeight}px` }}>
                  {/* Building tier */}
                  <div
                    className="w-full rounded-b-md transition-all"
                    style={{ height: `${buildingH}px`, backgroundColor: "#4f46e5", opacity: 0.5 }}
                    title={`Building: ${d.building} rides`}
                  />
                  {/* Strong tier */}
                  <div
                    className="w-full transition-all"
                    style={{ height: `${strongH}px`, backgroundColor: "#6366f1", opacity: 0.75 }}
                    title={`Strong: ${d.strong} rides`}
                  />
                  {/* Elite tier */}
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{ height: `${eliteH}px`, backgroundColor: "#818cf8" }}
                    title={`Elite: ${d.elite} rides`}
                  />
                  {/* Total label on top */}
                  {d.total > 0 && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/70"
                      style={{ bottom: `${totalH + 2}px` }}
                    >
                      {d.total}
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-white/30 whitespace-nowrap">{d.weekLabel}</span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#818cf8" }} />
            <span className="text-[10px] text-white/40">Elite (800+)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#6366f1", opacity: 0.75 }} />
            <span className="text-[10px] text-white/40">Strong (500-799)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#4f46e5", opacity: 0.5 }} />
            <span className="text-[10px] text-white/40">Building (&lt;500)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── HR Zone Distribution Donut ─── */

export function ZoneDistributionChart({ rides }: { rides: RideSummary[] }) {
  const zones = useMemo(() => {
    const totals = { recovery: 0, endurance: 0, threshold: 0, sprint: 0 };
    rides.forEach((r) => {
      totals.recovery += r.zones.recovery;
      totals.endurance += r.zones.endurance;
      totals.threshold += r.zones.threshold;
      totals.sprint += r.zones.sprint;
    });
    const total = totals.recovery + totals.endurance + totals.threshold + totals.sprint;
    if (total === 0) return null;

    return {
      recovery: { value: totals.recovery, pct: (totals.recovery / total) * 100 },
      endurance: { value: totals.endurance, pct: (totals.endurance / total) * 100 },
      threshold: { value: totals.threshold, pct: (totals.threshold / total) * 100 },
      sprint: { value: totals.sprint, pct: (totals.sprint / total) * 100 },
      total,
    };
  }, [rides]);

  if (!zones) {
    return (
      <div className="flex items-center justify-center h-[160px] text-sm text-white/40">
        No zone data yet. Complete a ride with telemetry to see distribution.
      </div>
    );
  }

  const size = 160;
  const stroke = 24;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const segments = [
    { key: "recovery", label: "Recovery", color: "#10b981", ...zones.recovery },
    { key: "endurance", label: "Endurance", color: "#3b82f6", ...zones.endurance },
    { key: "threshold", label: "Threshold", color: "#f59e0b", ...zones.threshold },
    { key: "sprint", label: "Sprint", color: "#ef4444", ...zones.sprint },
  ];

  let offset = 0;
  const arcs = segments.map((seg) => {
    const dash = (seg.pct / 100) * circumference;
    const arc = { ...seg, dash, offset };
    offset += dash;
    return arc;
  });

  const dominantZone = segments.reduce((max, s) => (s.pct > max.pct ? s : max), segments[0]);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={stroke}
              strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-white">{Math.round(dominantZone.pct)}%</span>
          <span className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">{dominantZone.label}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
              <span className="text-xs text-white/60">{seg.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-white">{seg.pct.toFixed(0)}%</span>
              <span className="text-[10px] text-white/30">{seg.value} min</span>
            </div>
          </div>
        ))}
        <div className="mt-1 pt-2 border-t border-white/5">
          <p className="text-[10px] text-white/40">
            Total: {zones.total} min across {rides.length} ride{rides.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
