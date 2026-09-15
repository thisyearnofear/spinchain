"use client";

import Link from "next/link";
import { m } from "framer-motion";

export function MorphCTA({
  children,
  onClick,
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <span className="relative flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-bold text-white">
      {children}
    </span>
  );

  const inner = (
    <m.div
      // Darkened orange endpoints: white bold text on var(--accent) (#f97316)
      // is ~2.9:1 — below WCAG AA. #c2410c → #b45309 keeps both ends ≥5:1.
      className="relative inline-flex overflow-hidden bg-gradient-to-r from-[#c2410c] to-[#b45309] shadow-lg shadow-[color:var(--accent)]/30"
      initial={{ borderRadius: 16 }}
      whileHover={{ borderRadius: 999, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 12 }}
    >
      {content}
    </m.div>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className="inline-block">
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className="inline-block">
      {inner}
    </button>
  );
}
