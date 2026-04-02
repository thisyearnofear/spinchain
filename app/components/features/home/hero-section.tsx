"use client";

import { motion } from "framer-motion";
import { PrimaryNav } from "@/app/components/layout/nav";
import { AnimatedCard, Floating, MagneticButton } from "@/app/components/ui/animated-card";
import Link from "next/link";

const quickStarts = [
  { label: "Start free", value: "5-minute demo", subtitle: "No commitment required" },
  { label: "For riders", value: "Live classes", subtitle: "Preview routes and rewards" },
  { label: "For instructors", value: "Class builder", subtitle: "Draft before going deeper" },
];

interface HeroSectionProps {
  onOpenGuide?: () => void;
}

export function HeroSection({ onOpenGuide }: HeroSectionProps) {
  return (
    <header className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-6 py-6 shadow-[0_20px_80px_rgba(0,0,0,0.15)] backdrop-blur md:gap-8 md:px-8 md:py-8">
      <PrimaryNav />

      <div className="relative w-full overflow-hidden border-y border-[color:var(--border)] py-8 text-center md:py-12">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 bg-[color:var(--accent)]/5 blur-[120px]" />

        <h1 className="mb-5 text-3xl font-black leading-tight text-[color:var(--foreground)] drop-shadow-2xl sm:text-4xl md:mb-6 md:text-5xl lg:text-6xl">
          Indoor cycling that feels
          <br />
          <span className="bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-strong)] bg-clip-text text-transparent">
            worth coming back for.
          </span>
        </h1>

        <p className="mx-auto max-w-2xl px-4 text-base font-medium leading-relaxed text-[color:var(--muted)] md:text-lg lg:text-xl">
          Riders can jump into immersive classes and try a free demo. Instructors can preview the class-building flow before committing to a wallet-first setup.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/rider"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Try the rider demo
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>

          <Link
            href="/instructor"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--border)] px-6 py-3 text-sm font-semibold text-[color:var(--foreground)] transition-colors hover:border-[color:var(--accent)]/50"
          >
            Preview instructor tools
          </Link>

          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="text-sm font-medium text-[color:var(--muted)] transition-colors hover:text-[color:var(--foreground)]"
            >
              See the quick tour
            </button>
          )}
        </div>
      </div>

      <div
        className="w-full rounded-b-2xl bg-[color:var(--surface)]/50 py-5 backdrop-blur-sm md:py-6"
        role="region"
        aria-label="Quick start highlights"
      >
        <div className="flex flex-wrap justify-center gap-6 md:gap-10">
          {quickStarts.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="text-center">
                <motion.p
                  className="text-xl font-bold text-[color:var(--foreground)] md:text-2xl"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                >
                  {item.value}
                </motion.p>
                <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">{item.label}</p>
                <p className="mt-0.5 text-[10px] font-medium text-[color:var(--accent)]">{item.subtitle}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-2 grid w-full gap-4 md:gap-6 lg:grid-cols-2">
        <AnimatedCard glowColor="var(--accent)">
          <Link
            href="/rider"
            className="group relative block h-full overflow-hidden p-6 md:p-8"
            aria-label="Start riding with a demo or class preview"
          >
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-gradient-to-br from-[color:var(--accent)]/20 to-transparent" />
            <Floating delay={0}>
              <span className="mb-4 block text-4xl md:text-5xl" aria-hidden="true">🚴</span>
            </Floating>
            <h2 className="mb-2 text-xl font-semibold text-[color:var(--foreground)] md:text-2xl">
              Ride a class
            </h2>
            <p className="mb-5 text-sm text-[color:var(--muted)] md:mb-6 md:text-base">
              Start with the free demo, explore upcoming sessions, and connect your setup when you are ready.
            </p>
            <MagneticButton className="pointer-events-none inline-flex items-center gap-2 font-medium text-[color:var(--accent)] transition-colors group-hover:text-[color:var(--accent-strong)]">
              Start with a demo
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </MagneticButton>
          </Link>
        </AnimatedCard>

        <AnimatedCard glowColor="var(--accent-strong)">
          <a
            href="#instructor-modes"
            className="group relative block h-full overflow-hidden p-6 md:p-8"
            aria-label="Preview instructor tools and teaching modes"
          >
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-transparent" />
            <Floating delay={0.5}>
              <span className="mb-4 block text-4xl md:text-5xl" aria-hidden="true">🎓</span>
            </Floating>
            <h2 className="mb-2 text-xl font-semibold text-[color:var(--foreground)] md:text-2xl">
              Teach on SpinChain
            </h2>
            <p className="mb-5 text-sm text-[color:var(--muted)] md:mb-6 md:text-base">
              Preview the builder, compare human and AI-led formats, and decide how you want to launch.
            </p>
            <MagneticButton className="inline-flex items-center gap-2 font-medium text-[color:var(--accent)] transition-colors group-hover:text-[color:var(--accent-strong)]">
              Preview teaching paths
              <svg className="h-4 w-4 transition-transform group-hover:translate-y-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </MagneticButton>
          </a>
        </AnimatedCard>
      </div>
    </header>
  );
}
