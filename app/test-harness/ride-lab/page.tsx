"use client";

import nextDynamic from "next/dynamic";

/**
 * Ride lab — query-driven like the sibling visual harness, so it can never
 * prerender. The client is loaded without SSR so the initial mount reads
 * real window state (query params, reduced motion) with no hydration
 * mismatch.
 */
export const dynamic = "force-dynamic";

const RideLabClient = nextDynamic(() => import("./ride-lab-client").then((m) => m.RideLabClient), {
  ssr: false,
});

export default function RideLabPage() {
  return <RideLabClient />;
}
