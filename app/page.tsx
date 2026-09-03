"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  RiderQuiz,
  resetQuiz,
  RIDER_QUIZ_KEY,
} from "@/app/components/features/common/rider-quiz";
import { STORAGE_KEYS } from "@/app/lib/analytics/ride-history";
import { useRiderProfile } from "@/app/stores/rider-profile-store";
import { useRiderStats } from "@/app/hooks/common/use-rider-stats";

import { FadeIn } from "@/app/components/ui/scroll-animations";
import { RouteShowcase } from "@/app/components/features/route/route-showcase";
import { HeroSection } from "@/app/components/features/home/hero-section";
import { PersonalizedHero } from "@/app/components/features/home/personalized-hero";
import { HowItWorksSection } from "@/app/components/features/home/how-it-works-section";
import { LivePreviewSection } from "@/app/components/features/home/live-preview-section";
import { FeaturesGridSection } from "@/app/components/features/home/features-grid-section";
import { FinalCTASection } from "@/app/components/features/home/final-cta-section";

function HomeContent() {
  const searchParams = useSearchParams();
  const [showQuiz, setShowQuiz] = useState(false);
  // Follow-cursor gradient: write straight to the DOM so mousemove never
  // re-renders the landing tree.
  const gradientRef = useRef<HTMLDivElement>(null);
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

    // Show quiz for first-time visitors ONLY after their first ride
    // (wedge: let them experience the product before asking for information)
    if (!hasProfile) {
      const completed = localStorage.getItem(RIDER_QUIZ_KEY);
      const postRide = localStorage.getItem(STORAGE_KEYS.quizPostRide);
      if (!completed && postRide === "true") {
        const frame = window.requestAnimationFrame(() => {
          setShowQuiz(true);
        });
        return () => window.cancelAnimationFrame(frame);
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const el = gradientRef.current;
      if (!el) return;
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      el.style.background = `radial-gradient(circle at ${x}% ${y}%, var(--gradient-from) 0%, transparent 50%),
                             radial-gradient(circle at 80% 20%, var(--gradient-to) 0%, transparent 40%)`;
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
        ref={gradientRef}
        className="fixed inset-0 pointer-events-none transition-all duration-700 ease-out"
        style={{
          background: `radial-gradient(circle at 50% 50%, var(--gradient-from) 0%, transparent 50%),
                       radial-gradient(circle at 80% 20%, var(--gradient-to) 0%, transparent 40%)`,
        }}
      />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 md:gap-20 px-6 pb-20 pt-10 lg:px-12">
        <FadeIn>
          {hasProfile ? <PersonalizedHero /> : <HeroSection onOpenGuide={() => setShowQuiz(true)} />}
        </FadeIn>

        <HowItWorksSection />
        {!isReturningRider && <LivePreviewSection />}
        <RouteShowcase />
        {!isReturningRider && <FeaturesGridSection />}
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
