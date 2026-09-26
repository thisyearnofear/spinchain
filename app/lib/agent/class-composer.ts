/**
 * Agentic class composer (Phase 3).
 *
 * One deterministic intent → one complete class: a WorkoutPlan with
 * per-interval power bands and personality-voiced cues, an environment
 * (theme registry name), and route parameters. This is the same class
 * shape the instructor builder emits — a human instructor and an AI
 * coach compose through this one primitive, and the result rides
 * through the standard practice/publish paths unchanged.
 *
 * Plain TS, no React. LLM-authored cues can replace the deterministic
 * line banks later without changing the emitted shape.
 */

import {
  createWorkoutPlan,
  type IntervalPhase,
  type WorkoutDifficulty,
  type WorkoutInterval,
  type WorkoutPlan,
} from "@/app/lib/workout-plan";

export type ClassGoal = "recovery" | "endurance" | "hiit" | "climb";
export type CoachPersonality = "zen" | "drill-sergeant" | "data";

export interface ClassIntent {
  goal: ClassGoal;
  /** 15–90 minutes. */
  durationMinutes: number;
  personality: CoachPersonality;
  /** Theme registry name; defaults per goal. Unknown names render as neon. */
  themeName?: string;
  /** Display name for the coach; defaults per personality. */
  coachName?: string;
}

export interface ComposedClass {
  name: string;
  description: string;
  goal: ClassGoal;
  personality: CoachPersonality;
  coachName: string;
  themeName: string;
  plan: WorkoutPlan;
  route: {
    name: string;
    distance: number; // km
    duration: number; // minutes
    elevationGain: number; // meters
  };
}

export const CLASS_GOALS: ClassGoal[] = ["recovery", "endurance", "hiit", "climb"];
export const COACH_PERSONALITIES: CoachPersonality[] = ["zen", "drill-sergeant", "data"];

export const GOAL_LABELS: Record<ClassGoal, string> = {
  recovery: "Recovery Spin",
  endurance: "Endurance Ride",
  hiit: "Sprint Circuit",
  climb: "Mountain Climb",
};

const GOAL_DESCRIPTIONS: Record<ClassGoal, string> = {
  recovery: "An easy spin to flush the legs and come back stronger.",
  endurance: "Steady miles at a sustainable effort — build the engine.",
  hiit: "Short, sharp efforts with full recoveries. Bring your legs.",
  climb: "Long seated climbs with valley recoveries between peaks.",
};

const DEFAULT_THEME: Record<ClassGoal, string> = {
  recovery: "alpine",
  endurance: "neon",
  hiit: "mars",
  climb: "alpine",
};

const DEFAULT_COACH_NAME: Record<CoachPersonality, string> = {
  zen: "Coach Nova",
  "drill-sergeant": "Coach Volt",
  data: "Coach Atlas",
};

/** Route parameters per goal (scaled lightly by duration). */
const GOAL_ROUTE: Record<ClassGoal, { distance: number; elevationGain: number }> = {
  recovery: { distance: 10, elevationGain: 80 },
  endurance: { distance: 22, elevationGain: 250 },
  hiit: { distance: 16, elevationGain: 180 },
  climb: { distance: 18, elevationGain: 800 },
};

/** Power bands + cadence targets per phase (mirror the preset workouts). */
const PHASE_TARGETS: Record<
  IntervalPhase,
  { targetPower: [number, number]; targetRpm: [number, number] }
> = {
  warmup: { targetPower: [60, 90], targetRpm: [70, 85] },
  endurance: { targetPower: [110, 150], targetRpm: [80, 90] },
  interval: { targetPower: [160, 220], targetRpm: [85, 95] },
  sprint: { targetPower: [250, 400], targetRpm: [100, 120] },
  recovery: { targetPower: [50, 80], targetRpm: [65, 75] },
  cooldown: { targetPower: [40, 70], targetRpm: [60, 70] },
};

/**
 * Interval cues per phase per personality. Arrays give variety across
 * repeated phases (indexed by occurrence). Written in the coach's voice;
 * the in-ride coaching engine layers live effort cues on top of these.
 */
