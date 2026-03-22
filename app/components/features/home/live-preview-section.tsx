"use client";

import { motion } from "framer-motion";
import { MetricTile, Tag } from "@/app/components/ui/ui";
import { FadeIn, ScaleIn, Parallax } from "@/app/components/ui/scroll-animations";
import { EnergyPulse } from "@/app/components/ui/animated-card";

const riderHighlights = [
  { label: "Avg Heart Rate", value: "148 BPM", detail: "Zone 4 sustained" },
  { label: "Classes Completed", value: "12", detail: "This month" },
  { label: "SPIN Earned", value: "240", detail: "$48 value" },
];

export function LivePreviewSection() {
  return (
    <Parallax speed={0.3}>
      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-6 md:p-8 backdrop-blur" aria-label="Live workout preview">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 md:gap-8">
          <FadeIn direction="left">
            <div>
              <div className="flex items-center gap-2 mb-3 md:mb-4">
                <EnergyPulse size="sm" />
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--accent)]">
                  Live Preview
                </p>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold text-[color:var(--foreground)] mb-3 md:mb-4">
                Your workout, rewarded
              </h2>
              <p className="text-sm md:text-base text-[color:var(--muted)] mb-5 md:mb-6 leading-relaxed">
                See your effort translate to rewards in real-time. Heart rate, power, and progress—all in one beautiful dashboard.
              </p>
              <div className="flex flex-wrap gap-2 md:gap-3">
                <Tag>Real-time tracking</Tag>
                <Tag>Instant rewards</Tag>
                <Tag>Private by default</Tag>
              </div>
            </div>
          </FadeIn>

          {/* Mock Dashboard */}
          <ScaleIn delay={0.2}>
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5 md:p-6">
              <div className="flex items-center justify-between mb-5 md:mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Current Session
                  </p>
                  <h3 className="text-base md:text-lg font-semibold text-[color:var(--foreground)]">
                    Alpine Climb
                  </h3>
                </div>
                <span className="flex items-center gap-2 rounded-full bg-[color:var(--success)]/10 px-3 py-1 text-xs text-[color:var(--success)]">
                  <EnergyPulse size="sm" />
                  Live
                </span>
              </div>

              <div className="flex items-center gap-4 md:gap-6 mb-5 md:mb-6">
                <div className="relative grid h-20 w-20 md:h-24 md:w-24 place-items-center rounded-full bg-[conic-gradient(from_180deg,var(--success)_0deg,var(--success)_260deg,var(--surface-elevated)_260deg)]">
                  <div className="grid h-16 w-16 md:h-18 md:w-18 place-items-center rounded-full bg-[color:var(--surface-strong)] text-sm font-semibold text-[color:var(--foreground)]">
                    82%
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs md:text-sm text-[color:var(--muted)]">Effort zone</p>
                  <p className="text-base md:text-lg font-semibold text-[color:var(--foreground)]">HR 148 • 32 min</p>
                  <motion.p
                    className="text-xs text-[color:var(--success)]"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    12 SPIN earned so far
                  </motion.p>
                </div>
              </div>

              <div className="grid gap-2 md:gap-3 sm:grid-cols-3">
                {riderHighlights.map((item) => (
                  <MetricTile key={item.label} {...item} />
                ))}
              </div>
            </div>
          </ScaleIn>
        </div>
      </section>
    </Parallax>
  );
}