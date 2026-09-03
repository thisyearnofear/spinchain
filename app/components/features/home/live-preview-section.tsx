"use client";

import { Parallax } from "@/app/components/ui/scroll-animations";
import { Activity, Heart, Zap } from "lucide-react";

const liveMetrics = [
  { icon: Heart, label: "Heart rate zone", color: "text-rose-400" },
  { icon: Zap, label: "Power output", color: "text-amber-400" },
  { icon: Activity, label: "Flow state", color: "text-emerald-400" },
];

export function LivePreviewSection() {
  return (
    <Parallax speed={0.3}>
      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 md:p-8" aria-label="In-ride experience">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--foreground)] md:text-3xl">
              Your effort becomes the world
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted)] md:text-base">
              Power, heart rate, and cadence feed the scene in real time. Hit a
              sprint and the road glows hotter. Settle into a climb and the fog
              thickens around you.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 md:mt-6 md:gap-3">
              {liveMetrics.map((metric) => (
                <span
                  key={metric.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--foreground)]"
                >
                  <metric.icon className={`h-3.5 w-3.5 ${metric.color}`} />
                  {metric.label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5 md:p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--accent)]/5 to-transparent" />
            <div className="relative">
              <div className="space-y-3">
                <div className="h-2 w-2/3 rounded-full bg-[color:var(--border)]" />
                <div className="h-2 w-1/2 rounded-full bg-[color:var(--border)]" />
                <div className="h-2 w-3/4 rounded-full bg-[color:var(--accent)]/30" />
              </div>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[color:var(--muted)]">Current phase</p>
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">Interval</p>
                </div>
                <div className="h-10 w-10 rounded-full border-2 border-[color:var(--accent)]/30" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </Parallax>
  );
}
