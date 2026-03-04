"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Wallet, Bluetooth, Timer, ArrowRight } from "lucide-react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { getDemoRideUrl } from "@/app/hooks/evm/use-class-data";

const STORAGE_KEY = "spinchain:onboarding:checklist";

export function OnboardingChecklist() {
  const { isConnected } = useAccount();
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setCompletedSteps(JSON.parse(stored));
    }
    
    // Only show if not all steps are done
    const isDone = stored && JSON.parse(stored).length >= 3;
    if (!isDone) {
      setIsVisible(true);
    }
  }, []);

  // Update wallet connection step automatically
  useEffect(() => {
    if (isConnected && !completedSteps.includes("wallet")) {
      const next = [...completedSteps, "wallet"];
      setCompletedSteps(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, [isConnected, completedSteps]);

  const steps = [
    {
      id: "wallet",
      title: "Connect Wallet",
      description: "Secure your rewards with your Web3 wallet",
      icon: Wallet,
      isDone: isConnected || completedSteps.includes("wallet"),
    },
    {
      id: "device",
      title: "Link Device",
      description: "Connect your heart rate monitor or power meter",
      icon: Bluetooth,
      isDone: completedSteps.includes("device"),
      action: getDemoRideUrl() + "&setup=true",
      actionLabel: "Setup",
    },
    {
      id: "ride",
      title: "First Ride",
      description: "Complete a 5-minute practice ride",
      icon: Timer,
      isDone: completedSteps.includes("ride"),
      action: getDemoRideUrl(),
      actionLabel: "Start",
    },
  ];

  const allDone = steps.every(s => s.isDone);
  if (!isVisible && !allDone) return null;
  if (allDone && isVisible) {
    // Show a "Success" state briefly then hide on next refresh
  }

  return (
    <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/60 p-8 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[color:var(--foreground)]">Get Started</h2>
          <p className="text-sm text-[color:var(--muted)] mt-1">
            Complete these 3 steps to start earning SPIN
          </p>
        </div>
        {allDone && (
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500 border border-emerald-500/20">
            COMPLETED
          </span>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((step, i) => (
          <div 
            key={step.id}
            className={`relative group rounded-2xl border p-5 transition-all duration-300 ${
              step.isDone 
                ? "bg-emerald-500/5 border-emerald-500/20" 
                : "bg-white/5 border-white/10 hover:border-white/20"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`rounded-xl p-2.5 ${step.isDone ? "bg-emerald-500/20 text-emerald-500" : "bg-white/10 text-[color:var(--muted)]"}`}>
                <step.icon className="h-5 w-5" />
              </div>
              {step.isDone ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <Circle className="h-5 w-5 text-white/20" />
              )}
            </div>

            <h3 className={`font-bold ${step.isDone ? "text-emerald-500" : "text-[color:var(--foreground)]"}`}>
              {step.title}
            </h3>
            <p className="text-xs text-[color:var(--muted)] mt-1 leading-relaxed">
              {step.description}
            </p>

            {!step.isDone && step.action && (
              <Link 
                href={step.action}
                className="mt-4 flex w-full items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/20 transition-all active:scale-95"
              >
                <span>{step.actionLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}

            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-1/2 -right-3 h-px w-6 bg-white/10" />
            )}
          </div>
        ))}
      </div>
      
      {allDone && (
        <button 
          onClick={() => setIsVisible(false)}
          className="mt-8 w-full text-center text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)] transition-colors"
        >
          Dismiss checklist
        </button>
      )}
    </div>
  );
}
