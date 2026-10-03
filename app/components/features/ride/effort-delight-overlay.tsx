"use client";

import { useMemo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { useTelemetryStore, selectPower, selectEffort } from "@/app/stores/telemetry-store";
import { useCoachingStore, selectCurrentInterval } from "@/app/stores/coaching-store";
import type { FlowStateTier } from "@/app/lib/flow-state";
import type { IntervalPhase } from "@/app/lib/phase-theme";
import {
  getSprintBeamState,
  getFlowUnlockParams,
} from "@/app/lib/effort-ability";

/**
 * EffortDelightOverlay — the two curated wedge delight moments.
 *
 * DOM-only, pointer-events-none, stacked above the 3D world but below HUD.
 * Fitness is the input: sprint watts hold the beam, flow tier 3+ opens the ring.
 * Respects reduced-motion via framer-motion's global MotionConfig (user).
 */
export function EffortDelightOverlay({ flowTier = 0 }: { flowTier?: FlowStateTier }) {
  const power = useTelemetryStore(selectPower);
  const effort = useTelemetryStore(selectEffort);
  const currentInterval = useCoachingStore(selectCurrentInterval);
  const phase = (currentInterval?.phase ?? null) as IntervalPhase;

  const beam = useMemo(
    () => getSprintBeamState(phase, power, effort),
    [phase, power, effort],
  );
  const unlock = useMemo(() => getFlowUnlockParams(flowTier), [flowTier]);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      data-testid="effort-delight-overlay"
      data-beam-active={beam.active ? "true" : "false"}
      data-unlock-active={unlock.active ? "true" : "false"}
    >
      {/* ─── Moment 1: sprint = beam ─── */}
      <AnimatePresence>
        {beam.active && (
          <m.div
            key="sprint-beam"
            className="absolute inset-x-0 bottom-0 top-[10%]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 + beam.intensity * 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Core column */}
            <div
              className="absolute left-1/2 top-0 h-full -translate-x-1/2"
              style={{
                width: `${24 + beam.intensity * 48}px`,
                background:
                  "linear-gradient(to top, rgba(244,63,94,0.55), rgba(251,146,60,0.35) 55%, transparent)",
                filter: "blur(6px)",
              }}
            />
            {/* Sheath */}
            <div
              className="absolute left-1/2 top-[5%] h-[95%] -translate-x-1/2"
              style={{
                width: `${90 + beam.intensity * 120}px`,
                background:
                  "radial-gradient(ellipse at center, rgba(251,191,36,0.22), transparent 70%)",
                filter: "blur(12px)",
              }}
            />
            {/* Floor burn */}
            <div
              className="absolute inset-x-[10%] bottom-[8%] h-16"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(244,63,94,0.5), transparent 70%)",
                filter: "blur(10px)",
              }}
            />
          </m.div>
        )}
      </AnimatePresence>

      {/* ─── Moment 2: flow = unlock (tier 3+) ─── */}
      <AnimatePresence>
        {unlock.active && (
          <m.div
            key={`flow-unlock-${flowTier}`}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            initial={{ scale: 1.35, opacity: 0 }}
            animate={{ scale: unlock.ringScale, opacity: unlock.glowOpacity }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <div
              className="h-64 w-64 rounded-full"
              style={{
                border: `3px solid rgba(251,191,36,0.9)`,
                boxShadow:
                  "0 0 60px 10px rgba(251,191,36,0.35), inset 0 0 40px rgba(251,191,36,0.25)",
              }}
            />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
