"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

type TutorialAudience = "web3" | "fitness";

export interface TutorialStepDef {
  title: string;
  content: string;
  position: string;
  audience: TutorialAudience;
  spotlight?: "center" | "top-right" | "bottom-left" | "bottom-right" | "bottom-center";
}

const ALL_STEPS: TutorialStepDef[] = [
  {
    title: "Welcome to your HUD",
    content: "This is your performance center. Track your power, cadence, and heart rate as you ride.",
    position: "top-1/4 left-1/2 -translate-x-1/2",
    audience: "fitness",
    spotlight: "center",
  },
  {
    title: "Effort Score",
    content: "Your Effort Score (bottom right) measures workout intensity. Aim for 700+ for a strong session!",
    position: "top-20 right-10",
    audience: "fitness",
    spotlight: "bottom-right",
  },
  {
    title: "Earn as you sweat",
    content: "Your Effort Score determines your SPIN token rewards. The harder you work, the more you earn!",
    position: "top-20 right-10",
    audience: "web3",
    spotlight: "bottom-right",
  },
  {
    title: "Real-time Rewards",
    content: "Enable 'Live Mode' for instant rewards during your ride, or 'Standard Mode' for private, batched rewards.",
    position: "bottom-48 left-10",
    audience: "web3",
    spotlight: "bottom-left",
  },
  {
    title: "Private & Secure",
    content: "Your health data is private. We only verify your effort on the blockchain without ever seeing your raw biometrics.",
    position: "bottom-40 right-10",
    audience: "web3",
    spotlight: "bottom-right",
  },
  {
    title: "Ready to Start?",
    content: "Link your bike or use the simulator to begin your journey.",
    position: "bottom-32 left-1/2 -translate-x-1/2",
    audience: "fitness",
    spotlight: "bottom-center",
  },
];

const STORAGE_KEY = "spinchain:onboarding:ride-tutorial";
export type TutorialStep = number;

export function useRideTutorial(opts?: { isPracticeMode?: boolean; walletConnected?: boolean }) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  const audience: TutorialAudience =
    opts?.isPracticeMode || !opts?.walletConnected ? "fitness" : "web3";

  const steps = useMemo(
    () => ALL_STEPS.filter((s) => s.audience === "fitness" || audience === "web3"),
    [audience],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const hasSeenTutorial = localStorage.getItem(STORAGE_KEY);
    if (!hasSeenTutorial || searchParams.get("setup") === "true") {
      const frame = window.requestAnimationFrame(() => {
        setShowTutorial(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  const nextStep = useCallback(() => {
    if (tutorialStep < steps.length - 1) {
      setTutorialStep(s => s + 1);
    } else {
      setShowTutorial(false);
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }, [tutorialStep, steps.length]);

  const dismiss = useCallback(() => {
    setShowTutorial(false);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  return { showTutorial, tutorialStep, nextStep, dismiss, steps };
}

export function RideTutorialOverlay({
  step,
  steps,
  onNext,
  onDismiss,
}: {
  step: number;
  steps: TutorialStepDef[];
  onNext: () => void;
  onDismiss: () => void;
}) {
  const currentStep = steps[step];
  const overlayRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    nextBtnRef.current?.focus();
  }, [step]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onDismiss();
    } else if (e.key === "Enter" || e.key === " ") {
      if (e.target === overlayRef.current) {
        e.preventDefault();
        onNext();
      }
    }
  }, [onDismiss, onNext]);

  if (!currentStep) return null;

  const spotlightStyles: Record<string, string> = {
    "center": "radial-gradient(circle at 50% 50%, transparent 120px, rgba(0,0,0,0.6) 200px)",
    "top-right": "radial-gradient(circle at 85% 15%, transparent 100px, rgba(0,0,0,0.6) 180px)",
    "bottom-left": "radial-gradient(circle at 15% 85%, transparent 100px, rgba(0,0,0,0.6) 180px)",
    "bottom-right": "radial-gradient(circle at 85% 85%, transparent 100px, rgba(0,0,0,0.6) 180px)",
    "bottom-center": "radial-gradient(circle at 50% 85%, transparent 120px, rgba(0,0,0,0.6) 200px)",
  };

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      className="fixed inset-0 z-[200] flex items-center justify-center transition-all duration-500 p-6"
      style={{
        background: currentStep.spotlight
          ? spotlightStyles[currentStep.spotlight]
          : "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div className={`absolute ${currentStep.position} max-w-sm w-full transform transition-all duration-500 scale-100 opacity-100`}>
        <div className="rounded-3xl border border-white/20 bg-indigo-600/90 p-8 shadow-[0_20px_50px_rgba(79,70,229,0.3)] backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">
              Step {step + 1} of {steps.length}
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
          <h3 id="tutorial-title" className="text-2xl font-bold text-white mb-3">
            {currentStep.title}
          </h3>
          <p className="text-indigo-50/80 leading-relaxed mb-8">
            {currentStep.content}
          </p>
          <div className="flex items-center justify-between gap-4">
            {/* Progress dots */}
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-6 bg-white" : i < step ? "w-1.5 bg-white/60" : "w-1.5 bg-white/20"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
            <button
              onClick={onDismiss}
              className="text-sm font-medium text-indigo-200 hover:text-white transition-colors"
            >
              Skip tutorial
            </button>
            <button
              ref={nextBtnRef}
              onClick={onNext}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-indigo-600 shadow-xl shadow-white/10 hover:bg-indigo-50 active:scale-95 transition-all"
            >
              <span>{step === steps.length - 1 ? "Got it!" : "Next"}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[16px] border-t-indigo-600/90 opacity-0 sm:opacity-100" />
      </div>
    </div>
  );
}
