"use client";

import { useState, useEffect } from "react";
import { LoadingButton } from "./loading-button";

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
    description: "Connect your heart rate monitor or power meter. The harder you work, the more SPIN you earn. Rewards are calculated automatically and sent to your wallet instantly after class.",
    cta: "Next",
  },
  {
    icon: "🔒",
    title: "Privacy Built-In",
    description: "Unlike other fitness apps, we never see your raw health data. We use zero-knowledge proofs to verify you hit your goals—so you get rewards without sacrificing privacy.",
    cta: "Start Exploring",
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

  useEffect(() => {
    const onboarded = localStorage.getItem(ONBOARDING_KEY);
    if (!onboarded) {
      // Use a microtask to defer the state update
      Promise.resolve().then(() => {
        setIsOpen(true);
        setHasSeenModal(false);
      });
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

  if (hasSeenModal || !isOpen) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-2xl">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
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
          <span className="text-6xl mb-6 block">{step.icon}</span>
          <h2 className="text-2xl font-bold text-[color:var(--foreground)] mb-4">
            {step.title}
          </h2>
          <p className="text-[color:var(--muted)] leading-relaxed mb-8">
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
          
          {isLastStep && (
            <button
              onClick={handleGuestMode}
              className="text-sm text-[color:var(--accent)] hover:text-[color:var(--accent-strong)] transition-colors"
            >
              Explore as Guest →
            </button>
          )}
          
          <button
            onClick={handleSkip}
            className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
          >
            Skip tour
          </button>
        </div>

        {/* Step indicator */}
        <p className="text-center text-xs text-[color:var(--muted)] mt-6">
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
