"use client";

import { motion } from "framer-motion";
import { PrimaryNav } from "@/app/components/layout/nav";
import { AnimatedCard, Floating, MagneticButton } from "@/app/components/ui/animated-card";
import Link from "next/link";

const communityStats = [
  { label: "Total Riders", value: "10K+", subtitle: "Year 1 target" },
  { label: "Classes Hosted", value: "50K+", subtitle: "Year 1 target" },
  { label: "Rewards Paid", value: "$2.4M", subtitle: "Year 1 target" },
];

export function HeroSection() {
  return (
    <header className="flex flex-col items-start justify-between gap-6 md:gap-8 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-6 py-6 md:px-8 md:py-8 shadow-[0_20px_80px_rgba(0,0,0,0.15)] backdrop-blur">
      <PrimaryNav />

      {/* Clear What-We-Do Statement */}
      <div className="w-full text-center py-8 md:py-12 border-y border-[color:var(--border)] relative overflow-hidden">
        {/* Decorative background light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[color:var(--accent)]/5 blur-[120px] pointer-events-none" />

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-[color:var(--foreground)] mb-5 md:mb-6 drop-shadow-2xl leading-tight">
          Elevate Your Spin.<br />
          <span className="bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-strong)] bg-clip-text text-transparent">Earn Onchain.</span>
        </h1>
        <p className="text-base md:text-lg lg:text-xl text-[color:var(--muted)] max-w-2xl mx-auto font-medium leading-relaxed px-4">
          Transform any spin bike into a high-performance 3D experience.
          <span className="text-[color:var(--foreground)]"> Earn SPIN tokens</span> as you crush your goals.
        </p>
      </div>

      {/* Community Stats Ticker */}
      <div
        className="w-full flex flex-wrap justify-center gap-6 md:gap-10 py-5 md:py-6 bg-[color:var(--surface)]/50 backdrop-blur-sm rounded-b-2xl"
        role="region"
        aria-label="Community statistics"
      >
        {communityStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className="flex items-center gap-3"
          >
            <div className="text-center">
              <motion.p
                className="text-xl md:text-2xl font-bold text-[color:var(--foreground)]"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
              >
                {stat.value}
              </motion.p>
              <p className="text-xs text-[color:var(--muted)] uppercase tracking-wider">{stat.label}</p>
              {stat.subtitle && (
                <p className="text-[10px] text-[color:var(--accent)] font-medium mt-0.5">{stat.subtitle}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Persona Selection - Primary CTA */}
      <div className="w-full grid lg:grid-cols-2 gap-4 md:gap-6 mt-2">
        {/* Rider Card */}
        <AnimatedCard glowColor="var(--accent)">
          <Link
            href="/rider"
            className="group block relative overflow-hidden p-6 md:p-8 h-full"
            aria-label="Start riding - find classes and earn rewards"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[color:var(--accent)]/20 to-transparent rounded-bl-full" />
            <Floating delay={0}>
              <span className="text-4xl md:text-5xl mb-4 block" aria-hidden="true">🚴</span>
            </Floating>
            <h2 className="text-xl md:text-2xl font-semibold text-[color:var(--foreground)] mb-2">
              I Want to Ride
            </h2>
            <p className="text-sm md:text-base text-[color:var(--muted)] mb-5 md:mb-6">
              Join live classes, track your effort, and earn rewards automatically
            </p>
            <MagneticButton className="inline-flex items-center gap-2 text-[color:var(--accent)] font-medium pointer-events-none group-hover:text-[color:var(--accent-strong)] transition-colors">
              Find Classes
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </MagneticButton>
          </Link>
        </AnimatedCard>

        {/* Instructor Card */}
        <AnimatedCard glowColor="var(--accent-strong)">
          <a
            href="#instructor-modes"
            className="group block relative overflow-hidden p-6 md:p-8 h-full"
            aria-label="Become an instructor - teach classes and earn"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-transparent rounded-bl-full" />
            <Floating delay={0.5}>
              <span className="text-4xl md:text-5xl mb-4 block" aria-hidden="true">🎓</span>
            </Floating>
            <h2 className="text-xl md:text-2xl font-semibold text-[color:var(--foreground)] mb-2">
              I Want to Teach
            </h2>
            <p className="text-sm md:text-base text-[color:var(--muted)] mb-5 md:mb-6">
              Host classes, set your price, and earn from every rider
            </p>
            <MagneticButton className="inline-flex items-center gap-2 text-[color:var(--accent)] font-medium group-hover:text-[color:var(--accent-strong)] transition-colors">
              See How It Works
              <svg className="w-4 h-4 group-hover:translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </MagneticButton>
          </a>
        </AnimatedCard>
      </div>
    </header>
  );
}