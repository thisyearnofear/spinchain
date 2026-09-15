"use client";

/**
 * RiveEffortAura — Rive-powered effort glow that replaces the canvas gradient.
 *
 * Artboard `EffortAura`, state machine `Aura`, view model `Aura`:
 *   intensity : number  — 0-1 normalized effort; drives Calm/Warm/Hot
 *   isSprint  : boolean — forces Hot posture during sprint intervals
 *   flowPulse : trigger — fire on flow-tier up / milestone
 *
 * Source: rive/effort-aura/scene.rml → public/rive/effort-aura.riv
 * Renders transparent until the .riv is ready so layouts never break.
 *
 * When `intensity`/`isSprint` props are omitted, live store values are used
 * via imperative subscriptions (no React re-renders at telemetry rate).
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
import { useTelemetryStore, selectEffort } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";

const RIVE_SRC = "/rive/effort-aura.riv";
const STATE_MACHINE = "Aura";

export interface RiveEffortAuraProps {
  /** 0-1 normalized effort. Defaults to live telemetry effort/1000. */
  intensity?: number;
  isSprint?: boolean;
  /** Increment to fire flowPulse (e.g. flow tier). */
  pulseKey?: number;
  className?: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function RiveEffortAura({
  intensity: intensityProp,
  isSprint: isSprintProp,
  pulseKey = 0,
  className = "",
}: RiveEffortAuraProps) {
  const { rive, RiveComponent } = useRive({
    src: RIVE_SRC,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    autoBind: true,
  });
  const viewModel = useViewModel(rive);
  const viewModelInstance = useViewModelInstance(viewModel, { rive });

  const { setValue: setIntensity } = useViewModelInstanceNumber("intensity", viewModelInstance);
  const { setValue: setIsSprint } = useViewModelInstanceBoolean("isSprint", viewModelInstance);
  const { trigger: fireFlowPulse } = useViewModelInstanceTrigger("flowPulse", viewModelInstance);

  const driversRef = useRef({ setIntensity, setIsSprint, fireFlowPulse });
  useEffect(() => {
    driversRef.current = { setIntensity, setIsSprint, fireFlowPulse };
  });

  // ─── Live store drive (only for props not explicitly provided) ────
  const useLiveIntensity = intensityProp === undefined;
  const useLiveSprint = isSprintProp === undefined;
  useEffect(() => {
    if (!useLiveIntensity && !useLiveSprint) return;
    const apply = () => {
      if (useLiveIntensity) {
        driversRef.current.setIntensity?.(
          clamp01((selectEffort(useTelemetryStore.getState()) ?? 0) / 1000),
        );
      }
      if (useLiveSprint) {
        const phase = useCoachingStore.getState().currentInterval?.phase ?? null;
        driversRef.current.setIsSprint?.(phase === "sprint");
      }
    };
    apply();
    const unsubTelemetry = useTelemetryStore.subscribe(apply);
    const unsubCoaching = useCoachingStore.subscribe(apply);
    return () => {
      unsubTelemetry();
      unsubCoaching();
    };
  }, [useLiveIntensity, useLiveSprint]);

  // ─── Prop-driven updates ──────────────────────────────────────────
  useEffect(() => {
    if (intensityProp !== undefined) setIntensity?.(clamp01(intensityProp));
  }, [setIntensity, intensityProp]);
  useEffect(() => {
    if (isSprintProp !== undefined) setIsSprint?.(isSprintProp);
  }, [setIsSprint, isSprintProp]);

  const lastPulseRef = useRef(pulseKey);
  useEffect(() => {
    if (pulseKey === lastPulseRef.current) return;
    lastPulseRef.current = pulseKey;
    fireFlowPulse?.();
  }, [pulseKey, fireFlowPulse]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 ${className}`}
      aria-hidden="true"
    >
      <RiveComponent className="pointer-events-none h-full w-full select-none" />
    </div>
  );
}

export default RiveEffortAura;
