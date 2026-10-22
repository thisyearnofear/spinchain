"use client";

import nextDynamic from "next/dynamic";

/** Cloud ride — query-driven authored sequence, client-only mount. */
export const dynamic = "force-dynamic";

const CloudRideClient = nextDynamic(() => import("./cloud-ride-client").then((m) => m.CloudRideClient), {
  ssr: false,
});

export default function CloudRidePage() {
  return <CloudRideClient />;
}
