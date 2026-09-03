"use client";

import { PrimaryNav } from "@/app/components/layout/nav";
import { AnimatedCard, Floating, MagneticButton } from "@/app/components/ui/animated-card";
import { getDemoRideUrl } from "@/app/hooks/evm/use-class-data";
import { ChainringCarousel } from "./chainring-carousel";
import { MorphCTA } from "@/app/components/ui/morph-cta";
import Link from "next/link";
import { Play, ArrowRight } from "lucide-react";

interface HeroSectionProps {
  onOpenGuide?: () => void;
}

export function HeroSection({ onOpenGuide }: HeroSectionProps) {
  return (
    <header className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-6 shadow-[0_20px_80px_rgba(0,0,0,0.15)] md:gap-8 md:px-8 md:py-8">
      <PrimaryNav />

      <div className="relative w-full overflow-hidden border-y border-[color:var(--border)] py-8 text-center md:py-12">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 bg-[color:var(--accent)]/5 blur-[120px]" />

        <h1 className="mb-5 text-3xl font-black leading-tight text-[color:var(--foreground)] drop-shadow-2xl sm:text-4xl md:mb-6 md:text-5xl lg:text-6xl">
          Indoor cycling that
          <br />
          reacts to your effort.
        </h1>

        <p className="mx-auto max-w-2xl px-4 text-base font-medium leading-relaxed text-[color:var(--muted)] md:text-lg lg:text-xl">
          Pedal harder. The road glows hotter. The fog thickens. The world
          transforms with every watt. Try a free demo — no wallet or signup
          needed.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href={getDemoRideUrl({ name: "Accelerator Pitch" })} className="contents">
            <MorphCTA>
              <Play className="h-4 w-4 fill-current" />
              Try a Demo Ride
            </MorphCTA>
          </Link>

          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="text-sm font-medium text-[color:var(--muted)] transition-colors hover:text-[color:var(--foreground)]"
            >
              Take the quick tour
            </button>
          )}
        </div>

        <ChainringCarousel />
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

      <div className="mt-2 grid w-full gap-4 md:grid-cols-2 md:gap-6">
        <AnimatedCard glowColor="var(--accent)">
          <Link
            href={getDemoRideUrl({ name: "Accelerator Pitch" })}
            className="group relative block h-full overflow-hidden p-6 md:p-8"
            aria-label="Start riding with a demo"
          >
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-gradient-to-br from-[color:var(--accent)]/20 to-transparent" />
            <Floating delay={0}>
              <Play className="mb-4 block h-10 w-10 text-[color:var(--accent)] md:h-12 md:w-12" />
            </Floating>
            <h2 className="mb-2 text-xl font-semibold text-[color:var(--foreground)] md:text-2xl">
              Ride a class
            </h2>
            <p className="mb-5 text-sm text-[color:var(--muted)] md:mb-6 md:text-base">
              Start with the free demo, explore upcoming sessions, and connect your setup when you are ready.
            </p>
            <MagneticButton className="pointer-events-none inline-flex items-center gap-2 font-medium text-[color:var(--accent)] transition-colors group-hover:text-[color:var(--accent-strong)]">
              Start with a demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </MagneticButton>
          </Link>
        </AnimatedCard>

        <AnimatedCard glowColor="var(--accent-strong)">
          <a
            href="/instructor"
            className="group relative block h-full overflow-hidden p-6 md:p-8"
            aria-label="Preview instructor tools"
          >
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-transparent" />
            <Floating delay={0.5}>
              <ArrowRight className="mb-4 block h-10 w-10 rotate-45 text-[color:var(--accent-strong)] md:h-12 md:w-12" />
            </Floating>
            <h2 className="mb-2 text-xl font-semibold text-[color:var(--foreground)] md:text-2xl">
              Teach on SpinChain
            </h2>
            <p className="mb-5 text-sm text-[color:var(--muted)] md:mb-6 md:text-base">
              Build classes with AI-assisted coaching and immersive routes. Draft before you commit.
            </p>
            <MagneticButton className="inline-flex items-center gap-2 font-medium text-[color:var(--accent)] transition-colors group-hover:text-[color:var(--accent-strong)]">
              Preview teaching paths
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-y-1" />
            </MagneticButton>
          </a>
        </AnimatedCard>
      </div>
    </header>
  );
}
