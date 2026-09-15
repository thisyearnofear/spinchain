"use client";

/**
 * RiveFlowBadge — visible gamification signal for landing + rider dashboard.
 *
 * Wedge guardrail: every landing/rider view must surface streak, flow tier,
 * milestone progress, or XP badge within the first viewport. This badge is
 * that signal — Rive medallion + tier pips, HTML overlay for numbers.
 *
 * State machine `Badge` inputs:
 *   flowTier  : number  — 0-4 (calm/focused/flow/super/mastery)
 *   streak    : number  — current ride streak (reserved for future binds)
 *   milestone : trigger — fire on milestone reach
 *   levelUp   : trigger — fire on experience tier up
 *
 * Source: rive/flow-badge/scene.rml → public/rive/flow-badge.riv
 */

import { useEffect, useRef, useState } from "react";
import { useRive } from "@rive-app/react-canvas";

const RIVE_SRC = "/rive/flow-badge.riv";
const STATE_MACHINE = "Badge";

export interface RiveFlowBadgeProps {
  flowTier?: number;
  streak?: number;
  /** Increment to fire milestone pop. */
  milestoneKey?: number;
  /** Increment to fire level-up pop. */
  levelUpKey?: number;
  /** Optional text overlay, e.g. "Flow 2" or "🔥 5". */
  label?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function RiveFlowBadge({
  flowTier = 0,
  streak = 0,
  milestoneKey = 0,
  levelUpKey = 0,
  label,
  width = 200,
  height = 120,
  className = "",
}: RiveFlowBadgeProps) {
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
    const set = (name: string, value: number) => {
      const input = inputs.find((i) => i.name === name);
      if (input) input.value = value as never;
    };
    set("flowTier", Math.max(0, Math.min(4, flowTier)));
    set("streak", Math.max(0, streak));
  }, [rive, flowTier, streak]);

  const fire = (name: string) => {
    const trigger = rive
      ?.stateMachineInputs(STATE_MACHINE)
      ?.find((i) => i.name === name);
    if (trigger && typeof (trigger as { fire?: () => void }).fire === "function")
      (trigger as unknown as { fire: () => void }).fire();
  };

  const lastMilestoneRef = useRef(milestoneKey);
  useEffect(() => {
    if (!rive || milestoneKey === lastMilestoneRef.current) return;
    lastMilestoneRef.current = milestoneKey;
    fire("milestone");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rive, milestoneKey]);

  const lastLevelUpRef = useRef(levelUpKey);
  useEffect(() => {
    if (!rive || levelUpKey === lastLevelUpRef.current) return;
    lastLevelUpRef.current = levelUpKey;
    fire("levelUp");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rive, levelUpKey]);

  if (assetReady === null) return null;
  if (assetReady === false || !RiveComponent) {
    return label ? (
      <div className={className} aria-label={label} role="img">
        <span className="text-sm font-bold">{label}</span>
      </div>
    ) : null;
  }

  return (
    <div
      className={`relative ${className}`}
      style={{ width, height }}
      aria-label={label ?? `Flow tier ${flowTier}`}
      role="img"
    >
      <RiveComponent
        style={{ width, height }}
        className="pointer-events-none select-none"
      />
      {label && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow">
          {label}
        </span>
      )}
    </div>
  );
}

export default RiveFlowBadge;
