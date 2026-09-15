"use client";

/**
 * RiveEffortAura — Rive-powered effort glow that replaces the canvas gradient.
 *
 * State machine `Aura` inputs:
 *   intensity : number  — 0-1 normalized effort; drives Calm/Warm/Hot
 *   isSprint  : bool    — forces Hot posture during sprint intervals
 *   flowPulse : trigger — fire on flow-tier up / milestone
 *
 * Source: rive/effort-aura/scene.rml → public/rive/effort-aura.riv
 * Until that file exists, renders nothing (transparent) so layouts never break.
 */

import { useEffect, useRef, useState } from "react";
import { useRive } from "@rive-app/react-canvas";
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

export function RiveEffortAura({
  intensity: intensityProp,
  isSprint: isSprintProp,
  pulseKey = 0,
  className = "",
}: RiveEffortAuraProps) {
  const liveEffort = useTelemetryStore(selectEffort);
  const intervalPhase = useCoachingStore((s) => s.currentInterval?.phase ?? null);

  const intensity =
    intensityProp ?? Math.max(0, Math.min(1, (liveEffort ?? 0) / 1000));
  const isSprint = isSprintProp ?? intervalPhase === "sprint";

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

  useEffect(() => {
    if (!rive) return;
    const inputs = rive.stateMachineInputs(STATE_MACHINE);
    if (!inputs) return;
    inputs.find((i) => i.name === "intensity")!.value = intensity as never;
    const sprint = inputs.find((i) => i.name === "isSprint");
    if (sprint) sprint.value = isSprint as never;
  }, [rive, intensity, isSprint]);

  const lastPulseRef = useRef(pulseKey);
  useEffect(() => {
    if (!rive || pulseKey === lastPulseRef.current) return;
    lastPulseRef.current = pulseKey;
    const trigger = rive
      .stateMachineInputs(STATE_MACHINE)
      ?.find((i) => i.name === "flowPulse");
    if (trigger && typeof (trigger as { fire?: () => void }).fire === "function")
      (trigger as unknown as { fire: () => void }).fire();
  }, [rive, pulseKey]);

  if (assetReady === null) return null;
  if (assetReady === false || !RiveComponent) return null;

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
