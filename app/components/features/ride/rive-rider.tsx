"use client";

/**
 * RiveRider — Rive-powered rider avatar that lives in the live ride HUD.
 *
 * The character is "part of the product, not a sticker on top": it reacts to
 * real-time telemetry (cadence, effort), interval phase (sprint / recovery),
 * coach speaking state, reward streaming, and PR moments — all sourced from
 * the existing stores the ride already writes to.
 *
 * ─── Rive editor contract ───────────────────────────────────────────
 * Build a character in the Rive editor with a state machine named `Ride`
 * exposing these inputs:
 *
 *   isRiding    : bool    — true while a ride is active
 *   cadence     : number  — live RPM (0–200); drives pedal speed
 *   effort      : number  — normalized intensity 0–1; drives lean / strain
 *   isSprint    : bool    — true during sprint intervals
 *   isRecovery  : bool    — true during recovery / cooldown intervals
 *   isSpeaking  : bool    — true while the AI coach is speaking
 *   rewardPulse : trigger — fire on each reward stream tick / claim
 *   prPulse     : trigger — fire when the rider beats their power PR
 *
 * Export to /public/rive/rider.riv. Until that file exists, this component
 * renders a lightweight CSS fallback so the HUD never breaks.
 * ─────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from "react";
import { useRive } from "@rive-app/react-canvas";
import { useTelemetryStore, selectCadence, selectEffort } from "@/app/stores/telemetry-store";
import { useCoachingStore, selectPrBeaten } from "@/app/stores/coaching-store";
import { useRewardsStore } from "@/app/stores/rewards-store";
import { useRideStore } from "@/app/stores/ride-store";

const RIVE_SRC = "/rive/rider.riv";
const STATE_MACHINE = "Ride";

export interface RiveRiderProps {
  /** Pixel size of the square canvas. Defaults to 160. */
  size?: number;
  className?: string;
}

export function RiveRider({ size = 160, className = "" }: RiveRiderProps) {
  // ─── Store reads ───────────────────────────────────────────────
  const isRiding = useRideStore((s) => s.isActive);
  const cadence = useTelemetryStore(selectCadence);
  const effort = useTelemetryStore(selectEffort);
  const intervalPhase = useCoachingStore((s) => s.currentInterval?.phase ?? null);
  const isSpeaking = useCoachingStore((s) => s.isSpeaking);
  const prBeaten = useCoachingStore(selectPrBeaten);
  const rewardsActive = useRewardsStore((s) => s.isActive);
  const streamState = useRewardsStore((s) => s.streamState);
  const accumulatedReward = useRewardsStore((s) => s.accumulatedReward);

  // ─── .riv availability check ───────────────────────────────────
  // Until the artist exports rider.riv, render a graceful fallback so the
  // HUD stays shippable. HEAD-probe once on mount.
  const [assetReady, setAssetReady] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(RIVE_SRC, { method: "HEAD" })
      .then((r) => !cancelled && setAssetReady(r.ok))
      .catch(() => !cancelled && setAssetReady(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const { rive, RiveComponent } = useRive({
    src: RIVE_SRC,
    stateMachines: STATE_MACHINE,
    autoplay: true,
  });

  // ─── Drive numeric / boolean inputs ────────────────────────────
  const isSprint = intervalPhase === "sprint";
  const isRecovery = intervalPhase === "recovery" || intervalPhase === "cooldown";
  const normalizedEffort = Math.max(0, Math.min(1, effort / 1000));

  useEffect(() => {
    if (!rive) return;
    const inputs = rive.stateMachineInputs(STATE_MACHINE);
    if (!inputs) return;
    const set = (name: string, value: number | boolean) => {
      const input = inputs.find((i) => i.name === name);
      if (input) input.value = value as never;
    };
    set("isRiding", isRiding);
    set("cadence", cadence ?? 0);
    set("effort", normalizedEffort);
    set("isSprint", isSprint);
    set("isRecovery", isRecovery);
    set("isSpeaking", isSpeaking);
  }, [rive, isRiding, cadence, normalizedEffort, isSprint, isRecovery, isSpeaking]);

  // ─── Fire rewardPulse trigger on each new reward tick ──────────
  const lastRewardRef = useRef(accumulatedReward);
  useEffect(() => {
    if (!rive || !rewardsActive) return;
    if (accumulatedReward === lastRewardRef.current) return;
    lastRewardRef.current = accumulatedReward;
    const inputs = rive.stateMachineInputs(STATE_MACHINE);
    const trigger = inputs?.find((i) => i.name === "rewardPulse");
    if (trigger && typeof trigger.fire === "function") trigger.fire();
  }, [rive, rewardsActive, accumulatedReward, streamState]);

  // ─── Fire prPulse trigger when power PR is beaten ──────────────
  // prBeaten is the single source of truth (app/hooks/ride/use-pr-pursuit),
  // computed from a live running average against the rider's average-power
  // PR — not instantaneous power, which would false-positive on any spike.
  useEffect(() => {
    if (!rive || !prBeaten) return;
    const inputs = rive.stateMachineInputs(STATE_MACHINE);
    const trigger = inputs?.find((i) => i.name === "prPulse");
    if (trigger && typeof trigger.fire === "function") trigger.fire();
  }, [rive, prBeaten]);

  // ─── Render ────────────────────────────────────────────────────
  if (assetReady === null) return null; // probing
  if (assetReady === false || !RiveComponent) {
    return <RiveRiderFallback size={size} className={className} effort={normalizedEffort} isSprint={isSprint} isSpeaking={isSpeaking} />;
  }

  return (
    <div
      className={`relative pointer-events-none ${className}`}
      style={{ width: size, height: size }}
      aria-label="Live rider avatar"
      role="img"
    >
      <RiveComponent
        style={{ width: size, height: size }}
        className="pointer-events-none select-none"
      />
    </div>
  );
}

// ─── Fallback (pre-.riv) ────────────────────────────────────────────
// A subtle CSS orb that still reacts to effort / sprint / speaking so the
// HUD feels alive even before the Rive asset is exported.
function RiveRiderFallback({
  size,
  className,
  effort,
  isSprint,
  isSpeaking,
}: {
  size: number;
  className: string;
  effort: number;
  isSprint: boolean;
  isSpeaking: boolean;
}) {
  const accent = isSprint ? "#fb7185" : isSpeaking ? "#22d3ee" : "#fbbf24";
  const glow = 0.25 + effort * 0.5;
  return (
    <div
      className={`relative pointer-events-none flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-label="Rider avatar (preview)"
      role="img"
    >
      <div
        className="absolute inset-0 rounded-full blur-2xl transition-all duration-500"
        style={{ background: accent, opacity: glow }}
      />
      <div
        className="relative rounded-full border border-white/20 bg-black/40 backdrop-blur-xl transition-all duration-500"
        style={{
          width: size * 0.62,
          height: size * 0.62,
          boxShadow: `0 0 ${20 + effort * 40}px ${accent}66`,
          transform: `scale(${1 + effort * 0.08})`,
        }}
      >
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{ background: `radial-gradient(circle at 50% 40%, ${accent}55, transparent 70%)` }}
        />
      </div>
    </div>
  );
}

export default RiveRider;
