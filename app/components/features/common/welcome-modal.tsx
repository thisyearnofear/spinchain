"use client";

import { useState, useEffect } from "react";
import { LoadingButton } from "../../../components/ui/loading-button";

const ONBOARDING_KEY = "spinchain-onboarded";

const steps = [
  {
    icon: "🚴",
    title: "What is SpinChain?",
    description: "The first indoor cycling platform that rewards your workouts with real crypto (SPIN tokens). Take live classes from home, hit your effort goals, and earn instantly—while keeping your health data completely private.",
    cta: "How It Works",
  },
  {
    icon: "💰",
    title: "Earn As You Ride",
    description: "Connect your heart rate monitor or power meter. The harder you work, the more SPIN you earn. Choose instant Yellow streaming rewards or private ZK batch rewards — both send SPIN to your wallet automatically.",
    cta: "Next",
  },
  {
    icon: "🔒",
    title: "Privacy Built-In",
    description: "Unlike other fitness apps, we never see your raw health data. We use zero-knowledge proofs to verify you hit your goals—so you get rewards without sacrificing privacy.",
    cta: "Get Started",
  },
];

interface WelcomeModalProps {
  onComplete?: () => void;
  onExploreAsGuest?: () => void;
}

export function WelcomeModal({ onComplete, onExploreAsGuest }: WelcomeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenModal, setHasSeenModal] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Set mounted to true - this runs after hydration
    setMounted(true);
    
    const onboarded = localStorage.getItem(ONBOARDING_KEY);
    if (!onboarded) {
      setIsOpen(true);
      setHasSeenModal(false);
    }
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
    setIsOpen(false);
    setHasSeenModal(true);
    onComplete?.();
  };

  const handleSkip = () => {
    handleClose();
  };

  const handleGuestMode = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    localStorage.setItem("spin-guest-mode", "true");
    setIsOpen(false);
    setHasSeenModal(true);
    onExploreAsGuest?.();
  };

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  if (hasSeenModal || !isOpen) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="w-full max-w-lg rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 md:p-8 shadow-2xl">
        {/* Skip button - more prominent */}
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
            onClick={handleSkip}
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
          >
            Skip for now
          </button>
          
          {isLastStep && (
            <button
              onClick={handleGuestMode}
              className="text-sm text-[color:var(--accent)] hover:text-[color:var(--accent-strong)] transition-colors"
            >
              Explore as Guest →
            </button>
          )}
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
    // Use a microtask to defer the state update
    Promise.resolve().then(() => {
      setNeedsOnboarding(!onboarded);
    });
  }, []);

  return needsOnboarding;
}

// Reset onboarding (for testing)
export function resetOnboarding() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ONBOARDING_KEY);
  }
}
