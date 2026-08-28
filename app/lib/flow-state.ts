/**
 * Flow State — Adaptive engagement engine that tracks sustained rider performance
 * and maps it to emotional states (calm → focused → flow → flow-super → flow-mastery).
 *
 * Flow is not instant power — it's sustained consistency near target. A rider who
 * hits 250W for 10 seconds is not in flow. A rider who holds 230-270W for 3 minutes
 * is. This system distinguishes them and escalates the experience proportionally.
 *
 * Architecture:
 * 1. Input: raw stats (power, HR, cadence) + interval target + rider history
 * 2. Compute: consistency score, duration score, trajectory score
 * 3. Map to: flow state tier (0-4) with smooth transitions
 * 4. Emit: flow event for visual/audio/verbal adaptation
 *
 * Flow Tiers:
 *   TIER_0 = CALM       — Riding below target, recovering (baseline world)
 *   TIER_1 = FOCUSED    — Near target, building consistency (subtle visual lift)
 *   TIER_2 = FLOW       — Sustained effort, locked in (full visual escalation)
 *   TIER_3 = FLOW_SUPER — Pushing limits, sustained (visual peak + coach intensity)
 *   TIER_4 = FLOW_MASTERY — Personal best territory (celebratory treatment)
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useCoachingStore } from "@/app/stores/coaching-store";

// ─── Flow State Types ───────────────────────────────────────────────

export type FlowStateTier = 0 | 1 | 2 | 3 | 4;

export interface FlowState {
  tier: FlowStateTier;
  score: number;        // 0.0-1.0 composite score
  consistency: number;  // 0.0-1.0 how close to target
  duration: number;     // seconds at current tier
  trajectory: number;   // -1.0 (declining) → 0.0 (flat) → 1.0 (rising)
  previousTier: FlowStateTier;
  enteredNewTierAt: number; // timestamp
}

export interface FlowStateEvent {
  type: "tier-enter" | "tier-rise" | "tier-fall" | "sustained" | "peak";
  tier: FlowStateTier;
  previousTier: FlowStateTier;
  score: number;
  message?: string; // coach-ready message for this transition
}

// ─── Flow Configuration ────────────────────────────────────────────

const FLOW_CONFIG = {
  // Target consistency: how close to interval target (%)
  TARGETS: {
    TIER_0: { min: 0,   max: 0.55, label: "Calm", color: "#38bdf8" },     // below 55%
    TIER_1: { min: 0.55, max: 0.75, label: "Focused", color: "#34d399" }, // 55-75%
    TIER_2: { min: 0.75, max: 0.90, label: "Flow", color: "#f59e0b" },    // 75-90%
    TIER_3: { min: 0.90, max: 1.05, label: "Super Flow", color: "#f97316" }, // 90-105%
    TIER_4: { min: 1.05, max: 2.0, label: "Mastery", color: "#ef4444" },   // above 105%
  },

  // Minimum duration at each tier before escalation
  ESCALATION_DELAY_MS: {
    TIER_0: 0,
    TIER_1: 8000,    // 8 seconds focused
    TIER_2: 15000,   // 15 seconds flow
    TIER_3: 25000,   // 25 seconds super flow
    TIER_4: 35000,   // 35 seconds mastery
  },

  // Smooth transition factors (lerp speed per tick at 30fps)
  TRANSITION_SPEED: {
    ENTER: 0.3,   // fast when entering new tier
    SUSTAINED: 0.05, // slow decay while maintaining
    FALL: 0.1,     // moderate fall
  },

  // Consistency window (rolling average)
  CONSIDERATION_WINDOW_MS: 10000, // 10-second sliding window

  // Peak detection: sudden power spike sustained briefly
  PEAK_THRESHOLD: 1.15,       // 115% of target
  PEAK_DURATION_MS: 5000,     // sustained for 5 seconds

  // Milestone tracking
  MILESTONE_INTERVALS: [120, 300, 600, 1200], // 2min, 5min, 10min, 20min
} as const;

// Coach messages for flow transitions
const FLOW_MESSAGES: Record<string, Record<string, string>> = {
  "tier-enter": {
    0: "Easy is good. Set your rhythm.",
    1: "Getting into it. Find your pace.",
    2: "Flow state. Let it carry you.",
    3: "Super flow! You're unstoppable.",
    4: "Mastery. This is your zone.",
  },
  "tier-rise": {
    1: "Power up — you're building intensity!",
    2: "Lock in — this is where it gets good.",
    3: "Peak performance — push through!",
    4: "Record territory — leave it all out there!",
  },
  "tier-fall": {
    1: "Breathe. Recovery is part of the work.",
    2: "Hold steady — you've got this.",
    3: "Don't let go — almost there.",
    4: "Back to mastery — I know you can.",
  },
  "sustained": {
    2: "Sustained. Consistent. That's how you train.",
    3: "You're holding super flow — relentless.",
    4: "Mastery sustained. This is who you are.",
  },
};

// ─── Flow State Engine ─────────────────────────────────────────────

/**
 * Compute current flow state from raw inputs.
 * Pure function — no side effects, deterministic.
 */
