"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  RiderQuiz,
  resetQuiz,
  RIDER_QUIZ_KEY,
} from "@/app/components/features/common/rider-quiz";
import { useRiderProfile } from "@/app/stores/rider-profile-store";
import { useRiderStats } from "@/app/hooks/common/use-rider-stats";
import { InstructorModeSelector } from "@/app/components/features/class/instructor-mode-selector";
import { FadeIn } from "@/app/components/ui/scroll-animations";
import { Tag } from "@/app/components/ui/ui";
import { RouteShowcase } from "@/app/components/features/route/route-showcase";
import { HeroSection } from "@/app/components/features/home/hero-section";
import { PersonalizedHero } from "@/app/components/features/home/personalized-hero";
import { HowItWorksSection } from "@/app/components/features/home/how-it-works-section";
import { LivePreviewSection } from "@/app/components/features/home/live-preview-section";
import { FeaturesGridSection } from "@/app/components/features/home/features-grid-section";
import { SocialProofSection } from "@/app/components/features/home/social-proof-section";
import { FinalCTASection } from "@/app/components/features/home/final-cta-section";

function HomeContent() {
  const searchParams = useSearchParams();
  const [showQuiz, setShowQuiz] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const profile = useRiderProfile();
  const riderStats = useRiderStats();
  const hasProfile = profile.createdAt !== null;
  const isReturningRider = hasProfile && riderStats.hasRides;

  useEffect(() => {
    if (searchParams.get("reset") === "true") {
      resetQuiz();
    }

    if (searchParams.get("welcome") === "true" || searchParams.get("reset") === "true") {
      const frame = window.requestAnimationFrame(() => {
        setShowQuiz(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    // Show quiz for first-time visitors
    if (!hasProfile) {
      const completed = localStorage.getItem(RIDER_QUIZ_KEY);
      if (!completed) {
        const frame = window.requestAnimationFrame(() => {
          setShowQuiz(true);
        });
        return () => window.cancelAnimationFrame(frame);
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [searchParams, hasProfile]);

  const handleQuizComplete = () => {
    setShowQuiz(false);
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)] overflow-x-hidden">
      {showQuiz && (
        <RiderQuiz
          onComplete={handleQuizComplete}
          onSkip={handleQuizComplete}
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
          {hasProfile ? <PersonalizedHero /> : <HeroSection onOpenGuide={() => setShowQuiz(true)} />}
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
        {!isReturningRider && <LivePreviewSection />}
        <RouteShowcase />
        {!isReturningRider && <FeaturesGridSection />}
        {!isReturningRider && <SocialProofSection />}
        {!isReturningRider && <FinalCTASection />}
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
