"use client";

/**
 * RiveRider — Rive-powered rider avatar that lives in the live ride HUD.
 *
 * The character is "part of the product, not a sticker on top": it reacts to
 * real-time telemetry (cadence, effort), interval phase (sprint / recovery),
 * coach speaking state, reward streaming, and PR moments — all sourced from
 * the existing stores the ride already writes to.
 *
 * ─── Rive view-model contract ─────────────────────────────────────
 * Artboard `Rider`, state machine `Ride`, view model `Ride` exposing:
 *
 *   isRiding    : boolean — true while a ride is active
 *   cadence     : number  — live RPM (0–200); drives pedal speed
 *   effort      : number  — normalized intensity 0–1; drives lean / strain
 *   isSprint    : boolean — true during sprint intervals
 *   isRecovery  : boolean — true during recovery / cooldown intervals
 *   isSpeaking  : boolean — true while the AI coach is speaking
 *   isReady     : boolean — pre-ride contexts; eager bounce while parked
 *   isFatigued  : boolean — honest high-load days; heavy sag while parked
 *   rewardPulse : trigger — fire on each reward stream tick / claim
 *   prPulse     : trigger — fire when the rider beats their power PR (big burst)
 *   finishPulse : trigger — fire once per finished ride (small burst)
 *
 * Source: rive/rider/scene.rml → public/rive/rider.riv. While the .riv is
 * still loading (or missing), a lightweight CSS fallback renders instead so
 * the HUD never breaks.
 *
 * ─── Update pattern ───────────────────────────────────────────────
 * Telemetry commits at up to 10 Hz. To avoid re-rendering React on every
 * commit, this component subscribes to the zustand stores imperatively and
 * writes straight into the Rive view model — mirroring the ref-based, no-
 * rerender pattern the ride page uses elsewhere (docs/ARCHITECTURE.md).
 * ─────────────────────────────────────────────────────────────────────
 */

