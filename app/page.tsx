"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PrimaryNav } from "./components/nav";
import { BulletList, MetricTile, SurfaceCard, Tag } from "./components/ui";
import { WelcomeModal } from "./components/welcome-modal";
import { InstructorModeSelector } from "./components/instructor-mode-selector";
import { FadeIn, StaggerContainer, Parallax, ScaleIn } from "./components/scroll-animations";
import { AnimatedCard, EnergyPulse, Floating, MagneticButton } from "./components/animated-card";
import { RouteShowcase } from "./components/route-showcase";

export default function Home() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("spin-welcome-seen");
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    }

    // Track mouse for background effect
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleWelcomeComplete = () => {
    localStorage.setItem("spin-welcome-seen", "true");
    setShowWelcome(false);
  };

  const handleExploreAsGuest = () => {
    localStorage.setItem("spin-welcome-seen", "true");
    localStorage.setItem("spin-guest-mode", "true");
    setShowWelcome(false);
  };

  const riderHighlights = [
    { label: "Avg Heart Rate", value: "148 BPM", detail: "Zone 4 sustained" },
    { label: "Classes Completed", value: "12", detail: "This month" },
    { label: "SPIN Earned", value: "240", detail: "$48 value" },
  ];

  const howItWorks = [
    {
      step: "1",
      title: "Book a Class",
      description: "Browse immersive routes from top instructors",
    },
    {
      step: "2",
      title: "Ride & Track",
      description: "Connect your devices and ride",
    },
    {
      step: "3",
      title: "Earn Rewards",
      description: "Hit goals, get SPIN tokens automatically",
    },
  ];

  const liveStats = [
    { label: "Active Riders", value: "1,247", change: "+12%" },
    { label: "Classes Today", value: "42", change: "Live" },
    { label: "SPIN Distributed", value: "50K", change: "+8%" },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--background)] overflow-x-hidden">
      {/* Welcome Modal */}
      {showWelcome && (
        <WelcomeModal 
          onComplete={handleWelcomeComplete}
          onExploreAsGuest={handleExploreAsGuest}
        />
      )}

      {/* Animated background gradient */}
      <div 
        className="fixed inset-0 pointer-events-none transition-all duration-700 ease-out"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, var(--gradient-from) 0%, transparent 50%),
                       radial-gradient(circle at 80% 20%, var(--gradient-to) 0%, transparent 40%)`,
        }}
      />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 pb-20 pt-10 lg:px-12">
        
        {/* Hero */}
        <FadeIn>
          <header className="flex flex-col items-start justify-between gap-8 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 shadow-[0_20px_80px_rgba(0,0,0,0.15)] backdrop-blur">
            <PrimaryNav />
            
            {/* Live Stats Ticker */}
            <div className="w-full flex flex-wrap justify-center gap-8 py-4 border-y border-[color:var(--border)]">
              {liveStats.map((stat, i) => (
                <motion.div 
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  {stat.change === "Live" && <EnergyPulse size="sm" />}
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[color:var(--foreground)]">{stat.value}</p>
                    <p className="text-xs text-[color:var(--muted)] uppercase tracking-wider">{stat.label}</p>
                  </div>
                  {stat.change !== "Live" && (
                    <span className="text-xs text-[color:var(--success)]">{stat.change}</span>
                  )}
                </motion.div>
              ))}
            </div>
            
            {/* Persona Selection - Primary CTA */}
            <div className="w-full grid lg:grid-cols-2 gap-6 mt-4">
              {/* Rider Card */}
              <AnimatedCard glowColor="var(--accent)">
                <a 
                  href="/rider"
                  className="group block relative overflow-hidden p-8 h-full"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[color:var(--accent)]/20 to-transparent rounded-bl-full" />
                  <Floating delay={0}>
                    <span className="text-5xl mb-4 block">🚴</span>
                  </Floating>
                  <h2 className="text-2xl font-semibold text-[color:var(--foreground)] mb-2">
                    I'm a Rider
                  </h2>
                  <p className="text-[color:var(--muted)] mb-6">
                    Book classes, track progress, earn rewards for every ride
                  </p>
                  <MagneticButton className="inline-flex items-center gap-2 text-[color:var(--accent)] font-medium">
                    Browse Classes
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </MagneticButton>
                </a>
              </AnimatedCard>

              {/* Instructor Card - Now with mode selector below */}
              <AnimatedCard glowColor="var(--accent-strong)">
                <div className="p-8 h-full">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-transparent rounded-bl-full" />
                  <Floating delay={0.5}>
                    <span className="text-5xl mb-4 block">🎓</span>
                  </Floating>
                  <h2 className="text-2xl font-semibold text-[color:var(--foreground)] mb-2">
                    I'm an Instructor
                  </h2>
                  <p className="text-[color:var(--muted)] mb-6">
                    Human-crafted or AI-powered—choose your teaching style
                  </p>
                  <MagneticButton className="inline-flex items-center gap-2 text-[color:var(--accent)] font-medium">
                    <a href="#instructor-modes" className="flex items-center gap-2">
                      Explore Options
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </a>
                  </MagneticButton>
                </div>
              </AnimatedCard>
            </div>
          </header>
        </FadeIn>

        {/* Instructor Mode Selector - NEW */}
        <section id="instructor-modes">
          <FadeIn direction="up">
            <div className="text-center mb-8">
              <Tag>Two Ways to Teach</Tag>
              <h2 className="text-3xl font-bold text-[color:var(--foreground)] mt-4">
                Choose Your Path
              </h2>
              <p className="text-[color:var(--muted)] mt-2 max-w-xl mx-auto">
                Whether you prefer hands-on creativity or autonomous AI coaching, 
                SpinChain supports your teaching style.
              </p>
            </div>
          </FadeIn>
          <InstructorModeSelector />
        </section>

        {/* How It Works */}
        <section>
          <FadeIn direction="up">
            <div className="text-center mb-12">
              <Tag>Simple as 1-2-3</Tag>
              <h2 className="text-3xl font-bold text-[color:var(--foreground)] mt-4">
                How It Works
              </h2>
            </div>
          </FadeIn>
          <StaggerContainer className="grid gap-6 md:grid-cols-3" staggerDelay={0.15}>
            {howItWorks.map((item) => (
              <div 
                key={item.step}
                className="group rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-6 text-center hover:border-[color:var(--accent)]/30 transition-colors"
              >
                <motion.span 
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[color:var(--accent)]/10 text-[color:var(--accent)] font-semibold mb-4"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  {item.step}
                </motion.span>
                <h3 className="text-lg font-semibold text-[color:var(--foreground)] mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-[color:var(--muted)]">
                  {item.description}
                </p>
              </div>
            ))}
          </StaggerContainer>
        </section>

        {/* Live Preview Card */}
        <Parallax speed={0.3}>
          <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-8 backdrop-blur">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
              <FadeIn direction="left">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <EnergyPulse size="sm" />
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--accent)]">
                      Live Preview
                    </p>
                  </div>
                  <h2 className="text-3xl font-semibold text-[color:var(--foreground)] mb-4">
                    Your workout, rewarded
                  </h2>
                  <p className="text-[color:var(--muted)] mb-6 leading-relaxed">
                    See your effort translate to rewards in real-time. Heart rate, power, and progress—all in one beautiful dashboard.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Tag>Real-time tracking</Tag>
                    <Tag>Instant rewards</Tag>
                    <Tag>Private by default</Tag>
                  </div>
                </div>
              </FadeIn>
              
              {/* Mock Dashboard */}
              <ScaleIn delay={0.2}>
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                        Current Session
                      </p>
                      <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
                        Alpine Climb
                      </h3>
                    </div>
                    <span className="flex items-center gap-2 rounded-full bg-[color:var(--success)]/10 px-3 py-1 text-xs text-[color:var(--success)]">
                      <EnergyPulse size="sm" />
                      Live
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-6 mb-6">
                    <div className="relative grid h-24 w-24 place-items-center rounded-full bg-[conic-gradient(from_180deg,var(--success)_0deg,var(--success)_260deg,var(--surface-elevated)_260deg)]">
                      <div className="grid h-18 w-18 place-items-center rounded-full bg-[color:var(--surface-strong)] text-sm font-semibold text-[color:var(--foreground)]">
                        82%
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-[color:var(--muted)]">Effort zone</p>
                      <p className="text-lg font-semibold text-[color:var(--foreground)]">HR 148 • 32 min</p>
                      <motion.p 
                        className="text-xs text-[color:var(--success)]"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        12 SPIN earned so far
                      </motion.p>
                    </div>
                  </div>
                  
                  <div className="grid gap-3 sm:grid-cols-3">
                    {riderHighlights.map((item) => (
                      <MetricTile key={item.label} {...item} />
                    ))}
                  </div>
                </div>
              </ScaleIn>
            </div>
          </section>
        </Parallax>

        {/* Route Showcase - NEW */}
        <RouteShowcase />

        {/* Features Grid */}
        <section className="grid gap-6 lg:grid-cols-2">
          <FadeIn direction="left">
            <SurfaceCard
              eyebrow="For Riders"
              title="Ride anywhere, earn everywhere"
              description="From Alpine climbs to city sprints—every route is an immersive experience. Your effort is private, your rewards are real."
              className="rounded-3xl h-full"
            >
              <div className="mt-6 grid gap-3">
                {[
                  "3D immersive routes",
                  "Private health data",
                  "Instant SPIN rewards",
                  "Compete with friends",
                ].map((item, i) => (
                  <motion.div 
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-3 text-sm text-[color:var(--foreground)]/80"
                  >
                    <motion.span 
                      className="h-2 w-2 rounded-full bg-[color:var(--accent)]"
                      whileHover={{ scale: 1.5 }}
                    />
                    {item}
                  </motion.div>
                ))}
              </div>
            </SurfaceCard>
          </FadeIn>

          <FadeIn direction="right">
            <SurfaceCard
              eyebrow="For Instructors"
              title="Your class, your economics"
              description="Set your own pricing, keep more of what you earn, and build a community that values your craft."
              className="rounded-3xl bg-[color:var(--surface-strong)] h-full"
            >
              <div className="mt-6 grid gap-3">
                {[
                  "Dynamic ticket pricing",
                  "Automatic revenue splits",
                  "Sponsor reward pools",
                  "AI-powered route creation",
                ].map((item, i) => (
                  <motion.div 
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-3 text-sm text-[color:var(--foreground)]/80"
                  >
                    <motion.span 
                      className="h-2 w-2 rounded-full bg-[color:var(--accent)]"
                      whileHover={{ scale: 1.5 }}
                    />
                    {item}
                  </motion.div>
                ))}
              </div>
            </SurfaceCard>
          </FadeIn>
        </section>

        {/* Social Proof */}
        <FadeIn>
          <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-8 text-center">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1, type: "spring" }}
                    viewport={{ once: true }}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-strong)] border-2 border-[color:var(--background)]"
                  />
                ))}
              </div>
              <p className="text-[color:var(--muted)]">
                <span className="text-[color:var(--foreground)] font-semibold">10,000+</span> riders earning rewards
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
              {[
                { value: "$2.4M", label: "Rewards paid" },
                { value: "50K+", label: "Classes" },
                { value: "1,200+", label: "Instructors" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                >
                  <p className="text-3xl font-bold text-[color:var(--foreground)]">{stat.value}</p>
                  <p className="text-xs text-[color:var(--muted)] mt-1">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </section>
        </FadeIn>

        {/* Final CTA */}
        <FadeIn>
          <section className="rounded-3xl border border-[color:var(--border)] bg-gradient-to-br from-[color:var(--surface)] to-[color:var(--surface-strong)] p-8 lg:p-12 text-center relative overflow-hidden">
            {/* Animated background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-[color:var(--accent)]/5 via-transparent to-[color:var(--accent-strong)]/5"
              animate={{
                x: ["-100%", "100%"],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "linear",
              }}
            />
            
            <div className="relative">
              <h2 className="text-3xl lg:text-4xl font-bold text-[color:var(--foreground)] mb-4">
                Ready to start?
              </h2>
              <p className="text-[color:var(--muted)] mb-8 max-w-xl mx-auto">
                Join thousands of riders and instructors who are already part of the future of fitness.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <MagneticButton className="w-full sm:w-auto">
                  <a
                    href="/rider"
                    className="inline-block w-full px-8 py-3 rounded-full bg-[color:var(--accent)] text-white font-semibold hover:opacity-90 transition-opacity"
                  >
                    Start Riding
                  </a>
                </MagneticButton>
                <MagneticButton className="w-full sm:w-auto">
                  <a
                    href="#instructor-modes"
                    className="inline-block w-full px-8 py-3 rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] font-medium hover:border-[color:var(--accent)]/50 transition-colors"
                  >
                    Become an Instructor
                  </a>
                </MagneticButton>
              </div>
            </div>
          </section>
        </FadeIn>
      </main>
    </div>
  );
}
