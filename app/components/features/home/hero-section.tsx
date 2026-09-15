"use client";

import { PrimaryNav } from "@/app/components/layout/nav";

import { getDemoRideUrl } from "@/app/hooks/evm/use-class-data";
import { MorphCTA } from "@/app/components/ui/morph-cta";
import { useExperience } from "@/app/lib/experience-level";
import dynamic from "next/dynamic";
import { Play } from "lucide-react";

// Lazy-load: keeps the Rive JS runtime (~335 KB) + WASM bootstrap out of the
// landing page's initial bundle.
const RiveFlowBadge = dynamic(
  () => import("@/app/components/features/ride/rive-flow-badge").then((m) => m.RiveFlowBadge),
  {
    ssr: false,
    loading: () => <div style={{ width: 200, height: 120 }} aria-hidden="true" />,
  },
);

// The Rive rider in ready state greets first-time visitors beside the H1,
// mirroring the rider-hero pattern — Act 1 starts at the front door.
const RiveRider = dynamic(
  () => import("@/app/components/features/ride/rive-rider").then((m) => m.RiveRider),
  { ssr: false },
);

// Cast voice — first-time visitors get an eager greeting from the coach.
// Returning riders get a streak acknowledgement instead.
const COACH_GREETINGS = [
  "Let's find your gear.",
  "The road's ready when you are.",
  "One pedal stroke at a time.",
  "Your effort writes the route.",
];

function CoachGreeting({ rides }: { rides: number }) {
  const idx = rides % COACH_GREETINGS.length;
  return (
    <p className="mt-2 text-sm italic text-[color:var(--muted)]">
      {COACH_GREETINGS[idx]}
    </p>
  );
}

interface HeroSectionProps {
  onOpenGuide?: () => void;
}

export function HeroSection({ onOpenGuide }: HeroSectionProps) {
  const { totalRides, currentTier } = useExperience();
  // Honest signal: show the rider's current tier, not an aspirational +1.
  const flowTier = Math.min(4, currentTier);

  return (
    <header className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-6 shadow-[0_20px_80px_rgba(0,0,0,0.15)] md:gap-8 md:px-8 md:py-8">
      <PrimaryNav />

      <div className="relative w-full overflow-hidden border-y border-[color:var(--border)] py-8 text-center md:py-12">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 bg-[color:var(--accent)]/5 blur-[120px]" />

        {/* Flow badge — separate from the character, keeps tier signal */}
        <div className="mb-5 flex flex-col items-center justify-center gap-1">
          <RiveFlowBadge
            flowTier={flowTier}
            label={totalRides > 0 ? `🔥 ${totalRides} ride${totalRides === 1 ? "" : "s"}` : undefined}
          />
          {totalRides === 0 && (
            <p className="text-xs text-[color:var(--muted)]">
              Ride once to ignite your flow tier
            </p>
          )}
        </div>

        {/* Character + heading — RiveRider beside H1 for first-time visitors */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6 md:mb-6">
          {/* Nova (RiveRider): eager bounce in ready state for first-timers */}
          {totalRides === 0 && (
            <div className="shrink-0 mx-auto sm:mx-0">
              <RiveRider size={80} ready fatigued={false} />
              <p className="mt-1 text-center text-xs font-medium text-[color:var(--muted)]">
                Nova · your rider
              </p>
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-black leading-tight text-[color:var(--foreground)] drop-shadow-2xl sm:text-4xl md:text-5xl lg:text-6xl">
              Indoor cycling that{" "}
              <br />
              reacts to your effort.
            </h1>
            {totalRides === 0 && <CoachGreeting rides={0} />}
          </div>
        </div>

        <p className="mx-auto max-w-2xl px-4 text-base font-medium leading-relaxed text-[color:var(--muted)] md:text-lg lg:text-xl">
          Pedal harder. The road glows hotter. The fog thickens. The world
          transforms with every watt. Try a free demo — no wallet or signup
          needed.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <MorphCTA href={getDemoRideUrl({ name: "Demo Ride" })}>
            <Play className="h-4 w-4 fill-current" />
            Try a Demo Ride
          </MorphCTA>

          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="text-sm font-medium text-[color:var(--muted)] transition-colors hover:text-[color:var(--foreground)]"
            >
              Set up my profile
            </button>
          )}
        </div>

      </div>

      <div className="w-full rounded-b-2xl py-5 md:py-6" role="region" aria-label="Quick start highlights">
        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          {[
            { label: "No wallet", value: "Demo ride" },
            { label: "No signup", value: "Instant start" },
            { label: "Effort-driven", value: "Reactive 3D world" },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-lg font-bold text-[color:var(--foreground)] md:text-xl">
                {item.value}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
