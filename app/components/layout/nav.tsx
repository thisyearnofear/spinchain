"use client";

import { useState, useRef, useEffect } from "react";
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
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        {isOpen ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        )}
      </svg>
    </button>
  );
}

function SettingsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
   console.log("Settings toggle clicked, current state:", isOpen);
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        aria-label="Settings"
        aria-expanded={isOpen}
        aria-haspopup="true"
        type="button"
        className="flex items-center justify-center w-10 h-10 rounded-full border border-[color:var(--border)] text-[color:var(--muted)] hover:text-[color:var(--foreground)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface)] transition-all cursor-pointer active:scale-95"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-64 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl backdrop-blur-xl p-4"
            style={{ zIndex: 9999 }}
            data-testid="settings-dropdown"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[color:var(--muted)]">Theme</span>
                <ThemeToggleCompact />
              </div>
              <div className="border-t border-[color:var(--border)] pt-3">
                <AIProviderSettings />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
        <a href="/" className="flex items-center gap-3 group" aria-label="SpinChain Home">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] text-xl font-semibold text-white">
            🚴
          </span>
          <p className="text-lg font-semibold text-[color:var(--foreground)]">
            SpinChain
          </p>
        </a>
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
                <SettingsDropdown />
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