export function computeFlowState(
  currentPower: number,
  intervalTarget: number | null,
  recentPowerHistory: number[], // rolling array of recent power samples
  hr: number,
  hrResting: number,
  sessionStart: number, // timestamp in ms
  currentTier: FlowStateTier,
  currentTierEnteredAt: number,
  totalFlowMinutes: number,
): FlowState {
  const now = performance.now();

  // ─── Consistency Score ───────────────────────────────────────────
  // How close is current power to interval target?
  const target = intervalTarget ?? 200; // default to moderate interval
  const rawConsistency = currentPower / target;
  // Compress: 50% of target = 0.25 score, 100% = 1.0, 150% = 1.25
  const consistencyScore = Math.min(1.5, Math.max(0, rawConsistency));

  // ─── Trajectory Score ────────────────────────────────────────────
  // Is the rider improving or declining? Use recent history
  let trajectory = 0;
  if (recentPowerHistory.length >= 6) {
    const recent = recentPowerHistory.slice(-6); // last 2 seconds at 30fps
    const older = recentPowerHistory.slice(-12, -6);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
    const change = (avgRecent - avgOlder) / (avgOlder || 1);
    trajectory = Math.max(-1, Math.min(1, change * 5)); // scale up
  }

  // ─── Duration Score ──────────────────────────────────────────────
  // How long at current tier? (0 → 1 over ESCALATION_DELAY_MS)
  const tierEnterTime = currentTierEnteredAt || sessionStart;
  const tierDuration = now - tierEnterTime;
  const escalationDelay = FLOW_CONFIG.ESCALATION_DELAY_MS[
    `TIER_${currentTier}` as keyof typeof FLOW_CONFIG.ESCALATION_DELAY_MS
  ] || 15000;
  const durationScore = Math.min(1, tierDuration / escalationDelay);

  // ─── HR Zone Score ───────────────────────────────────────────────
  // HR reserve method: (current - rest) / (max - rest)
  const hrMax = 220 - 30; // approximate (220 - age, assume 30)
  const hrReserve = hrMax - hrResting;
  const hrZone = hrReserve > 0 ? (hr - hrResting) / hrReserve : 0.5;
  const hrScore = Math.min(1, hrZone);

  // ─── Composite Flow Score ────────────────────────────────────────
  // Weighted combination: consistency (40%), trajectory (25%), duration (20%), HR (15%)
  const compositeScore =
    consistencyScore * 0.40 +
    Math.max(0, (trajectory + 1) / 2) * 0.25 + // normalize -1→1 to 0→1
    durationScore * 0.20 +
    hrScore * 0.15;

  // ─── Map to Tier ─────────────────────────────────────────────────
  let newTier = 0 as FlowStateTier;
  const tiers = [
    { min: 0, max: 0.30, tier: 0 as FlowStateTier },
    { min: 0.30, max: 0.50, tier: 1 as FlowStateTier },
    { min: 0.50, max: 0.70, tier: 2 as FlowStateTier },
    { min: 0.70, max: 0.85, tier: 3 as FlowStateTier },
    { min: 0.85, max: 1.5, tier: 4 as FlowStateTier },
  ];

  for (const t of tiers) {
    if (compositeScore >= t.min && compositeScore < t.max) {
      newTier = t.tier;
      break;
    }
  }

  return {
    tier: newTier,
    score: compositeScore,
    consistency: consistencyScore,
    duration: tierDuration,
    trajectory,
    previousTier: currentTier,
    enteredNewTierAt: newTier === currentTier ? currentTierEnteredAt : now,
  };
}

