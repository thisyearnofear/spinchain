"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Circle, Wallet, Bluetooth, Timer, ArrowRight } from "lucide-react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { getDemoRideUrl } from "@/app/hooks/evm/use-class-data";
import { getRideHistory } from "@/app/lib/analytics/ride-history";

const STORAGE_KEY = "spinchain:onboarding:checklist";
const SAVED_DEVICES_KEY = "spinchain:saved-devices";

function readStoredSteps(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function hasSavedDevices(): boolean {
  try {
    const stored = localStorage.getItem(SAVED_DEVICES_KEY);
    if (!stored) return false;

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

function deriveCompletedSteps(existingSteps: string[], isConnected: boolean) {
  const next = new Set(existingSteps);

  if (isConnected) {
    next.add("wallet");
  }

  if (hasSavedDevices()) {
    next.add("device");
  }

  if (getRideHistory().length > 0) {
    next.add("ride");
  }

  return Array.from(next);
}

export function OnboardingChecklist() {
  const { isConnected } = useAccount();
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [justCompleted, setJustCompleted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevCountRef = useRef(0);

  useEffect(() => {
    const syncChecklist = () => {
      const next = deriveCompletedSteps(readStoredSteps(), isConnected);
      setCompletedSteps(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // Success moment: completing the last step this session keeps the panel
      // visible with a COMPLETED state; riders who return after finishing
      // don't see it again.
      if (next.length === 3 && prevCountRef.current < 3) {
        setJustCompleted(true);
      }
      prevCountRef.current = next.length;
    };

    prevCountRef.current = deriveCompletedSteps(readStoredSteps(), isConnected).length;
    syncChecklist();
    window.addEventListener("focus", syncChecklist);

    return () => window.removeEventListener("focus", syncChecklist);
  }, [isConnected]);

  const steps = [
    {
      id: "wallet",
      title: "Connect Wallet",
      description: "Optional — needed only to earn rewards. Demo rides work without it.",
      icon: Wallet,
      isDone: isConnected || completedSteps.includes("wallet"),
    },
    {
      id: "device",
      title: "Pair a Device",
      description: "Optional — connect a heart rate monitor for live effort tracking, or use the keyboard simulator.",
      icon: Bluetooth,
      isDone: completedSteps.includes("device"),
      action: `${getDemoRideUrl()}?setup=true`,
      actionLabel: "Pair device",
    },
    {
      id: "ride",
      title: "Try a Demo Ride",
      description: "A 5-minute practice session to experience the full ride flow.",
      icon: Timer,
      isDone: completedSteps.includes("ride"),
      action: getDemoRideUrl(),
      actionLabel: "Start demo",
    },
  ];

  const allDone = steps.every((s) => s.isDone);

  // Hidden once complete, unless the rider completed it in this session —
  // then we show the success state so finishing feels rewarded.
  if (allDone && !justCompleted) return null;
  if (dismissed) return null;

  return (
    <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-6 md:p-8 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.15)]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-[color:var(--foreground)] mb-1">
            Get started in 3 steps
          </h2>
          <p className="text-sm text-[color:var(--muted)] mt-1">
            Everything is optional — you can start with just a demo ride.
          </p>
        </div>
        {allDone && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--success)]/15 px-4 py-2 text-xs font-bold text-[color:var(--success)]">
            <CheckCircle2 className="h-3.5 w-3.5" />
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
                ? "bg-[color:var(--success)]/5 border-[color:var(--success)]/20"
                : "bg-[color:var(--surface-strong)]/60 border-[color:var(--border)] hover:border-[color:var(--accent)]/40"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className={`rounded-xl p-2.5 ${
                  step.isDone
                    ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                    : "bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
                }`}
              >
                <step.icon className="h-5 w-5" />
              </div>
              {step.isDone ? (
                <CheckCircle2 className="h-5 w-5 text-[color:var(--success)]" />
              ) : (
                <Circle className="h-5 w-5 text-[color:var(--muted)] group-hover:text-[color:var(--foreground)] transition-colors" />
              )}
            </div>

            <h3
              className={`font-bold text-lg ${step.isDone ? "text-[color:var(--success)]" : "text-[color:var(--foreground)]"}`}
            >
              {step.title}
            </h3>
            <p className="text-sm text-[color:var(--muted)] mt-2 leading-relaxed">
              {step.description}
            </p>

            {!step.isDone && step.action && (
              <Link
                href={step.action}
                className="mt-4 flex w-full items-center justify-between rounded-2xl border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--accent)] transition-colors hover:border-[color:var(--accent)]/60 hover:bg-[color:var(--accent)]/20 active:scale-[0.98]"
              >
                <span>{step.actionLabel}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}

            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-1/2 -right-3 h-px w-6 bg-[color:var(--border)]" />
            )}
          </div>
        ))}
      </div>

      {allDone && (
        <button
          onClick={() => setDismissed(true)}
          className="mt-8 w-full text-center text-sm text-[color:var(--muted)] transition-colors hover:text-[color:var(--foreground)]"
        >
          Dismiss checklist
        </button>
      )}
    </div>
  );
}
