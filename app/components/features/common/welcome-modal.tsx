"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LoadingButton } from "../../../components/ui/loading-button";

export const ONBOARDING_KEY = "spinchain-onboarded";
export const LEGACY_WELCOME_KEY = "spin-welcome-seen";
export const GUEST_MODE_KEY = "spin-guest-mode";

const steps = [
  {
    icon: "🚴",
    title: "Start with the path you care about",
    description: "SpinChain supports two clear journeys: riders can jump into classes and demo rides, while instructors can preview the class-building flow and teaching modes.",
    cta: "Next",
  },
  {
    icon: "✨",
    title: "Try the experience before committing",
    description: "You do not need to start with a heavy setup. Riders can explore the free demo first, and instructors can review the builder before deciding what to connect.",
    cta: "Next",
  },
  {
    icon: "🔒",
    title: "Connect when you are ready",
    description: "Wallets and deeper setup matter when you want rewards, payouts, and publishing. The goal of this guide is to help you understand the flow first, not block you at the door.",
    cta: "Done",
  },
];

interface WelcomeModalProps {
  onComplete?: () => void;
  onExploreAsGuest?: () => void;
}

export function WelcomeModal({ onComplete, onExploreAsGuest }: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    localStorage.setItem(LEGACY_WELCOME_KEY, "true");
    onComplete?.();
  };

  const handleSkip = () => {
    handleClose();
  };

  const handleGuestMode = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    localStorage.setItem(LEGACY_WELCOME_KEY, "true");
    localStorage.setItem(GUEST_MODE_KEY, "true");
    onExploreAsGuest?.();
  };

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  const step = steps[currentStep];

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-2xl md:p-8">
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 rounded-full text-[color:var(--muted)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--surface-elevated)] transition-all"
          aria-label="Skip welcome tour"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6" role="tablist" aria-label="Welcome steps">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              role="tab"
              aria-selected={i === currentStep}
              aria-label={`Step ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === currentStep
                  ? "w-8 bg-[color:var(--accent)]"
                  : "w-2 bg-[color:var(--border)] hover:bg-[color:var(--border-strong)]"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">
            Quick tour
          </p>
          <span className="text-5xl md:text-6xl mb-6 block" aria-hidden="true">{step.icon}</span>
          <h2 id="welcome-title" className="text-xl md:text-2xl font-bold text-[color:var(--foreground)] mb-3">
            {step.title}
          </h2>
          <p className="text-sm md:text-base text-[color:var(--muted)] leading-relaxed mb-6">
            {step.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <LoadingButton
            onClick={handleNext}
            className="w-full"
          >
            {step.cta}
          </LoadingButton>

          <button
            onClick={handleGuestMode}
            className="rounded-full border border-[color:var(--border)] px-4 py-3 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:border-[color:var(--accent)]/50"
          >
            Explore rider demo
          </button>

          <Link
            href="/instructor"
            onClick={handleClose}
            className="text-center text-sm text-[color:var(--muted)] transition-colors hover:text-[color:var(--foreground)]"
          >
            Preview instructor flow
          </Link>

          <button
            onClick={handleSkip}
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
          >
            Close guide
          </button>
        </div>

        {/* Step indicator */}
        <p className="text-center text-xs text-[color:var(--muted)] mt-4">
          Step {currentStep + 1} of {steps.length}
        </p>
      </div>
    </div>
  );
}

// Hook to check if user needs onboarding
export function useNeedsOnboarding(): boolean {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const onboarded = localStorage.getItem(ONBOARDING_KEY);
    const legacyWelcomeSeen = localStorage.getItem(LEGACY_WELCOME_KEY);
    // Use a microtask to defer the state update
    Promise.resolve().then(() => {
      setNeedsOnboarding(!onboarded && !legacyWelcomeSeen);
    });
  }, []);

  return needsOnboarding;
}

// Reset onboarding (for testing)
export function resetOnboarding() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem(LEGACY_WELCOME_KEY);
    localStorage.removeItem(GUEST_MODE_KEY);
  }
}