const CUE_LINES: Record<IntervalPhase, Record<CoachPersonality, string[]>> = {
  warmup: {
    zen: ["Arrive. Let the legs find their circle."],
    "drill-sergeant": ["Legs turning! We start NOW!"],
    data: ["Easy spin — settle between 60 and 90 watts."],
  },
  endurance: {
    zen: [
      "Steady breath, steady wheel.",
      "Hold this rhythm — smooth is fast.",
      "Stay relaxed. Let the road come to you.",
    ],
    "drill-sergeant": [
      "Hold that pace — no fading!",
      "Eyes up, pressure on — STAY WITH IT!",
      "This is where the work happens. HOLD!",
    ],
    data: [
      "Settle at 110 to 150 watts, cadence 85.",
      "Hold the band — efficiency now pays later.",
      "Same power, calm breathing. Bank the miles.",
    ],
  },
  interval: {
    zen: [
      "Rise with the hill — smooth and strong.",
      "Meet the gradient. Breathe into the effort.",
      "One more peak — stay tall in the saddle.",
    ],
    "drill-sergeant": [
      "ATTACK the climb! Drive those knees!",
      "The mountain doesn't care — PUSH!",
      "Summit in sight. EVERYTHING you've got!",
    ],
    data: [
      "Push into 160 to 220 watts for this block.",
      "Climb pace: hold the band, cadence steady.",
      "Final ascent — same numbers, full focus.",
    ],
  },
  sprint: {
    zen: [
      "One bright effort — then let it go.",
      "Explode, release. Again: explode, release.",
      "Full expression, thirty seconds.",
      "Last one. Empty the matchbook with a smile.",
    ],
    "drill-sergeant": [
      "ALL OUT! Go go GO!",
      "EXPLODE! Nothing saved!",
      "DIG DEEP! This is the one!",
      "LAST ONE! Leave it ALL out there!",
    ],
    data: [
      "Maximal effort — 250 watts or better, 30 seconds.",
      "Sprint two: same target, full commitment.",
      "Sprint three: hold technique as power peaks.",
      "Final sprint: highest power of the day, now.",
    ],
  },
  recovery: {
    zen: [
      "Soften. Let the breath catch up.",
      "Easy circles. The work is banked.",
      "Settle — the next effort is coming.",
    ],
    "drill-sergeant": [
      "Recover FAST — we go again!",
      "Easy spin! Don't you dare stop pedaling!",
      "Shake it out — next one's coming!",
    ],
    data: [
      "Drop under 80 watts. Let heart rate fall.",
      "Active recovery — keep the cadence, cut the load.",
      "Reset: below 80 watts until the next effort.",
    ],
  },
  cooldown: {
    zen: ["Roll it out. Carry this calm with you."],
    "drill-sergeant": ["Bring it down. You EARNED this!"],
    data: ["Spin easy below 70 watts as we finish."],
  },
};

/** Interval skeletons per goal, as fractions of the working body. */
const GOAL_STRUCTURE: Record<
  ClassGoal,
  { difficulty: WorkoutDifficulty; tags: string[]; body: IntervalPhase[] }
> = {
  recovery: {
    difficulty: "easy",
    tags: ["recovery", "agent-built"],
    body: ["endurance", "recovery", "endurance"],
  },
  endurance: {
    difficulty: "moderate",
    tags: ["endurance", "agent-built"],
    body: ["endurance", "endurance", "interval", "endurance"],
  },
  hiit: {
    difficulty: "hard",
    tags: ["hiit", "agent-built"],
    body: [
      "endurance",
      "sprint", "recovery",
      "sprint", "recovery",
      "sprint", "recovery",
      "sprint", "recovery",
    ],
  },
  climb: {
    difficulty: "hard",
    tags: ["climb", "agent-built"],
    body: ["endurance", "interval", "recovery", "interval", "recovery", "interval"],
  },
};

/** Recovery rides spin easier than the stock endurance band. */
const RECOVERY_ENDURANCE_BAND: [number, number] = [90, 120];

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

/**
 * Compose a complete class from intent. Deterministic: same intent in,
 * same class out. Throws on out-of-range duration.
 */
