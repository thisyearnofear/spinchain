"use client";

/**
 * RiveCoachOrb — Rive-powered AI coach presence.
 *
 * Artboard `CoachOrb`, state machine `Coach`, view model `Coach`:
 *   emotion     : number  — 0 calm, 1 focused, 2 intense, 3 celebratory
 *   isSpeaking  : boolean — mouth bounce + halo breathe while coach talks
 *   celebrate   : trigger — fire on PR / milestone celebration
 *
 * Source: rive/coach-orb/scene.rml → public/rive/coach-orb.riv
 * Falls back to children (initials) until the .riv is ready.
 */

import "./rive-runtime";
import { useEffect } from "react";
import {
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceBoolean,
  useViewModelInstanceNumber,
  useViewModelInstanceTrigger,
} from "@rive-app/react-canvas";

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
  const { rive, RiveComponent } = useRive({
    src: RIVE_SRC,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    autoBind: true,
  });
  const viewModel = useViewModel(rive);
  const viewModelInstance = useViewModelInstance(viewModel, { rive });

  const { setValue: setEmotion } = useViewModelInstanceNumber("emotion", viewModelInstance);
  const { setValue: setIsSpeaking } = useViewModelInstanceBoolean("isSpeaking", viewModelInstance);
  const { trigger: fireCelebrate } = useViewModelInstanceTrigger("celebrate", viewModelInstance);

  useEffect(() => {
    setEmotion?.(EMOTION_TO_NUMBER[emotion]);
  }, [setEmotion, emotion]);
  useEffect(() => {
    setIsSpeaking?.(isSpeaking);
  }, [setIsSpeaking, isSpeaking]);

  // Auto-fire celebrate when entering celebratory emotion.
  useEffect(() => {
    if (emotion !== "celebratory") return;
    fireCelebrate?.();
  }, [emotion, fireCelebrate]);

  // RiveComponent must always mount (it owns the canvas the runtime loads
  // into); the fallback overlays it until the .riv is ready.
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
      {!rive && <div className="absolute inset-0">{fallback}</div>}
    </div>
  );
}

export default RiveCoachOrb;
