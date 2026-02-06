"use client";

import { useState, useEffect } from "react";
import { LoadingButton } from "./loading-button";

const ONBOARDING_KEY = "spinchain-onboarded";

const steps = [
  {
    icon: "🚴",
    title: "Ride. Earn. Repeat.",
    description: "Join live cycling classes and earn SPIN tokens when you hit your effort goals. The harder you work, the more you earn back.",
    cta: "Get Started",
  },
  {
    icon: "🌍",
    title: "Ride Anywhere",
    description: "From mountain passes to city streets—experience immersive routes from home. Ride with real instructors or meet Coachy, your AI training partner.",
    cta: "Next",
  },
  {
    icon: "🔒",
    title: "Your Data Is Yours",
    description: "We verify your effort for rewards without accessing your personal health data. Private by design.",
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
