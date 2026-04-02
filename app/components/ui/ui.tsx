"use client";

type SectionProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: SectionProps) {
  return (
    <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-[color:var(--foreground)] md:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      {children}
    </div>
  );
}

type CardProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
};

export function SurfaceCard({
  eyebrow,
  title,
  description,
  children,
  className = "",
  actions,
}: CardProps) {
  return (
    <div
      className={`relative rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur-2xl shadow-2xl overflow-hidden group transition-all duration-500 hover:border-white/20 ${className}`}
    >
      {/* Subtle inner highlight */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />

      {eyebrow ? (
        <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[color:var(--foreground)]/90 mb-4">
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h3
          className={`text-2xl font-black text-[color:var(--foreground)] tracking-tight ${eyebrow ? "" : "mt-0"}`}
        >
          {title}
        </h3>
      ) : null}
      {description ? (
        <p
          className={`text-sm text-[color:var(--foreground)]/75 leading-relaxed ${title ? "mt-3" : ""}`}
        >
          {description}
        </p>
      ) : null}
      {actions ? <div className="relative z-10 mt-4 flex flex-wrap gap-3">{actions}</div> : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

type MetricProps = {
  label: string;
  value: string;
  detail?: string;
};

export function MetricTile({ label, value, detail }: MetricProps) {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-black/40 p-5 px-6 group transition-all duration-300 hover:border-white/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.25em] font-black text-[color:var(--muted)]">
          {label}
        </p>
        <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] animate-pulse opacity-20 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-3xl font-black text-[color:var(--foreground)] tracking-tighter">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-[10px] font-bold text-[color:var(--muted)] uppercase tracking-tighter italic opacity-60 group-hover:opacity-100 transition-opacity">{detail}</p>
      ) : null}
    </div>
  );
}

type BulletListProps = {
  items: string[];
};

export function BulletList({ items }: BulletListProps) {
  return (
    <ul className="space-y-3 text-sm text-[color:var(--foreground)]/80">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--accent)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

type TagProps = {
  children: React.ReactNode;
  color?: "blue" | "indigo" | "amber" | "green";
  className?: string;
};

export function Tag({ children, color, className = "" }: TagProps) {
  const colorClasses = {
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]",
    indigo: "border-indigo-500/20 bg-indigo-500/5 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]",
    green: "border-green-500/20 bg-green-500/5 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]",
  };

  const baseClass = color
    ? colorClasses[color]
    : "border-white/10 bg-white/5 text-white/50 shadow-sm";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] backdrop-blur-sm transition-all hover:scale-105 active:scale-95 ${baseClass} ${className}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-20" />
      {children}
    </span>
  );
}

type ProgressRingProps = {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
  color?: string;
};

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  children,
  color = "var(--accent)",
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        className="absolute inset-0 -rotate-90 transform"
        width={size}
        height={size}
      >
        <circle
          stroke="var(--surface-strong)"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          className="transition-all duration-500 ease-in-out"
        />
      </svg>
      <div className="relative z-10 text-center">{children}</div>
    </div>
  );
}

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function GlassCard({ children, className = "" }: GlassCardProps) {
  return (
    <div
      className={`relative rounded-3xl border border-white/10 bg-black/30 backdrop-blur-3xl shadow-2xl overflow-hidden ${className}`}
    >
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      {children}
    </div>
  );
}

type GradientTextProps = {
  children: React.ReactNode;
  className?: string;
};

export function GradientText({ children, className = "" }: GradientTextProps) {
  return (
    <span
      className={`bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-strong)] bg-clip-text text-transparent ${className}`}
    >
      {children}
    </span>
  );
}

// ─── Sparkline Component ───

import { useEffect, useRef, useCallback } from "react";

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
  animated?: boolean;
}