export function composeClass(intent: ClassIntent): ComposedClass {
  const { goal, personality } = intent;
  const durationMinutes = Math.round(intent.durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 90) {
    throw new Error(`Class duration must be 15–90 minutes, got ${intent.durationMinutes}`);
  }
  if (!CLASS_GOALS.includes(goal)) {
    throw new Error(`Unknown class goal: ${goal}`);
  }
  if (!COACH_PERSONALITIES.includes(personality)) {
    throw new Error(`Unknown coach personality: ${personality}`);
  }

  const totalSeconds = durationMinutes * 60;
  const warmupSeconds = Math.min(360, Math.max(180, Math.round(totalSeconds * 0.12)));
  const cooldownSeconds = Math.min(360, Math.max(150, Math.round(totalSeconds * 0.1)));
  const bodySeconds = totalSeconds - warmupSeconds - cooldownSeconds;

  const structure = GOAL_STRUCTURE[goal];
  const blockCount = structure.body.length;
  const perBlock = Math.max(30, Math.round(bodySeconds / blockCount / 30) * 30);
  // The final body block absorbs rounding so the plan totals the class
  // duration exactly.
  const lastBlock = Math.max(30, bodySeconds - perBlock * (blockCount - 1));

  const phaseCounts: Partial<Record<IntervalPhase, number>> = {};
  const cueFor = (phase: IntervalPhase): string => {
    const occurrence = phaseCounts[phase] ?? 0;
    phaseCounts[phase] = occurrence + 1;
    const lines = CUE_LINES[phase][personality];
    return lines[occurrence % lines.length];
  };

  const intervalFor = (phase: IntervalPhase, durationSeconds: number): WorkoutInterval => {
    const targets = PHASE_TARGETS[phase];
    const targetPower =
      goal === "recovery" && phase === "endurance"
        ? RECOVERY_ENDURANCE_BAND
        : targets.targetPower;
    return {
      phase,
      durationSeconds,
      targetRpm: targets.targetRpm,
      targetPower,
      coachCue: cueFor(phase),
    };
  };

  const intervals: WorkoutInterval[] = [
    intervalFor("warmup", warmupSeconds),
    ...structure.body.map((phase, index) =>
      intervalFor(phase, index === blockCount - 1 ? lastBlock : perBlock),
    ),
    intervalFor("cooldown", cooldownSeconds),
  ];

  const themeName = intent.themeName ?? DEFAULT_THEME[goal];
  const coachName = intent.coachName?.trim() || DEFAULT_COACH_NAME[personality];
  const routeBase = GOAL_ROUTE[goal];
  const durationScale = durationMinutes / 45;

  const name = `${capitalize(themeName)} ${GOAL_LABELS[goal]}`;
  const plan = createWorkoutPlan(
    `agent-${goal}-${durationMinutes}`,
    name,
    intervals,
    structure.difficulty,
    [...structure.tags, `${durationMinutes}min`],
    GOAL_DESCRIPTIONS[goal],
  );

  return {
    name,
    description: GOAL_DESCRIPTIONS[goal],
    goal,
    personality,
    coachName,
    themeName,
    plan,
    route: {
      name,
      distance: Math.round(routeBase.distance * durationScale * 10) / 10,
      duration: durationMinutes,
      elevationGain: Math.round(routeBase.elevationGain * durationScale),
    },
  };
}

/**
 * Validate a composed class before it reaches a ride. Returns a list of
 * problems; empty means the class is rideable.
 */
export function validateComposedClass(composed: ComposedClass): string[] {
  const problems: string[] = [];
  const { plan } = composed;

  if (!plan.intervals.length) problems.push("plan has no intervals");
  if (plan.intervals[0]?.phase !== "warmup") problems.push("plan must start with a warmup");
  if (plan.intervals[plan.intervals.length - 1]?.phase !== "cooldown")
    problems.push("plan must end with a cooldown");

  plan.intervals.forEach((interval, index) => {
    if (interval.durationSeconds <= 0) problems.push(`interval ${index} has no duration`);
    if (!interval.targetPower) problems.push(`interval ${index} (${interval.phase}) lacks a power band`);
    if (!interval.coachCue?.trim()) problems.push(`interval ${index} (${interval.phase}) lacks a coach cue`);
  });

  const declaredSeconds = composed.route.duration * 60;
  const drift = Math.abs(plan.totalDuration - declaredSeconds);
  if (drift > 90)
    problems.push(`plan totals ${plan.totalDuration}s but class is ${declaredSeconds}s`);

  if (!composed.themeName.trim()) problems.push("no environment theme");
  if (!composed.coachName.trim()) problems.push("no coach name");

  return problems;
}