import "./rive-runtime";
import { useEffect, useRef } from "react";
import {
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceBoolean,
  useViewModelInstanceNumber,
  useViewModelInstanceTrigger,
} from "@rive-app/react-canvas";
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
  /** Pre-ride contexts (e.g. the /rider hero): eager bounce while parked. */
  ready?: boolean;
  /** Honest high-load days: heavy sag while parked (app/lib/character-state). */
  fatigued?: boolean;
  /** Fire the small finish celebration once the VM is ready — used by the
   *  completion screen. Skipped when a PR was beaten, because the store
   *  subscription already fires the bigger PR burst in that case. */
  celebrateFinishOnMount?: boolean;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function RiveRider({ size = 160, className = "", ready = false, fatigued = false, celebrateFinishOnMount = false }: RiveRiderProps) {
  const { rive, RiveComponent } = useRive({
    src: RIVE_SRC,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    autoBind: true,
  });
  const viewModel = useViewModel(rive);
  const viewModelInstance = useViewModelInstance(viewModel, { rive });

  const { setValue: setIsRiding } = useViewModelInstanceBoolean("isRiding", viewModelInstance);
  const { setValue: setCadence } = useViewModelInstanceNumber("cadence", viewModelInstance);
  const { setValue: setEffort } = useViewModelInstanceNumber("effort", viewModelInstance);
  const { setValue: setIsSprint } = useViewModelInstanceBoolean("isSprint", viewModelInstance);
  const { setValue: setIsRecovery } = useViewModelInstanceBoolean("isRecovery", viewModelInstance);
  const { setValue: setIsSpeaking } = useViewModelInstanceBoolean("isSpeaking", viewModelInstance);
  const { trigger: fireRewardPulse } = useViewModelInstanceTrigger("rewardPulse", viewModelInstance);
  const { trigger: firePrPulse } = useViewModelInstanceTrigger("prPulse", viewModelInstance);
  const { setValue: setIsReady } = useViewModelInstanceBoolean("isReady", viewModelInstance);
  const { setValue: setIsFatigued } = useViewModelInstanceBoolean("isFatigued", viewModelInstance);
  const { trigger: fireFinishPulse } = useViewModelInstanceTrigger("finishPulse", viewModelInstance);

  // Latest VM setters, so store subscriptions registered once can always
  // reach the current view-model instance without re-subscribing.
  const driversRef = useRef({
    setIsRiding,
    setCadence,
    setEffort,
    setIsSprint,
    setIsRecovery,
    setIsSpeaking,
    fireRewardPulse,
    firePrPulse,
    setIsReady,
    setIsFatigued,
    fireFinishPulse,
  });
  const finishFiredRef = useRef(false);
  useEffect(() => {
    driversRef.current = {
      setIsRiding,
      setCadence,
      setEffort,
      setIsSprint,
      setIsRecovery,
      setIsSpeaking,
      fireRewardPulse,
      firePrPulse,
      setIsReady,
      setIsFatigued,
      fireFinishPulse,
    };
    // Prop-driven postures. Runs after every render so the write lands as
    // soon as the view-model instance exists (setters are undefined until
    // then), without needing per-prop subscription plumbing.
    driversRef.current.setIsReady?.(ready);
    driversRef.current.setIsFatigued?.(fatigued);
    // Finish celebration: once, as soon as the trigger is available. A
    // beaten PR fires the bigger prPulse via the coaching subscription
    // instead — don't double-celebrate.
    if (
      celebrateFinishOnMount &&
      !finishFiredRef.current &&
      driversRef.current.fireFinishPulse
    ) {
      finishFiredRef.current = true;
      if (!selectPrBeaten(useCoachingStore.getState())) {
        driversRef.current.fireFinishPulse();
      }
    }
  });

  // ─── Telemetry: cadence + effort (up to 10 Hz, no React renders) ──
  useEffect(() => {
    const apply = () => {
      const s = useTelemetryStore.getState();
      driversRef.current.setCadence?.(selectCadence(s) ?? 0);
      driversRef.current.setEffort?.(clamp01((selectEffort(s) ?? 0) / 1000));
    };
    apply();
    return useTelemetryStore.subscribe(apply);
  }, []);

  // ─── Ride active state ───────────────────────────────────────────
  useEffect(() => {
    const apply = () => {
      driversRef.current.setIsRiding?.(useRideStore.getState().isActive);
    };
    apply();
    return useRideStore.subscribe(apply);
  }, []);

  // ─── Coaching: interval phase, speaking, PR pulse ────────────────
  useEffect(() => {
    let prWasBeaten = false;
    const apply = () => {
      const s = useCoachingStore.getState();
      const phase = s.currentInterval?.phase ?? null;
      driversRef.current.setIsSprint?.(phase === "sprint");
      driversRef.current.setIsRecovery?.(phase === "recovery" || phase === "cooldown");
      driversRef.current.setIsSpeaking?.(s.isSpeaking);
      // prBeaten is the single source of truth (app/hooks/ride/use-pr-pursuit),
      // computed from a live running average against the rider's average-power
      // PR — not instantaneous power, which would false-positive on any spike.
      const prBeaten = selectPrBeaten(s);
      if (prBeaten && !prWasBeaten) driversRef.current.firePrPulse?.();
      prWasBeaten = prBeaten;
    };
    apply();
    return useCoachingStore.subscribe(apply);
  }, []);

  // ─── Rewards: fire rewardPulse on each new reward tick ───────────
  useEffect(() => {
    let lastReward = useRewardsStore.getState().accumulatedReward;
    return useRewardsStore.subscribe((s) => {
      if (!s.isActive) {
        lastReward = s.accumulatedReward;
        return;
      }
      if (s.accumulatedReward === lastReward) return;
      lastReward = s.accumulatedReward;
      driversRef.current.fireRewardPulse?.();
    });
  }, []);

  // ─── Render ──────────────────────────────────────────────────────
  // RiveComponent must always mount (it owns the canvas the runtime loads
  // into); the CSS fallback overlays it until the .riv is ready, and stays
  // permanently if the asset is missing.
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
      {!rive && <RiveRiderFallback size={size} />}
    </div>
  );
}

// ─── Fallback (while .riv loads) ────────────────────────────────────
// A subtle CSS orb so the HUD never shows a hole while the asset streams in.
function RiveRiderFallback({ size }: { size: number }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-full bg-[#fbbf24] opacity-30 blur-2xl" />
      <div
        className="relative rounded-full border border-white/20 bg-black/40 backdrop-blur-xl"
        style={{
          width: size * 0.62,
          height: size * 0.62,
          boxShadow: "0 0 24px #fbbf2466",
        }}
      >
        <div className="absolute inset-0 animate-pulse rounded-full bg-[radial-gradient(circle_at_50%_40%,#fbbf2455,transparent_70%)]" />
      </div>
    </div>
  );
}

export default RiveRider;
