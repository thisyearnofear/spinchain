"use client";

import { useState, useEffect, useCallback } from "react";

const TUTORIAL_STEPS = [
  {
    title: "Welcome to your HUD",
    content: "This is your performance center. Track your power, cadence, and heart rate as you ride.",
    position: "top-1/4 left-1/2 -translate-x-1/2",
  },
  {
    title: "Earn as you sweat",
    content: "Your Effort Score (bottom right) determines your SPIN rewards. The harder you work, the more you earn!",
    position: "top-20 right-10",
  },
  {
    title: "Real-time Rewards",
    content: "Enable 'Live Mode' for instant rewards during your ride, or 'Standard Mode' for private, batched rewards.",
    position: "bottom-48 left-10",
  },
  {
    title: "Private & Secure",
    content: "Your health data is private. We only verify your effort on the blockchain without ever seeing your raw biometrics.",
    position: "bottom-40 right-10",
  },
  {
    title: "Ready to Start?",
    content: "Link your bike or use the simulator to begin your journey.",
    position: "bottom-32 left-1/2 -translate-x-1/2",
  },
];

const STORAGE_KEY = "spinchain:onboarding:ride-tutorial";

export function useRideTutorial() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const hasSeenTutorial = localStorage.getItem(STORAGE_KEY);
    if (!hasSeenTutorial || searchParams.get("setup") === "true") {
      setShowTutorial(true);
    }
  }, []);

  const nextStep = useCallback(() => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(s => s + 1);
    } else {
      setShowTutorial(false);
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }, [tutorialStep]);

  const dismiss = useCallback(() => {
    setShowTutorial(false);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  return { showTutorial, tutorialStep, nextStep, dismiss };
}

export function RideTutorialOverlay({
  step,
  onNext,
  onDismiss,
}: {
  step: number;
  onNext: () => void;
  onDismiss: () => void;
}) {
  const currentStep = TUTORIAL_STEPS[step];
  if (!currentStep) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-500 p-6">
      <div className={`absolute ${currentStep.position} max-w-sm w-full transform transition-all duration-500 scale-100 opacity-100`}>
        <div className="rounded-3xl border border-white/20 bg-indigo-600/90 p-8 shadow-[0_20px_50px_rgba(79,70,229,0.3)] backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">
              Step {step + 1} of {TUTORIAL_STEPS.length}
            </span>
            <button
              onClick={onDismiss}
              className="text-indigo-200 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">
            {currentStep.title}
          </h3>
          <p className="text-indigo-50/80 leading-relaxed mb-8">
            {currentStep.content}
          </p>
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={onDismiss}
              className="text-sm font-medium text-indigo-200 hover:text-white transition-colors"
            >
              Skip tutorial
            </button>
            <button
              onClick={onNext}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-indigo-600 shadow-xl shadow-white/10 hover:bg-indigo-50 active:scale-95 transition-all"
            >
              <span>{step === TUTORIAL_STEPS.length - 1 ? "Got it!" : "Next"}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[16px] border-t-indigo-600/90 opacity-0 sm:opacity-100" />
      </div>
    </div>
  );
}
