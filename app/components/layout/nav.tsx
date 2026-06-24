"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { ThemeToggleCompact } from "./theme-toggle";
import { ConnectWallet } from "../features/wallet/connect-wallet";
import { SuiWalletButton } from "../features/wallet/sui-wallet-button";
import { AIProviderSettings } from "../features/ai/ai-provider-settings";
import { useUIClickSound } from "@/app/hooks/use-ui-click-sound";
import { useProfile, getDisplayName, formatAddress } from "@/app/hooks/common/use-profile";
import { useRiderStats } from "@/app/hooks/common/use-rider-stats";
import { useRiderProfile } from "@/app/stores/rider-profile-store";
import { motion, AnimatePresence } from "framer-motion";
import { dropdownTransition } from "@/app/lib/motion";

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

function ModeToggle({ isInstructor, onToggle }: { isInstructor: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`group relative flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition-all ${
        isInstructor
          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
          : "bg-white/5 text-white/40 border border-white/10 hover:text-white"
      }`
    }
    >
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isInstructor ? "bg-indigo-400" : "bg-white/20"}`}></span>
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isInstructor ? "bg-indigo-500" : "bg-white/30"}`}></span>
      </span>
      {isInstructor ? "Switch to Riding" : "Switch to Coaching"}
    </button>
  );
}

function SettingsDropdown({ isInstructorMode, onModeToggle }: { isInstructorMode: boolean; onModeToggle: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const clickSound = useUIClickSound();

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
    clickSound();
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
        className="flex items-center justify-center w-10 h-10 rounded-full border border-[color:var(--border)] text-[color:var(--muted)] hover:text-[color:var(--foreground)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface)] transition-[color,border-color,background-color] duration-150 cursor-pointer active:scale-95"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={dropdownTransition}
            style={{ transformOrigin: "top center", zIndex: 9999 }}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 max-w-[90vw] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl backdrop-blur-xl p-4"
            data-testid="settings-dropdown"
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[color:var(--muted)]">Mode</span>
                <ModeToggle isInstructor={isInstructorMode} onToggle={onModeToggle} />
              </div>
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

function RiderIdentityChip() {
  const { address } = useAccount();
  const { profile } = useProfile(address);
  const riderProfile = useRiderProfile();
  const hasProfile = riderProfile.createdAt !== null;

  const streak = useRiderStats().streak;

  const riderName = useMemo(() => {
    if (profile) return getDisplayName(profile, address ?? "");
    if (address) return formatAddress(address);
    return null;
  }, [profile, address]);

  if (!riderName && !hasProfile) return null;

  const displayName = riderName || "Rider";

  return (
    <Link
      href="/rider/journey"
      className="flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] pl-1 pr-3 py-1 hover:border-white/15 hover:bg-white/[0.07] transition-colors"
      title="View your journey"
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white shrink-0 overflow-hidden">
        {profile?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          displayName.charAt(0).toUpperCase()
        )}
      </div>
      <span className="text-xs font-semibold text-white/80 hidden sm:inline max-w-[80px] truncate">
        {displayName}
      </span>
      {streak.daily > 0 && (
        <span className="text-[10px] font-bold text-orange-400 shrink-0" title={`${streak.daily}-day streak`}>
          🔥{streak.daily}
        </span>
      )}
    </Link>
  );
}

interface NavItem {
  href: string;
  label: string;
}

function NavTabs({ items, pathname, isInstructorMode }: { items: NavItem[]; pathname: string; isInstructorMode: boolean }) {
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const pillRef = useRef<HTMLSpanElement | null>(null);

  const activeIndex = useMemo(() => {
    const idx = items.findIndex(item => pathname === item.href || pathname?.startsWith(item.href + "/"));
    return idx >= 0 ? idx : 0;
  }, [items, pathname]);

  const movePill = useCallback((index: number, animate: boolean) => {
    const tab = tabRefs.current[items[index]?.href];
    const pill = pillRef.current;
    if (!tab || !pill) return;
    if (!animate) {
      pill.style.transition = "none";
      pill.style.transform = `translateX(${tab.offsetLeft}px)`;
      pill.style.width = `${tab.offsetWidth}px`;
      void pill.offsetWidth;
      pill.style.transition = "";
    } else {
      pill.style.transform = `translateX(${tab.offsetLeft}px)`;
      pill.style.width = `${tab.offsetWidth}px`;
    }
  }, [items]);

  useEffect(() => {
    movePill(activeIndex, false);
  }, [activeIndex, movePill]);

  useEffect(() => {
    const onResize = () => movePill(activeIndex, false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeIndex, movePill]);

  return (
    <div
      className={`t-tabs relative flex items-center gap-1 rounded-full p-1 ${
        isInstructorMode
          ? "bg-indigo-500/[0.07] border border-indigo-500/10"
          : "bg-white/[0.03] border border-white/5"
      }`}
    >
      <span
        ref={pillRef}
        className={`t-tabs-pill absolute top-1 bottom-1 rounded-full ${
          isInstructorMode
            ? "bg-indigo-500/15"
            : "bg-white/10"
        }`}
      />
      {items.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            ref={(el) => { tabRefs.current[item.href] = el; }}
            className={`relative z-10 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? "text-[color:var(--foreground)]"
                : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function MobileNavLink({ href, children, onClick, active }: { href: string; children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block w-full text-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[color:var(--accent)]/10 text-[color:var(--foreground)] border border-[color:var(--accent)]/20"
          : "text-[color:var(--muted)] hover:text-[color:var(--foreground)] border border-white/5 bg-white/[0.02]"
      }`}
    >
      {children}
    </Link>
  );
}

export function PrimaryNav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const showSuiWallet = useSuiWalletVisible();
  
  const isInstructorMode = pathname?.startsWith("/instructor") || pathname?.startsWith("/agent");

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleModeToggle = () => {
    window.location.href = isInstructorMode ? "/rider" : "/instructor";
  };

  const navItems: NavItem[] = isInstructorMode
    ? [
        { href: "/instructor/builder", label: "Create" },
        { href: "/instructor/templates", label: "Templates" },
        { href: "/instructor/analytics", label: "Analytics" },
        { href: "/instructor/ai", label: "AI Coach" },
      ]
    : [
        { href: "/rider", label: "Explore" },
        { href: "/rider/journey", label: "Activity" },
        { href: "/routes", label: "Routes" },
      ];

  return (
    <nav className="flex w-full flex-col lg:flex-row lg:items-center lg:justify-between gap-4 lg:gap-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group" aria-label="SpinChain Home">
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
        </Link>
        <div className="flex items-center gap-2 lg:hidden">
          <MobileMenuButton isOpen={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden lg:flex lg:items-center gap-4 overflow-visible">
        <NavTabs items={navItems} pathname={pathname ?? "/"} isInstructorMode={isInstructorMode} />

        <div className="flex items-center gap-2">
          <RiderIdentityChip />
          <ConnectWallet />
          {showSuiWallet && <SuiWalletButton />}
          <SettingsDropdown isInstructorMode={isInstructorMode} onModeToggle={handleModeToggle} />
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
                <RiderIdentityChip />
                <ConnectWallet />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {navItems.map((item) => (
                  <MobileNavLink
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileMenu}
                    active={pathname === item.href || pathname?.startsWith(item.href + "/")}
                  >
                    {item.label}
                  </MobileNavLink>
                ))}
              </div>

              <div className="border-t border-white/10 pt-3">
                <SettingsDropdown isInstructorMode={isInstructorMode} onModeToggle={handleModeToggle} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
