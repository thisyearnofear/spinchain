"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WelcomeModal, resetOnboarding } from "@/app/components/features/common/welcome-modal";
import { InstructorModeSelector } from "@/app/components/features/class/instructor-mode-selector";
import { FadeIn } from "@/app/components/ui/scroll-animations";
import { Tag } from "@/app/components/ui/ui";
import { RouteShowcase } from "@/app/components/features/route/route-showcase";
import { HeroSection } from "@/app/components/features/home/hero-section";
import { HowItWorksSection } from "@/app/components/features/home/how-it-works-section";
import { LivePreviewSection } from "@/app/components/features/home/live-preview-section";
import { FeaturesGridSection } from "@/app/components/features/home/features-grid-section";
import { SocialProofSection } from "@/app/components/features/home/social-proof-section";
import { FinalCTASection } from "@/app/components/features/home/final-cta-section";

function HomeContent() {
  const searchParams = useSearchParams();
  const [showWelcome, setShowWelcome] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (searchParams.get("reset") === "true") {
      resetOnboarding();
      localStorage.removeItem("spin-welcome-seen");
      localStorage.removeItem("spin-guest-mode");
    }
    const hasSeenWelcome = localStorage.getItem("spin-welcome-seen");
    if (!hasSeenWelcome) {
      setShowWelcome(true);
    }

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [searchParams]);

  const handleWelcomeComplete = () => {
    localStorage.setItem("spin-welcome-seen", "true");
    setShowWelcome(false);
  };

  const handleExploreAsGuest = () => {
    localStorage.setItem("spin-welcome-seen", "true");
    localStorage.setItem("spin-guest-mode", "true");
    setShowWelcome(false);
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)] overflow-x-hidden">
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

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 md:gap-20 px-6 pb-20 pt-10 lg:px-12">
        <FadeIn>
          <HeroSection />
        </FadeIn>

        {/* Instructor Mode Selector */}
        <section id="instructor-modes">
          <FadeIn direction="up">
            <div className="text-center mb-8">
              <Tag>Two Ways to Teach</Tag>
              <h2 className="text-2xl md:text-3xl font-bold text-[color:var(--foreground)] mt-4">
                Choose Your Path
              </h2>
              <p className="text-sm md:text-base text-[color:var(--muted)] mt-2 max-w-xl mx-auto">
                Whether you prefer hands-on creativity or autonomous AI coaching,
                SpinChain supports your teaching style.
              </p>
            </div>
          </FadeIn>
          <InstructorModeSelector />
        </section>

        <HowItWorksSection />
        <LivePreviewSection />
        <RouteShowcase />
        <FeaturesGridSection />
        <SocialProofSection />
        <FinalCTASection />
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}