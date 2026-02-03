"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ConnectButton as SuiConnectButton } from "@mysten/dapp-kit";
import { ThemeToggleCompact } from "./theme-toggle";

export function PrimaryNav() {
  return (
    <nav className="flex w-full flex-wrap items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] text-xl font-semibold text-white">
          S
        </span>
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">
            SpinChain Protocol
          </p>
          <h1 className="text-2xl font-semibold text-[color:var(--foreground)]">
            Privacy-first fitness DeFi
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <ThemeToggleCompact />
          <ConnectButton showBalance={false} />
          <SuiConnectButton />
        </div>
        <a
          href="/routes"
          className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] hover:border-[color:var(--border-strong)]"
        >
          Route Worlds
        </a>
        <a
          href="/instructor"
          className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] hover:border-[color:var(--border-strong)]"
        >
          Instructor
        </a>
        <a
          href="/rider"
          className="rounded-full bg-[color:var(--accent)] px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[color:var(--glow)]"
        >
          Rider View
        </a>
      </div>
    </nav>
  );
}
