"use client";

import { useState, useEffect, Suspense } from "react";
import { m, useMotionValue, useSpring } from "framer-motion";
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
import { CoachMemorySection } from "@/app/components/features/home/coach-memory-section";
import { WorldsSection } from "@/app/components/features/home/worlds-section";

function HomeContent() {
  const searchParams = useSearchParams();
  const [showQuiz, setShowQuiz] = useState(false);
  // Follow-cursor glow: an oversized, statically-painted gradient layer moved
  // with a damped spring on transform (GPU composite). The old handler rewrote
  // a full-viewport `background` string on every mousemove — a viewport-wide
  // paint per event — and transition-all animated every property of it.
  const glowX = useMotionValue(0);
  const glowY = useMotionValue(0);
  const springX = useSpring(glowX, { duration: 0.7, bounce: 0 });
  const springY = useSpring(glowY, { duration: 0.7, bounce: 0 });
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
  }, [searchParams, hasProfile]);

  // Own effect: quiz boot paths used to return before attaching this listener,
  // so the follow-cursor glow died after the quiz closed.
  useEffect(() => {
    let frame = 0;
    let pendingX = 0;
    let pendingY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      pendingX = e.clientX - window.innerWidth / 2;
      pendingY = e.clientY - window.innerHeight / 2;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        glowX.set(pendingX);
        glowY.set(pendingY);
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [glowX, glowY]);

  const handleQuizComplete = () => {
    setShowQuiz(false);
  };

  return (
    <div className="relative min-h-screen bg-[color:var(--background)] overflow-x-hidden">
      {showQuiz && (
        <RiderQuiz
          onComplete={handleQuizComplete}
          onSkip={handleQuizComplete}
        />
      )}

      {/* Background gradients: the cursor layer is a static 150vmax radial
          gradient centered on the viewport, offset by the spring — only
          transform changes as the mouse moves. The second gradient is fixed. */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <m.div
          className="absolute h-[150vmax] w-[150vmax]"
          style={{
            left: "calc(50% - 75vmax)",
            top: "calc(50% - 75vmax)",
            x: springX,
            y: springY,
            background:
              "radial-gradient(circle, var(--gradient-from) 0%, transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 80% 20%, var(--gradient-to) 0%, transparent 40%)",
          }}
        />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 md:gap-20 px-6 pb-20 pt-10 lg:px-12">
        <FadeIn>
          {hasProfile ? <PersonalizedHero /> : <HeroSection />}
        </FadeIn>

        {!isReturningRider && <LivePreviewSection />}
        <HowItWorksSection />
        {/* Product truth, not onboarding — shown to returning riders too. */}
        <CoachMemorySection />
        <WorldsSection />
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
