"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { modalTransition } from "@/app/lib/motion";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={modalTransition}
      className={`flex flex-col items-center justify-center py-16 text-center ${className}`}
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 blur-2xl opacity-20 bg-[color:var(--accent)] rounded-full" />
        <div className="relative w-16 h-16 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] flex items-center justify-center">
          <Icon className="w-7 h-7 text-[color:var(--accent)]" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-lg font-bold text-[color:var(--foreground)] tracking-tight">
        {title}
      </h3>
      <p className="mt-2 text-sm text-[color:var(--muted)] max-w-sm">
        {description}
      </p>
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[color:var(--accent)] text-white text-sm font-semibold transition-[transform,opacity] duration-150 active:scale-95 hover:opacity-90"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[color:var(--accent)] text-white text-sm font-semibold transition-[transform,opacity] duration-150 active:scale-95 hover:opacity-90"
          >
            {action.label}
          </button>
        )
      )}
    </motion.div>
  );
}
