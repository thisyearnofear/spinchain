"use client";

/**
 * RiveFlowBadge — visible gamification signal for landing + rider dashboard.
 *
 * Wedge guardrail: every landing/rider view must surface streak, flow tier,
 * milestone progress, or XP badge within the first viewport. This badge is
 * that signal — Rive medallion + tier pips, HTML overlay for numbers.
 *
 * Artboard `FlowBadge`, state machine `Badge`, view model `Badge`:
 *   flowTier  : number  — 0-4 (calm/focused/flow/super/mastery)
 *   streak    : number  — current ride streak (reserved for future binds)
 *   milestone : trigger — fire on milestone reach
 *   levelUp   : trigger — fire on experience tier up
 *
 * Source: rive/flow-badge/scene.rml → public/rive/flow-badge.riv
 */

import "./rive-runtime";
import { useEffect, useRef } from "react";
import {
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceNumber,
  useViewModelInstanceTrigger,
} from "@rive-app/react-canvas";

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
  const { rive, RiveComponent } = useRive({
    src: RIVE_SRC,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    autoBind: true,
  });
  const viewModel = useViewModel(rive);
  const viewModelInstance = useViewModelInstance(viewModel, { rive });

  const { setValue: setFlowTier } = useViewModelInstanceNumber("flowTier", viewModelInstance);
  const { setValue: setStreak } = useViewModelInstanceNumber("streak", viewModelInstance);
  const { trigger: fireMilestone } = useViewModelInstanceTrigger("milestone", viewModelInstance);
  const { trigger: fireLevelUp } = useViewModelInstanceTrigger("levelUp", viewModelInstance);

  useEffect(() => {
    setFlowTier?.(Math.max(0, Math.min(4, flowTier)));
  }, [setFlowTier, flowTier]);
  useEffect(() => {
    setStreak?.(Math.max(0, streak));
  }, [setStreak, streak]);

  const lastMilestoneRef = useRef(milestoneKey);
  useEffect(() => {
    if (milestoneKey === lastMilestoneRef.current) return;
    lastMilestoneRef.current = milestoneKey;
    fireMilestone?.();
  }, [milestoneKey, fireMilestone]);

  const lastLevelUpRef = useRef(levelUpKey);
  useEffect(() => {
    if (levelUpKey === lastLevelUpRef.current) return;
    lastLevelUpRef.current = levelUpKey;
    fireLevelUp?.();
  }, [levelUpKey, fireLevelUp]);

  // RiveComponent must always mount (it owns the canvas the runtime loads
  // into); while the .riv streams in, the label still renders on its own.
  return (
    <div
      className={`relative ${className}`}
      style={{ width, height }}
      aria-label={label ?? `Flow tier ${flowTier}`}
      role="img"
    >
      {/* className on RiveComponent suppresses its inline style — sizing
          has to live in the class list or the canvas stays 0×0. */}
      <RiveComponent className="pointer-events-none h-full w-full select-none" />
      {label && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow">
          {label}
        </span>
      )}
    </div>
  );
}

export default RiveFlowBadge;
