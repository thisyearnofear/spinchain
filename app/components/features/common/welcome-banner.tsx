"use client";

import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";

const DISMISS_KEY = "spinchain_welcome_dismissed";

export function WelcomeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[color:var(--accent)]/20 bg-gradient-to-br from-[color:var(--accent)]/10 to-transparent p-5 backdrop-blur">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-[color:var(--muted)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--surface)]/50 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--accent)]/20 text-[color:var(--accent)]">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[color:var(--foreground)]">
            Welcome to SpinChain
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--muted)]">
            Indoor cycling classes with immersive 3D routes, live coaching, and
            on-chain rewards. You can try a free demo ride right now — no wallet
            or signup needed. Connect a wallet when you&apos;re ready to earn
            rewards for your effort.
          </p>
        </div>
      </div>
    </div>
  );
}
