"use client";

/**
 * RiveCoachOrb — Rive-powered AI coach presence.
 *
 * State machine `Coach` inputs:
 *   emotion     : number — 0 calm, 1 focused, 2 intense, 3 celebratory
 *   isSpeaking  : bool   — mouth bounce + halo breathe while coach talks
 *   celebrate   : trigger — fire on PR / milestone celebration
 *
 * Source: rive/coach-orb/scene.rml → public/rive/coach-orb.riv
 * Falls back to children (initials) until the .riv exists.
 */

import { useEffect, useState } from "react";
import { useRive } from "@rive-app/react-canvas";

const RIVE_SRC = "/rive/coach-orb.riv";
const STATE_MACHINE = "Coach";

export type CoachEmotion = "calm" | "focused" | "intense" | "celebratory";

const EMOTION_TO_NUMBER: Record<CoachEmotion, number> = {
  calm: 0,
  focused: 1,
  intense: 2,
  celebratory: 3,
};

export interface RiveCoachOrbProps {
  emotion?: CoachEmotion;
  isSpeaking?: boolean;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
}

export function RiveCoachOrb({
  emotion = "focused",
  isSpeaking = false,
  size = 64,
  className = "",
  fallback = null,
}: RiveCoachOrbProps) {
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
    const set = (name: string, value: number | boolean) => {
      const input = inputs.find((i) => i.name === name);
      if (input) input.value = value as never;
    };
    set("emotion", EMOTION_TO_NUMBER[emotion]);
    set("isSpeaking", isSpeaking);
  }, [rive, emotion, isSpeaking]);

  // Auto-fire celebrate when entering celebratory emotion.
  useEffect(() => {
    if (!rive || emotion !== "celebratory") return;
    const trigger = rive
      .stateMachineInputs(STATE_MACHINE)
      ?.find((i) => i.name === "celebrate");
    if (trigger && typeof (trigger as { fire?: () => void }).fire === "function")
      (trigger as unknown as { fire: () => void }).fire();
  }, [rive, emotion]);

  if (assetReady === null) return null;
  if (assetReady === false || !RiveComponent) return <>{fallback}</>;

  return (
    <div
      className={`relative pointer-events-none ${className}`}
      style={{ width: size, height: size }}
      aria-label={`Coach (${emotion})`}
      role="img"
    >
      <RiveComponent
        style={{ width: size, height: size }}
        className="pointer-events-none select-none"
      />
    </div>
  );
}

export default RiveCoachOrb;