/**
 * Detect if this is a "peak" moment — sudden high power sustained.
 */
export function detectFlowPeak(
  currentPower: number,
  intervalTarget: number | null,
  sessionStart: number,
  currentTierEnteredAt: number,
): boolean {
  const target = intervalTarget ?? 200;
  const ratio = currentPower / target;
  const atCurrentTier = performance.now() - currentTierEnteredAt;
  return ratio >= FLOW_CONFIG.PEAK_THRESHOLD && atCurrentTier >= FLOW_CONFIG.PEAK_DURATION_MS;
}

/**
 * Get coach-ready message for a flow transition.
 */
export function getFlowMessage(
  eventType: string,
  tier: FlowStateTier,
  previousTier: FlowStateTier,
): string | null {
  // Only message on meaningful transitions
  const tierDelta = Math.abs(tier - previousTier);
  if (tierDelta > 1) {
    return FLOW_MESSAGES["tier-rise"]?.[tier] ?? null;
  }

  const messages = FLOW_MESSAGES[eventType as keyof typeof FLOW_MESSAGES];
  if (!messages) return null;

  return messages[tier] ?? null;
}

/**
 * Check if a milestone was reached (total flow time).
 */
export function checkFlowMilestone(totalFlowMinutes: number): number | null {
  for (const milestone of FLOW_CONFIG.MILESTONE_INTERVALS) {
    if (totalFlowMinutes >= milestone / 60 * 1000 && totalFlowMinutes < milestone / 60 * 1000 + 1000) {
      return milestone;
    }
  }
  return null;
}

// ─── React Hooks ───────────────────────────────────────────────────

