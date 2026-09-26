"use client";

import dynamic from "next/dynamic";
import { FadeIn, StaggerContainer } from "@/app/components/ui/scroll-animations";
import { Flower2, Zap, BarChart3 } from "lucide-react";

// Lazy-load: keeps the Rive JS runtime + WASM out of the landing bundle
// (same pattern as hero-section.tsx).
const RiveRider = dynamic(
  () => import("@/app/components/features/ride/rive-rider").then((m) => m.RiveRider),
  { ssr: false },
);

// The three coach personalities are real (app/agent/coach-profile.tsx,
// docs/CHARACTER-SYSTEM.md) — descriptors stay honest to how each one rides.
const personalities = [
  { icon: Flower2, name: "Zen", descriptor: "Calm and patient" },
  { icon: Zap, name: "Drill Sergeant", descriptor: "Pushes you harder" },
  { icon: BarChart3, name: "Data", descriptor: "Speaks in numbers" },
];

export function CoachMemorySection() {
  return (
    <FadeIn>
      <section
        className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 md:p-10"
        aria-label="Coach memory"
      >
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto] md:gap-12">
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--foreground)] md:text-3xl">
              A coach who remembers every ride.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[color:var(--muted)] md:text-base">
              Your coach greets you by name, remembers every PR, and notices
              when you&apos;re tired — and backs off. Memory carries from ride
              to ride, so each session starts where the last one ended.
            </p>
            <StaggerContainer
              className="mt-6 flex flex-wrap gap-2 md:gap-3"
              staggerDelay={0.1}
            >
              {personalities.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 md:px-4 md:py-2"
                >
                  <p.icon
                    className="h-4 w-4 text-[color:var(--accent)]"
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold text-[color:var(--foreground)] md:text-sm">
                    {p.name}
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">
                    {p.descriptor}
                  </span>
                </div>
              ))}
            </StaggerContainer>
          </div>

          {/* Nova moment: ready state beside a one-line coach quote that
              shows memory working, not just claims it. */}
          <div className="flex flex-col items-center gap-3">
            <RiveRider size={96} ready fatigued={false} />
            <p className="max-w-[220px] text-center text-sm italic text-[color:var(--muted)]">
              &ldquo;Third ride this week — we&apos;ll keep today easy.&rdquo;
            </p>
          </div>
        </div>
      </section>
    </FadeIn>
  );
}
