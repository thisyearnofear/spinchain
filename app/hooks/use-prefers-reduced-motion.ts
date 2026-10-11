"use client";

import { useEffect, useState } from "react";

/**
 * Live `prefers-reduced-motion` signal (matchMedia + subscribe).
 *
 * Canvas layers — Rive WASM and R3F — are invisible to MotionConfig and the
 * CSS blanket media rule; they must branch on this explicitly.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    setReduced(mq.matches);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
