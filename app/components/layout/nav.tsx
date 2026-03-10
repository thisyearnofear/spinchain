"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggleCompact } from "./theme-toggle";
import { ConnectWallet } from "../features/wallet/connect-wallet";
import { SuiWalletButton } from "../features/wallet/sui-wallet-button";
import { AIProviderSettings } from "../features/ai/ai-provider-settings";
import { motion, AnimatePresence } from "framer-motion";

function useSuiWalletVisible(): boolean {
  const pathname = usePathname();
  const suiPages = ["/rider/ride", "/rider/journey", "/agent", "/instructor/ai"];
  return suiPages.some((page) => pathname?.startsWith(page));
}

function MobileMenuButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? "Close menu" : "Open menu"}
      aria-expanded={isOpen}
      className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full border border-[color:var(--border)] text-[color:var(--muted)] hover:text-[color:var(--foreground)] hover:border-[color:var(--border-strong)] transition-colors"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {isOpen ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        )}
      </svg>
    </button>
  );
}

function NavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="block w-full text-center rounded-full border border-[color:var(--border)] px-5 py-2.5 text-sm font-medium text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] hover:border-[color:var(--border-strong)]"
    >
      {children}
    </a>
  );
}

function PrimaryCTA({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="block w-full text-center rounded-full bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[color:var(--glow)]"
    >
      {children}
    </a>
  );
}

export function PrimaryNav() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const showSuiWallet = useSuiWalletVisible();

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className="flex w-full flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] text-xl font-semibold text-white">
            🚴
          </span>
          <p className="text-lg font-semibold text-[color:var(--foreground)]">
            SpinChain
          </p>
        </div>
        <MobileMenuButton isOpen={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      </div>

      <AnimatePresence mode="wait">
        {(isMobileMenuOpen || typeof window !== "undefined" && window.innerWidth >= 1024) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col lg:flex-row lg:items-center gap-4 overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <AIProviderSettings />
                <ThemeToggleCompact />
                <ConnectWallet />
                {showSuiWallet && <SuiWalletButton />}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <NavLink href="/routes" onClick={closeMobileMenu}>Routes</NavLink>
                <NavLink href="/instructor" onClick={closeMobileMenu}>Teach</NavLink>
              </div>
            </div>

            <PrimaryCTA href="/rider" onClick={closeMobileMenu}>Start Riding</PrimaryCTA>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
