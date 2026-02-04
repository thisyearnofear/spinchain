"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EnergyPulse, MagneticButton } from "./animated-card";

interface OnboardingStep {
  id: string;
  icon: string;
  title: string;
  description: string;
  action: string;
  color: string;
}

const steps: OnboardingStep[] = [
  {
    id: "connect",
    icon: "🔗",
    title: "Connect Your Wallet",
    description: "Link your crypto wallet to book classes, track progress, and earn SPIN rewards for every ride.",
    action: "Connect Wallet",
    color: "from-indigo-500 to-purple-500"
  },
  {
    id: "book",
    icon: "🚴",
    title: "Book Your First Class",
    description: "Choose from immersive routes crafted by human instructors or AI agents. Find your perfect ride.",
    action: "Browse Classes",
    color: "from-cyan-500 to-blue-500"
  },
  {
    id: "earn",
    icon: "💎",
    title: "Earn SPIN Rewards",
    description: "Hit your effort goals and automatically receive SPIN tokens. Your workout finally pays off.",
    action: "Start Earning",
    color: "from-emerald-500 to-teal-500"
  }
];

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  if (isCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-strong)] flex items-center justify-center"
        >
          <span className="text-4xl">🎉</span>
        </motion.div>
        <h3 className="text-2xl font-bold text-[color:var(--foreground)] mb-2">
          You&apos;re Ready to Ride!
        </h3>
        <p className="text-[color:var(--muted)] mb-6">
          Welcome to the future of fitness. Let&apos;s get moving.
        </p>
        <MagneticButton>
          <a
            href="/rider"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-[color:var(--accent)] text-white font-semibold"
          >
            Find a Class
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </MagneticButton>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-[color:var(--muted)] mb-2">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 rounded-full bg-[color:var(--surface-strong)] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-strong)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex justify-center gap-4 mb-8">
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => setCurrentStep(index)}
            className={`relative w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${
              index <= currentStep
                ? "bg-[color:var(--accent)] text-white"
                : "bg-[color:var(--surface-strong)] text-[color:var(--muted)]"
            }`}
          >
            {step.icon}
            {index === currentStep && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-[color:var(--accent)]"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          {/* Icon with glow */}
          <div className="relative inline-block mb-6">
            <motion.div
              className={`w-24 h-24 rounded-full bg-gradient-to-br ${steps[currentStep].color} flex items-center justify-center text-5xl`}
              animate={{ 
                boxShadow: [
                  `0 0 20px rgba(109, 124, 255, 0.3)`,
                  `0 0 40px rgba(109, 124, 255, 0.5)`,
                  `0 0 20px rgba(109, 124, 255, 0.3)`
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {steps[currentStep].icon}
            </motion.div>
            <div className="absolute -bottom-1 -right-1">
              <EnergyPulse size="md" />
            </div>
          </div>

          <h3 className="text-2xl font-bold text-[color:var(--foreground)] mb-3">
            {steps[currentStep].title}
          </h3>
          <p className="text-lg text-[color:var(--muted)] mb-8 max-w-md mx-auto">
            {steps[currentStep].description}
          </p>

          {/* Action buttons */}
          <div className="flex justify-center gap-4">
            {currentStep > 0 && (
              <motion.button
                onClick={handlePrev}
                className="px-6 py-3 rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] font-medium hover:bg-[color:var(--surface-strong)] transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Back
              </motion.button>
            )}
            <motion.button
              onClick={handleNext}
              className={`px-8 py-3 rounded-full text-white font-semibold bg-gradient-to-r ${steps[currentStep].color}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {currentStep === steps.length - 1 ? "Get Started" : "Next Step"}
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Skip option */}
      <div className="text-center mt-8">
        <button
          onClick={() => setIsCompleted(true)}
          className="text-sm text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
        >
          Skip onboarding →
        </button>
      </div>
    </div>
  );
}
