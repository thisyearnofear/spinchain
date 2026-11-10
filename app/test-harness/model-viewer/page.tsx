"use client";

import nextDynamic from "next/dynamic";

/**
 * Model viewer — query-driven (?url=/characters/x.glb) so generated GLBs can
 * be eyeballed without wiring them into a scene first. Client-only: the GLB
 * URL comes from the query string.
 */
export const dynamic = "force-dynamic";

const Viewer = nextDynamic(() => import("./model-viewer-client").then((m) => m.ModelViewerClient), {
  ssr: false,
});

export default function ModelViewerPage() {
  return <Viewer />;
}