export function SparklineCanvas({
  data,
  color = "var(--accent)",
  height = 40,
  className = "",
  animated = true,
}: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const progressRef = useRef(0);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, drawProgress = 1) => {
      const dpr = window.devicePixelRatio || 1;
      const padding = 4;
      const chartHeight = height - padding * 2;

      ctx.clearRect(0, 0, width * dpr, height * dpr);

      if (data.length < 2) return;

      const max = Math.max(...data) * 1.1;
      const min = Math.min(...data) * 0.9;
      const range = max - min || 1;

      // Calculate visible points based on animation progress
      const visiblePoints = Math.floor(data.length * drawProgress);
      const partialProgress = (data.length * drawProgress) % 1;

      // Build path
      const points = data.slice(0, visiblePoints + 1).map((v, i) => ({
        x: padding + (i / (data.length - 1)) * (width - padding * 2),
        y: padding + chartHeight - ((v - min) / range) * chartHeight,
      }));

      if (points.length < 2) return;

      // Draw line
      ctx.beginPath();
      ctx.moveTo(points[0].x * dpr, points[0].y * dpr);

      for (let i = 1; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];
        const midX = (curr.x + next.x) / 2;
        ctx.quadraticCurveTo(
          curr.x * dpr,
          curr.y * dpr,
          midX * dpr,
          (curr.y + next.y) / 2 * dpr
        );
      }

      // Last segment with partial progress
      const lastIdx = points.length - 1;
      if (lastIdx > 0 && visiblePoints < data.length) {
        const prev = points[lastIdx - 1];
        const last = points[lastIdx];
        const partialX = prev.x + (last.x - prev.x) * partialProgress;
        const partialY = prev.y + (last.y - prev.y) * partialProgress;
        ctx.lineTo(partialX * dpr, partialY * dpr);
      } else if (points.length > 1) {
        const last = points[points.length - 1];
        ctx.lineTo(last.x * dpr, last.y * dpr);
      }

      // Stroke with gradient
      const gradient = ctx.createLinearGradient(0, 0, width * dpr, 0);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color.replace(")", ", 0.5)").replace("rgb", "rgba"));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2 * dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // Fill area
      ctx.lineTo(points[points.length - 1]?.x * dpr || width * dpr, height * dpr);
      ctx.lineTo(points[0].x * dpr, height * dpr);
      ctx.closePath();

      const fillGradient = ctx.createLinearGradient(0, 0, 0, height * dpr);
      fillGradient.addColorStop(0, color.replace(")", ", 0.15)").replace("rgb", "rgba"));
      fillGradient.addColorStop(1, "transparent");
      ctx.fillStyle = fillGradient;
      ctx.fill();
    },
    [data, height, color]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    if (animated) {
      progressRef.current = 0;
      const animate = () => {
        progressRef.current += 0.03;
        if (progressRef.current >= 1) progressRef.current = 1;

        draw(ctx, rect.width, progressRef.current);

        if (progressRef.current < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };
      animate();
    } else {
      draw(ctx, rect.width, 1);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [data, draw, animated, height]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      draw(ctx, rect.width, 1);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw, height]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full ${className}`}
      style={{ height }}
    />
  );
}

// ─── Enhanced Metric Tile with Sparkline ───
type EnhancedMetricProps = {
  label: string;
  value: string;
  detail?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  sparklineData?: number[];
  sparklineColor?: string;
  delay?: number;
};

export function MetricTileEnhanced({
  label,
  value,
  detail,
  trend = "neutral",
  trendValue,
  sparklineData,
  sparklineColor,
  delay = 0,
}: EnhancedMetricProps) {
  const trendColors = {
    up: "text-green-400",
    down: "text-red-400",
    neutral: "text-[color:var(--muted)]",
  };

  const trendIcons = {
    up: "↑",
    down: "↓",
    neutral: "→",
  };

  return (
    <div
      className="relative rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl p-5 px-6 group transition-all duration-500 hover:border-white/20 hover:bg-black/40 hover:-translate-y-0.5 overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

      {/* Top highlight line */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[color:var(--muted)]">
            {label}
          </p>
          <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] animate-pulse" />
        </div>

        <p className="text-2xl md:text-3xl font-bold text-[color:var(--foreground)] tracking-tight">
          {value}
        </p>

        {(trendValue || detail) && (
          <p className={`mt-1 text-[11px] font-medium ${trendColors[trend]} flex items-center gap-1`}>
            {trend !== "neutral" && <span>{trendIcons[trend]}</span>}
            {trendValue || detail}
          </p>
        )}

        {sparklineData && sparklineData.length > 1 && (
          <div className="mt-3 -mx-2">
            <SparklineCanvas
              data={sparklineData}
              color={sparklineColor || "var(--accent)"}
              height={32}
              animated
            />
          </div>
        )}
      </div>
    </div>
  );
}
