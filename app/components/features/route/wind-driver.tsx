"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { WIND_UNIFORMS } from "./wind-material";
import { usePrefersReducedMotion } from "@/app/hooks/use-prefers-reduced-motion";

/**
 * WindDriver — advances the shared wind clock and sets how hard the wind
 * blows.
 *
 * The wind is not decoration: it is the cheapest way to make effort *felt*.
 * A rider pushing harder gets a stronger wind, the props lean further, and
 * the world acknowledges the effort the same way the road glow already does.
 * That keeps the world and the HUD telling the same story.
 *
 * Cost: one uniform write per frame, plus two `sin` calls. No React state.
 */
export function WindDriver({
  speedFactor = 0,
}: {
  /** 0–1: how hard the rider is pushing. */
  speedFactor?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const factorRef = useRef(speedFactor);

  // Synced in an effect, not during render — the React Compiler rejects ref
  // writes in the render phase.
  useEffect(() => {
    factorRef.current = speedFactor;
  }, [speedFactor]);

  useFrame((state) => {
    const frozen = reduced;

    // The clock freezes under reduced motion, but the strength still tracks
    // effort — a static world that reacts to you is still a reactive world.
    if (!frozen) {
      WIND_UNIFORMS.uWindTime.value = state.clock.elapsedTime;
    }

    const factor = factorRef.current;
    // A gentle breeze at rest; up to ~3× that at full effort. Capped so a
    // sprint does not turn the world into a storm.
    const target = 0.55 + Math.min(1, Math.max(0, factor)) * 2.1;
    const current = WIND_UNIFORMS.uWindStrength.value;
    // Ease toward the target so 2–10Hz telemetry steps do not snap the wind.
    WIND_UNIFORMS.uWindStrength.value += (target - current) * 0.06;
  });

  return null;
}
