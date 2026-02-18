"use client";

import { usePathname } from "next/navigation";
import { ThemeToggleCompact } from "./theme-toggle";
import { ConnectWallet } from "../features/wallet/connect-wallet";
import { SuiWalletButton } from "../features/wallet/sui-wallet-button";
import { Tooltip } from "../ui/tooltip";
import { AIProviderSettings } from "../features/ai/ai-provider-settings";

/**
 * Sui wallet is only relevant during active ride sessions and the agent studio.
 * Showing it everywhere adds cognitive load for new users who must install two
 * separate wallet extensions before they can do anything.  We surface it
 * contextually so the primary EVM wallet connection remains the clear first step.
 */
function useSuiWalletVisible(): boolean {
  const pathname = usePathname();
  const suiPages = ["/rider/ride", "/rider/journey", "/agent", "/instructor/ai"];
  return suiPages.some((page) => pathname?.startsWith(page));
}

export function PrimaryNav() {
  const showSuiWallet = useSuiWalletVisible();

  return (
    <nav className="flex w-full flex-wrap items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] text-xl font-semibold text-white">
          🚴
        </span>
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--muted)]">
            SpinChain
          </p>
          <h1 className="text-2xl font-semibold text-[color:var(--foreground)]">
            Your effort earns rewards
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Tooltip content="AI Provider Settings" position="bottom">
            <AIProviderSettings />
          </Tooltip>

          <Tooltip content="Toggle light/dark mode" position="bottom">
            <ThemeToggleCompact />
          </Tooltip>

          <Tooltip content="Connect Ethereum wallet for SpinChain" position="bottom">
            <ConnectWallet />
          </Tooltip>

          {showSuiWallet && (
            <Tooltip content="Connect Sui wallet for performance tracking" position="bottom">
              <SuiWalletButton />
            </Tooltip>
          )}
        </div>

        <Tooltip content="Browse available cycling routes" position="bottom">
          <a
            href="/routes"
            className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] hover:border-[color:var(--border-strong)]"
          >
            Routes
          </a>
        </Tooltip>

        <Tooltip content="Create or manage classes" position="bottom">
          <a
            href="/instructor"
            className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] hover:border-[color:var(--border-strong)]"
          >
            Teach
          </a>
        </Tooltip>

        <Tooltip content="Find classes and start riding" position="bottom">
          <a
            href="/rider"
            className="rounded-full bg-[color:var(--accent)] px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[color:var(--glow)]"
          >
            Start Riding
          </a>
        </Tooltip>
      </div>
    </nav>
  );
}
