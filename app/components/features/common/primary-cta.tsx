"use client";

import Link from "next/link";
import { getDemoRideUrl } from "@/app/hooks/evm/use-class-data";

/**
 * PrimaryCTA — one dominant action per user state.
 *
 * Wedge guardrail: [30-second rule](../../docs/WEDGE.md#the-core-loop-must-be-under-30-seconds)
 *                  [one primary CTA](../../docs/WEDGE.md#wedge-guardrails)
 */
export function PrimaryCTA({
  isConnected,
  nextClassName,
}: {
  isConnected: boolean;
  nextClassName?: string;
}) {
  if (!isConnected) {
    return (
      <div className="flex justify-center">
        <Link
          href={getDemoRideUrl()}
          className="group inline-flex items-center gap-3 rounded-full bg-green-500 px-10 py-5 text-lg font-bold text-white shadow-lg shadow-green-500/30 transition-[transform,box-shadow] duration-150 hover:scale-105 hover:shadow-xl hover:shadow-green-500/40 active:scale-95"
        >
          <svg
            className="h-6 w-6 transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          Start Demo Ride — No Wallet Needed
        </Link>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Link
        href={nextClassName ? `/rider/ride/${encodeURIComponent(nextClassName)}` : getDemoRideUrl()}
        className="group inline-flex items-center gap-3 rounded-full bg-[var(--accent)] px-10 py-5 text-lg font-bold text-white shadow-lg shadow-[var(--accent)]/30 transition-[transform,box-shadow] duration-150 hover:scale-105 hover:shadow-xl hover:shadow-[var(--accent)]/40 active:scale-95"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {nextClassName ? `Ride: ${nextClassName}` : "Try a Demo Ride"}
      </Link>
    </div>
  );
}