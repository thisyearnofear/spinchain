"use client";

import { useState, useEffect } from "react";
import { PrimaryNav } from "./components/nav";
import { BulletList, MetricTile, SurfaceCard, Tag } from "./components/ui";
import { WelcomeModal } from "./components/welcome-modal";

export default function Home() {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Check if user has seen welcome modal
    const hasSeenWelcome = localStorage.getItem("spin-welcome-seen");
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    }
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

  return (
    <div className="min-h-screen bg-gradient-radial">
      {/* Welcome Modal */}
      {showWelcome && (
        <WelcomeModal 
          onComplete={handleWelcomeComplete}
          onExploreAsGuest={handleExploreAsGuest}
        />
      )}
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-20 pt-10 lg:px-12">
        
        {/* Hero */}
        <header className="flex flex-col items-start justify-between gap-8 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 shadow-[0_20px_80px_rgba(0,0,0,0.15)] backdrop-blur">
          <PrimaryNav />
          
          {/* Persona Selection - Primary CTA */}
          <div className="w-full grid lg:grid-cols-2 gap-6 mt-4">
            {/* Rider Card */}
            <a 
              href="/rider"
              className="group relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)]/50 p-8 transition-all hover:border-[color:var(--accent)]/50 hover:bg-[color:var(--accent)]/5"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[color:var(--accent)]/20 to-transparent rounded-bl-full" />
              <span className="text-4xl mb-4 block">🚴</span>
              <h2 className="text-2xl font-semibold text-[color:var(--foreground)] mb-2">
                I'm a Rider
              </h2>
              <p className="text-[color:var(--muted)] mb-6">
                Book classes, track progress, earn rewards for every ride
              </p>
              <span className="inline-flex items-center gap-2 text-[color:var(--accent)] font-medium group-hover:gap-3 transition-all">
                Browse Classes
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </a>

            {/* Instructor Card */}
            <a 
              href="/instructor"
              className="group relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)]/50 p-8 transition-all hover:border-[color:var(--accent)]/50 hover:bg-[color:var(--accent)]/5"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[color:var(--accent-strong)]/20 to-transparent rounded-bl-full" />
              <span className="text-4xl mb-4 block">🎓</span>
              <h2 className="text-2xl font-semibold text-[color:var(--foreground)] mb-2">
                I'm an Instructor
              </h2>
              <p className="text-[color:var(--muted)] mb-6">
                Create classes, set pricing, build your community
              </p>
              <span className="inline-flex items-center gap-2 text-[color:var(--accent)] font-medium group-hover:gap-3 transition-all">
                Start Teaching
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </a>
          </div>
        </header>

        {/* How It Works */}
        <section className="grid gap-6 md:grid-cols-3">
          {howItWorks.map((item) => (
            <div 
              key={item.step}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-6 text-center"
            >
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[color:var(--accent)]/10 text-[color:var(--accent)] font-semibold mb-4">
                {item.step}
              </span>
              <h3 className="text-lg font-semibold text-[color:var(--foreground)] mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-[color:var(--muted)]">
                {item.description}
              </p>
            </div>
          ))}
        </section>

        {/* Live Preview Card */}
        <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-8 backdrop-blur">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--accent)] mb-4">
                Live Preview
              </p>
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
            
            {/* Mock Dashboard */}
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
                <span className="rounded-full bg-[color:var(--success)]/10 px-3 py-1 text-xs text-[color:var(--success)]">
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
                  <p className="text-xs text-[color:var(--success)]">
                    12 SPIN earned so far
                  </p>
                </div>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-3">
                {riderHighlights.map((item) => (
                  <MetricTile key={item.label} {...item} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard
            eyebrow="For Riders"
            title="Ride anywhere, earn everywhere"
            description="From Alpine climbs to city sprints—every route is an immersive experience. Your effort is private, your rewards are real."
            className="rounded-3xl"
          >
            <div className="mt-6 grid gap-3">
              {[
                "3D immersive routes",
                "Private health data",
                "Instant SPIN rewards",
                "Compete with friends",
              ].map((item) => (
                <div 
                  key={item}
                  className="flex items-center gap-3 text-sm text-[color:var(--foreground)]/80"
                >
                  <span className="h-2 w-2 rounded-full bg-[color:var(--accent)]" />
                  {item}
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="For Instructors"
            title="Your class, your economics"
            description="Set your own pricing, keep more of what you earn, and build a community that values your craft."
            className="rounded-3xl bg-[color:var(--surface-strong)]"
          >
            <div className="mt-6 grid gap-3">
              {[
                "Dynamic ticket pricing",
                "Automatic revenue splits",
                "Sponsor reward pools",
                "AI-powered route creation",
              ].map((item) => (
                <div 
                  key={item}
                  className="flex items-center gap-3 text-sm text-[color:var(--foreground)]/80"
                >
                  <span className="h-2 w-2 rounded-full bg-[color:var(--accent)]" />
                  {item}
                </div>
              ))}
            </div>
          </SurfaceCard>
        </section>

        {/* Social Proof */}
        <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-8 text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-strong)] border-2 border-[color:var(--background)]"
                />
              ))}
            </div>
            <p className="text-[color:var(--muted)]">
              <span className="text-[color:var(--foreground)] font-semibold">10,000+</span> riders earning rewards
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
            <div>
              <p className="text-3xl font-bold text-[color:var(--foreground)]">$2.4M</p>
              <p className="text-xs text-[color:var(--muted)] mt-1">Rewards paid</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[color:var(--foreground)]">50K+</p>
              <p className="text-xs text-[color:var(--muted)] mt-1">Classes</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[color:var(--foreground)]">1,200+</p>
              <p className="text-xs text-[color:var(--muted)] mt-1">Instructors</p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="rounded-3xl border border-[color:var(--border)] bg-gradient-to-br from-[color:var(--surface)] to-[color:var(--surface-strong)] p-8 lg:p-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[color:var(--foreground)] mb-4">
            Ready to start?
          </h2>
          <p className="text-[color:var(--muted)] mb-8 max-w-xl mx-auto">
            Join thousands of riders and instructors who are already part of the future of fitness.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/rider"
              className="w-full sm:w-auto px-8 py-3 rounded-full bg-[color:var(--accent)] text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Start Riding
            </a>
            <a
              href="/instructor"
              className="w-full sm:w-auto px-8 py-3 rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] font-medium hover:border-[color:var(--accent)]/50 transition-colors"
            >
              Become an Instructor
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
