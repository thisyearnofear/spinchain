"use client";

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
      className="relative inline-flex overflow-hidden bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-strong)] shadow-lg shadow-[color:var(--accent)]/30"
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
      <a href={href} onClick={onClick} className="inline-block">
        {inner}
      </a>
    );
  }
  return (
    <button onClick={onClick} className="inline-block">
      {inner}
    </button>
  );
}
