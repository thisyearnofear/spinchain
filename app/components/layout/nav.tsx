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
    <div className="relative z-[100]" ref={dropdownRef}>
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
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 max-w-[90vw] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl backdrop-blur-xl p-4"
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

function PrimaryCTA({
  href,
  children,
  onClick,
  className,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`block w-full text-center rounded-full bg-[color:var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[color:var(--glow)] ${className ?? ""}`}
    >
      {children}
    </a>
  );
}

function ModeToggle({ isInstructor, onToggle }: { isInstructor: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`group relative flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
        isInstructor 
          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30" 
          : "bg-white/5 text-white/40 border border-white/10 hover:text-white"
      }`}
    >
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isInstructor ? "bg-indigo-400" : "bg-white/20"}`}></span>
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isInstructor ? "bg-indigo-500" : "bg-white/30"}`}></span>
      </span>
      {isInstructor ? "Switch to Riding" : "Switch to Coaching"}
    </button>
  );
}

export function PrimaryNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const showSuiWallet = useSuiWalletVisible();
  
  // Airbnb-style context detection
  const isInstructorMode = pathname?.startsWith("/instructor") || pathname?.startsWith("/agent");

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleModeToggle = () => {
    window.location.href = isInstructorMode ? "/rider" : "/instructor";
  };

  return (
    <nav className="flex w-full flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
      <div className="flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 group" aria-label="SpinChain Home">
          <span className={`grid h-11 w-11 place-items-center rounded-2xl text-xl font-semibold text-white shadow-lg transition-transform group-hover:scale-105 ${
            isInstructorMode 
              ? "bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] shadow-indigo-500/20" 
              : "bg-[linear-gradient(135deg,#6ef3c6,#3b82f6)] shadow-emerald-500/20"
          }`}>
            {isInstructorMode ? "🎓" : "🚴"}
          </span>
          <div>
            <p className="text-lg font-black text-[color:var(--foreground)] tracking-tighter">
              SpinChain
            </p>
            <p className={`text-[9px] font-bold uppercase tracking-[0.2em] -mt-1 ${isInstructorMode ? "text-indigo-400" : "text-emerald-400"}`}>
              {isInstructorMode ? "Instructor Console" : "Rider Experience"}
            </p>
          </div>
        </a>
        <div className="flex items-center gap-2 lg:hidden">
          <ModeToggle isInstructor={isInstructorMode} onToggle={handleModeToggle} />
          <MobileMenuButton isOpen={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden lg:flex lg:items-center gap-6 overflow-visible">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ConnectWallet />
            {showSuiWallet && <SuiWalletButton />}
          </div>
          
          <div className="h-6 w-px bg-white/10 mx-1" />
          
          <div className="flex items-center gap-2">
            {isInstructorMode ? (
              <>
                <NavLink href="/instructor/builder">Create Class</NavLink>
                <NavLink href="/instructor/analytics">Analytics</NavLink>
                <NavLink href="/instructor/ai">AI Coach</NavLink>
              </>
            ) : (
              <>
                <NavLink href="/rider">Explore</NavLink>
                <NavLink href="/rider/journey">My Activity</NavLink>
                <NavLink href="/routes">Routes</NavLink>
              </>
            )}
            <SettingsDropdown />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <ModeToggle isInstructor={isInstructorMode} onToggle={handleModeToggle} />
          {isInstructorMode ? (
            <PrimaryCTA href="/instructor/builder" className="bg-indigo-600 shadow-indigo-500/20">
              New Class
            </PrimaryCTA>
          ) : (
            <PrimaryCTA href="/rider" className="bg-emerald-500 shadow-emerald-500/20">
              Find a Ride
            </PrimaryCTA>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4 overflow-visible lg:hidden"
          >
            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white/40 uppercase">Account</span>
                <ConnectWallet />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {isInstructorMode ? (
                  <>
                    <NavLink href="/instructor/builder" onClick={closeMobileMenu}>Create</NavLink>
                    <NavLink href="/instructor/analytics" onClick={closeMobileMenu}>Analytics</NavLink>
                    <NavLink href="/instructor/ai" onClick={closeMobileMenu}>AI Coach</NavLink>
                    <SettingsDropdown />
                  </>
                ) : (
                  <>
                    <NavLink href="/rider" onClick={closeMobileMenu}>Explore</NavLink>
                    <NavLink href="/rider/journey" onClick={closeMobileMenu}>Activity</NavLink>
                    <NavLink href="/routes" onClick={closeMobileMenu}>Routes</NavLink>
                    <SettingsDropdown />
                  </>
                )}
              </div>
            </div>

            {isInstructorMode ? (
              <PrimaryCTA href="/instructor/builder" onClick={closeMobileMenu} className="bg-indigo-600">
                New Class
              </PrimaryCTA>
            ) : (
              <PrimaryCTA href="/rider" onClick={closeMobileMenu} className="bg-emerald-500">
                Find a Ride
              </PrimaryCTA>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