export function useFlowState(
  currentPower: number,
  hr: number,
  hrResting: number,
) {
  // performance.now() is intentionally captured once per mount; ref keeps it stable.
  const sessionStart = useRef(performance.now());

  // Flow state tracking
  const [flowState, setFlowState] = useState<FlowState>({
    tier: 0,
    score: 0,
    consistency: 0,
    duration: 0,
    trajectory: 0,
    previousTier: 0,
    enteredNewTierAt: performance.now(),
  });

  const [events, setEvents] = useState<FlowStateEvent[]>([]);
  const [milestones, setMilestones] = useState<number[]>([]);

  // The tick computes at 10Hz, but committing `newFlow` to state on every
  // tick re-rendered the ride page ~10x/sec — which restarted effects that
  // (directly or transitively) keyed on values flowing from here. Inputs and
  // bookkeeping live in refs; React state only updates when something the UI
  // actually consumes changes: tier, coarsely-quantized score, events, or
  // milestones.
  const flowStateRef = useRef(flowState);
  const totalFlowMinutesRef = useRef(0);
  const onFlowEventRef = useRef<((event: FlowStateEvent) => void) | null>(null);
  const powerRef = useRef(currentPower);
  const hrRef = useRef(hr);
  const hrRestingRef = useRef(hrResting);
  powerRef.current = currentPower;
  hrRef.current = hr;
  hrRestingRef.current = hrResting;

  // Per-instance event/milestone dedupe sets (were module-level singletons).
  const prevEventsRef = useRef(new Set<number>());
  const milestonesRef = useRef(new Set<number>());

  // Rolling power history for trajectory calculation
  const powerHistoryRef = useRef<number[]>([]);
  const powerHistoryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Session Start Cleanup ───────────────────────────────────────
  useEffect(() => {
    // Clear power history on new ride
    powerHistoryRef.current = [];
    sessionStart.current = performance.now();
    const initial: FlowState = {
      tier: 0,
      score: 0,
      consistency: 0,
      duration: 0,
      trajectory: 0,
      previousTier: 0,
      enteredNewTierAt: performance.now(),
    };
    flowStateRef.current = initial;
    setFlowState(initial);
    totalFlowMinutesRef.current = 0;
    setEvents([]);
    setMilestones([]);
    prevEventsRef.current.clear();
    milestonesRef.current.clear();
  }, []);

  // ─── Power History Collector ─────────────────────────────────────
  // Interval reads latest power via ref so it is created once per mount
  // instead of being torn down and rebuilt whenever currentPower changes.
  useEffect(() => {
    powerHistoryTimerRef.current = setInterval(() => {
      powerHistoryRef.current.push(powerRef.current);
      // Keep last 10 seconds at 30fps = 300 samples
      if (powerHistoryRef.current.length > 300) {
        powerHistoryRef.current.shift();
      }
    }, 33); // ~30fps

    return () => {
      if (powerHistoryTimerRef.current) {
        clearInterval(powerHistoryTimerRef.current);
      }
    };
  }, []);

  // ─── Flow State Computation ──────────────────────────────────────
  // Selector-based subscription: re-renders only when the active interval
  // changes, not on every coaching-store update.
  const targetPower = useCoachingStore((s) => s.currentInterval?.targetPower ?? null);
  const intervalTarget = targetPower ? Math.round((targetPower[0] + targetPower[1]) / 2) : null;
  const intervalTargetRef = useRef(intervalTarget);
  intervalTargetRef.current = intervalTarget;

  const tick = useCallback(() => {
    if (!powerHistoryRef.current.length) return;

    const prevState = flowStateRef.current;
    const newFlow = computeFlowState(
      powerRef.current,
      intervalTargetRef.current,
      powerHistoryRef.current,
      hrRef.current,
      hrRestingRef.current,
      sessionStart.current,
      prevState.tier,
      prevState.enteredNewTierAt,
      totalFlowMinutesRef.current,
    );
    flowStateRef.current = newFlow;

    // Detect transitions
    const newEvents: FlowStateEvent[] = [];

    if (newFlow.tier !== prevState.tier) {
      const eventType = newFlow.tier > prevState.tier ? "tier-rise" : "tier-fall";
      const event: FlowStateEvent = {
        type: eventType,
        tier: newFlow.tier,
        previousTier: prevState.tier,
        score: newFlow.score,
        message: getFlowMessage(eventType, newFlow.tier, prevState.tier) ?? undefined,
      };
      newEvents.push(event);

      // Fire callback
      if (onFlowEventRef.current) {
        onFlowEventRef.current(event);
      }
    }

    // Check for sustained flow
    if (newFlow.tier >= 2 && newFlow.duration > 15000 && !prevEventsRef.current.has(newFlow.tier)) {
      const sustainedEvent: FlowStateEvent = {
        type: "sustained",
        tier: newFlow.tier,
        previousTier: prevState.tier,
        score: newFlow.score,
        message: FLOW_MESSAGES.sustained?.[newFlow.tier] ?? undefined,
      };
      newEvents.push(sustainedEvent);
      prevEventsRef.current.add(newFlow.tier);
    }

    // Update total flow minutes (ref only — not rendered live)
    if (newFlow.tier >= 2) {
      const added = (performance.now() - newFlow.enteredNewTierAt) / 60000;
      totalFlowMinutesRef.current += added / 60; // spread over tick interval
    }

    // Check milestones
    let milestonesChanged = false;
    for (const milestone of FLOW_CONFIG.MILESTONE_INTERVALS) {
      const targetMins = milestone / 60000;
      if (totalFlowMinutesRef.current >= targetMins && !milestonesRef.current.has(milestone)) {
        milestonesRef.current.add(milestone);
        milestonesChanged = true;
        const milestoneEvent: FlowStateEvent = {
          type: "peak",
          tier: newFlow.tier,
          previousTier: prevState.tier,
          score: newFlow.score,
          message: `${milestone / 60} minutes of flow — legendary.`,
        };
        newEvents.push(milestoneEvent);
        if (onFlowEventRef.current) {
          onFlowEventRef.current(milestoneEvent);
        }
      }
    }

    // Commit to state only when the UI-relevant values changed. The score
    // moves a little on nearly every tick; the tier is what consumers render.
    const tierChanged = newFlow.tier !== prevState.tier;
    if (tierChanged) {
      setFlowState(newFlow);
    }
    if (newEvents.length > 0) {
      setEvents((prev) => [...prev.slice(-20), ...newEvents]); // keep last 20 events
    }
    if (milestonesChanged) {
      setMilestones((prev) => [...prev, ...FLOW_CONFIG.MILESTONE_INTERVALS.filter((m) => milestonesRef.current.has(m) && !prev.includes(m))]);
    }
  }, []);

  // Run flow tick at ~10fps (every 100ms). tick is stable and reads refs,
  // so the interval is created once per mount.
  useEffect(() => {
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [tick]);

  // ─── Public API ──────────────────────────────────────────────────

  /**
   * Register a callback for flow state events.
   * Use this to trigger visuals, audio, or coach messages.
   */
  const registerFlowEventHandler = useCallback((handler: (event: FlowStateEvent) => void) => {
    onFlowEventRef.current = handler;
  }, []);

  /**
   * Reset flow state (start of new ride).
   */
  const resetFlowState = useCallback(() => {
    powerHistoryRef.current = [];
    sessionStart.current = performance.now();
    const initial: FlowState = {
      tier: 0,
      score: 0,
      consistency: 0,
      duration: 0,
      trajectory: 0,
      previousTier: 0,
      enteredNewTierAt: performance.now(),
    };
    flowStateRef.current = initial;
    setFlowState(initial);
    totalFlowMinutesRef.current = 0;
    setEvents([]);
    setMilestones([]);
    prevEventsRef.current.clear();
    milestonesRef.current.clear();
  }, []);

  // Stable identity between renders (state only changes on tier/event/
  // milestone transitions), so consumers can list flow.* in effect deps
  // without resubscribing on every parent render. totalFlowMinutes is a
  // getter over a ref, so the memoized object still returns fresh values.
  return useMemo(() => ({
    flowState,
    events,
    get totalFlowMinutes() {
      return totalFlowMinutesRef.current;
    },
    milestones,
    registerFlowEventHandler,
    resetFlowState,
    // Convenience access
    flowTier: flowState.tier,
    get flowScore() {
      return flowStateRef.current.score;
    },
    flowLabel: Object.entries(FLOW_CONFIG.TARGETS).find(
      ([, v]) => v.label === ["Calm", "Focused", "Flow", "Super Flow", "Mastery"][flowState.tier]
    )?.[1].label ?? "Calm",
  }), [flowState, events, milestones, registerFlowEventHandler, resetFlowState]);
}

// ─── Flow-Visual Mapping ───────────────────────────────────────────

/**
 * Map flow tier to visual enhancement level.
 * Returns parameters that can be passed to world-reactivity system.
 */
export function getFlowVisualParameters(tier: FlowStateTier, baseParams: Partial<{
  bloomIntensity: number;
  chromaticOffset: number;
  vignetteDarkness: number;
  fogDensity: number;
  starRotationSpeed: number;
}>) {
  const multipliers = [1, 1.2, 1.5, 1.8, 2.2]; // exponential escalation
  const m = multipliers[tier] ?? 1;

  return {
    bloomIntensity: (baseParams.bloomIntensity ?? 1) * m,
    chromaticOffset: (baseParams.chromaticOffset ?? 0) * m,
    vignetteDarkness: Math.min(1, (baseParams.vignetteDarkness ?? 0.8) + (tier * 0.05)),
    fogDensity: Math.max(15, (baseParams.fogDensity ?? 40) - (tier * 5)),
    starRotationSpeed: (baseParams.starRotationSpeed ?? 1) * m,
  };
}