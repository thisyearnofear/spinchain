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
 *   riderTapped : boolean — scene → host: set true by the rider's pointer
 *               listener on ANY button (the web runtime ignores the button
 *               filter — see below); the host reads the last button, opens
 *               the panel on left and fires celebrateClick on right. It stays
 *               a boolean (not a VM trigger — those DO fire from listeners
 *               given an instance default) because the host must discriminate
 *               the button itself and the write→observe→reset round-trip is
 *               proven.
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

import { useRivSrc, useRiveReducedMotion } from "./rive-runtime";
import { usePrefersReducedMotion } from "@/app/hooks/use-prefers-reduced-motion";
import { useEffect, useRef } from "react";
import {
  useRive,
  useStateMachineInput,
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
  /** Host callback for the scene's left-click pointer listener. Providing it
   *  makes the canvas interactive (pointer events on, context menu
   *  suppressed); without it the rider stays click-through as before. */
  onTapped?: () => void;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function RiveRider({ size = 160, className = "", ready = false, fatigued = false, celebrateFinishOnMount = false, onTapped }: RiveRiderProps) {
  const rivSrc = useRivSrc(RIVE_SRC);
  const { rive, RiveComponent } = useRive({
    src: rivSrc,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    autoBind: true,
  });
  const viewModel = useViewModel(rive);
  const viewModelInstance = useViewModelInstance(viewModel, { rive });

  useRiveReducedMotion(rive);

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

  // ─── Scene → host: the rider's pointer listener writes this boolean ──
  // (The tap signal is a boolean the host consumes and resets. VM-trigger
  // writes from listeners work too — re-verified on 2.44.2 — but need a
  // ViewModelInstanceTrigger default and buy nothing here.)
  //
  // The web runtime (2.44.1 and 2.44.2) ignores
  // ListenerInputTypePointerButton's pointerButtonValue: every button matches
  // a "primary" listener and a "secondary" one never fires (verified against
  // both the self-hosted wasm and the CDN runtime). So the scene's TapRider
  // listener fires on left AND
  // right clicks, and button discrimination happens here: last pointer button
  // decides whether a tap opens the panel (left) or plays the in-scene
  // celebrate burst (right, via the celebrateClick input trigger the FX layer
  // already transitions on).
  const onTappedRef = useRef(onTapped);
  useEffect(() => {
    onTappedRef.current = onTapped;
  });
  const lastButtonRef = useRef(0);
  const celebrateInput = useStateMachineInput(rive, STATE_MACHINE, "celebrateClick");
  const { value: tapped, setValue: setTapped } = useViewModelInstanceBoolean("riderTapped", viewModelInstance);
  const tapFiredRef = useRef(false);
  useEffect(() => {
    if (!tapped) {
      tapFiredRef.current = false;
      return;
    }
    if (tapFiredRef.current) return;
    tapFiredRef.current = true;
    setTapped?.(false);
    const rightButton = lastButtonRef.current === 2;
    lastButtonRef.current = 0;
    if (rightButton) {
      celebrateInput?.fire();
    } else {
      onTappedRef.current?.();
    }
  }, [tapped, setTapped, celebrateInput]);

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
  // Store commits only move a TARGET; a rAF eases current→target at 3/s —
  // the same damping constant the 3D cyclist uses (route-visualizer
  // dampFactor(3, delta)) — so the rider *responds* instead of *refreshes*.
  const telemetryTargetRef = useRef({ cadence: 0, effort: 0 });
  useEffect(() => {
    const apply = () => {
      const s = useTelemetryStore.getState();
      telemetryTargetRef.current.cadence = selectCadence(s) ?? 0;
      telemetryTargetRef.current.effort = clamp01((selectEffort(s) ?? 0) / 1000);
    };
    apply();
    return useTelemetryStore.subscribe(apply);
  }, []);

  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let last = performance.now();
    const current = { ...telemetryTargetRef.current };
    const tick = (now: number) => {
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = telemetryTargetRef.current;
      const k = 1 - Math.exp(-3 * delta);
      current.cadence += (t.cadence - current.cadence) * k;
      current.effort += (t.effort - current.effort) * k;
      driversRef.current.setCadence?.(current.cadence);
      driversRef.current.setEffort?.(current.effort);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

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
  const interactive = Boolean(onTapped);
  return (
    <div
      className={`relative ${interactive ? "pointer-events-auto" : "pointer-events-none"} ${className}`}
      style={{ width: size, height: size }}
      aria-label={interactive ? "Rider avatar — click to see your data" : "Live rider avatar"}
      role={interactive ? "button" : "img"}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onTapped?.();
              }
            }
          : undefined
      }
      onPointerDownCapture={
        interactive
          ? (e) => {
              lastButtonRef.current = e.button;
            }
          : undefined
      }
      onContextMenu={interactive ? (e) => e.preventDefault() : undefined}
    >
      {/* className on RiveComponent suppresses its inline style — sizing
          has to live in the class list or the canvas stays 0×0. */}
      <RiveComponent
        className={`h-full w-full select-none ${interactive ? "cursor-pointer" : "pointer-events-none"}`}
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
