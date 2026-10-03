"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import { getDemoRideUrl } from "@/app/hooks/evm/use-class-data";

const PRIMARY_PILL =
  "group inline-flex items-center gap-3 rounded-full bg-[color:var(--accent)] px-10 py-5 text-lg font-bold text-black shadow-lg shadow-[color:var(--accent)]/30 transition-[transform,background-color,box-shadow] duration-150 hover:scale-105 hover:bg-[color:var(--accent-strong)] hover:shadow-xl hover:shadow-[color:var(--accent)]/40 active:scale-95";

/**
 * PrimaryCTA — one dominant action per user state.
 *
 * - New guest: Start Demo Ride (frictionless wedge entry).
 * - Guest WITH rides: Connect Wallet (their effort is on the line — rewards
 *   and history only persist with a wallet). Demo drops to a quiet link.
 * - Connected: next class, or demo when the chain is empty.
 *
 * Wedge guardrail: [30-second rule](../../docs/WEDGE.md#the-core-loop-must-be-under-30-seconds)
 *                  [one primary CTA](../../docs/WEDGE.md#wedge-guardrails)
 */
export function PrimaryCTA({
  isConnected,
  nextClassName,
  hasRides = false,
}: {
  isConnected: boolean;
  nextClassName?: string;
  hasRides?: boolean;
}) {
  if (!isConnected && hasRides) {
    return (
      <div className="flex flex-col items-center gap-3">
        <ConnectButton.Custom>
          {({ openConnectModal, mounted }) => (
            <button
              onClick={openConnectModal}
              type="button"
              disabled={!mounted}
              className={PRIMARY_PILL}
            >
              <Wallet className="h-6 w-6" />
              Connect wallet to keep your rewards
            </button>
          )}
        </ConnectButton.Custom>
        <Link
          href={getDemoRideUrl()}
          className="text-sm font-medium text-[color:var(--muted)] underline-offset-4 transition-colors hover:text-[color:var(--foreground)] hover:underline"
        >
          or ride the demo again — no wallet needed
        </Link>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex justify-center">
        <Link
          href={getDemoRideUrl()}
          className={PRIMARY_PILL}
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
        className={PRIMARY_PILL}
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
