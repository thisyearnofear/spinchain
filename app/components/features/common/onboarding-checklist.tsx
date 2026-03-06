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
    <div className="rounded-3xl border border-[color:var(--border)] bg-gradient-to-br from-purple-900/20 to-indigo-900/20 p-8 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Get Started</h2>
          <p className="text-sm text-white/90 mt-1">
            Complete these 3 steps to start earning SPIN
          </p>
        </div>
        {allDone && (
          <span className="rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 px-4 py-2 text-xs font-bold text-white shadow-lg">
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
                ? "bg-gradient-to-br from-emerald-500/10 to-emerald-400/5 border-emerald-500/20 shadow-[0_8px_25px_rgba(0,255,85,0.1)]" 
                : "bg-white/5 border-white/10 hover:border-white/20 hover:shadow-[0_8px_25px_rgba(255,255,255,0.1)]"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`rounded-xl p-2.5 ${step.isDone ? "bg-gradient-to-r from-emerald-400 to-emerald-300 text-white shadow-sm" : "bg-white/15 text-white/80"}`}>
                <step.icon className="h-5 w-5" />
              </div>
              {step.isDone ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 animate-pulse" />
              ) : (
                <Circle className="h-5 w-5 text-white/50 group-hover:text-white/70 transition-colors" />
              )}
            </div>

            <h3 className={`font-bold text-xl ${step.isDone ? "text-emerald-400" : "text-white"}`}>
              {step.title}
            </h3>
            <p className="text-sm text-white/90 mt-2 leading-relaxed">
              {step.description}
            </p>

            {!step.isDone && step.action && (
              <Link 
                href={step.action}
                className="mt-4 flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-white/10 to-white/5 px-4 py-3 text-sm font-medium text-white hover:from-white/20 hover:to-white/15 transition-all active:scale-95"
              >
                <span className="text-white">{step.actionLabel}</span>
                <ArrowRight className="h-4 w-4 text-white/90" />
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
          className="mt-8 w-full text-center text-sm text-white/80 hover:text-white transition-colors hover:scale-105"
        >
          Dismiss checklist
        </button>
      )}
    </div>
  );
}

// Enhanced with better visual feedback and animations
function EnhancedCheckCircle({ className }: { className?: string }) {
  return (
    <div className="relative">
      <CheckCircle2 className={`h-5 w-5 text-emerald-400 animate-pulse ${className}`} />
      <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
    </div>
  );
}

function EnhancedCircle({ className }: { className?: string }) {
  return (
    <div className="relative">
      <Circle className={`h-5 w-5 text-white/50 ${className}`} />
      <div className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-white/20 animate-pulse" />
    </div>
  );
}