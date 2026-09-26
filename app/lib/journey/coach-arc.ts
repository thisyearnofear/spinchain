/**
 * Between-ride coach arc (the fourth act of the character loop).
 *
 * Composes what the coach says on the journey page from REAL signals only:
 * ride history, the honest training-load model (getWeeklyLoad), streaks,
 * and the coach's cross-session memory. No readiness scores, no invented
 * momentum. Recovery and rest are celebrated as training, alongside PRs.
 *
 * Plain TS; the journey page wires stores in.
 */

import {
  resolveBetweenRideState,
  BETWEEN_RIDE_LABELS,
  type CharacterState,
} from "@/app/lib/character-state";
import { getWeeklyLoad } from "@/app/lib/analytics/training-load";
import { getStreakStats } from "@/app/lib/analytics/ride-history";
import type { RideSummary } from "@/app/lib/analytics/ride-history";
import type { CoachMemory } from "@/app/lib/walrus/coach-memory";

export type CoachPersonality = "zen" | "drill-sergeant" | "data";

export interface CoachArcInput {
  /** Ride history, newest first. */
  rides: RideSummary[];
  /** Most recent coach memory, if any coach has one cached. */
  memory: CoachMemory | null;
  personality: CoachPersonality;
  coachName: string;
  now?: number;
}

export interface CoachArc {
  state: CharacterState;
  /** Rider-facing label (never the raw enum). */
  stateLabel: string;
  coachName: string;
  headline: string;
  message: string;
  /** Present on streaks worth acknowledging. */
  streakLine: string | null;
}

const DAY_MS = 86_400_000;

function daysBetween(a: number, b: number): number {
  return Math.floor(Math.abs(b - a) / DAY_MS);
}

/** The last ride beat the rider's best average power (factual PR check). */
function lastRideWasPR(memory: CoachMemory | null): boolean {
  if (!memory?.lastRide || memory.bestAvgPower <= 0) return false;
  return memory.lastRide.avgPower >= memory.bestAvgPower;
}

export function composeCoachArc({
  rides,
  memory,
  personality,
  coachName,
  now = Date.now(),
}: CoachArcInput): CoachArc {
  const rideCount = rides.length;
  const lastRideAt = rides[0]?.completedAt ?? null;
  const load = getWeeklyLoad(rides, now);
  const isPR = lastRideWasPR(memory);

  const state = resolveBetweenRideState({
    rideCount,
    lastRideAt,
    fatigued: load.fatigued,
    lastRideWasPR: isPR,
    now,
  });

  const streakDays = getStreakStats(rides).daily;
  const streakLine = streakDays >= 2 ? `${streakDays} days in a row` : null;

  const headline =
    rideCount === 0
      ? "Your first ride is waiting"
      : `${rideCount} ride${rideCount === 1 ? "" : "s"} on the books`;

  const watts = memory?.lastRide ? Math.round(memory.lastRide.avgPower) : 0;
  const days = lastRideAt !== null ? daysBetween(lastRideAt, now) : 0;
  const hours = lastRideAt !== null ? Math.max(1, Math.round((now - lastRideAt) / 3_600_000)) : 0;

  let message: string;
  switch (state) {
    case "idle":
      message = {
        zen: "No rides yet, and that's fine — the road is patient. When you're ready, a first ride takes a minute to start.",
        "drill-sergeant": "Day one starts when you clip in. Let's make it today!",
        data: "No rides on record yet. One short ride is enough to start your baseline.",
      }[personality];
      break;
    case "celebrate":
      message = {
        zen: `Your last ride set a new best — ${watts} watts average. Let today be easy; that gain settles in while you rest.`,
        "drill-sergeant": `NEW PERSONAL BEST — ${watts} watts average! That's what the work looks like. Enjoy this one!`,
        data: `New best average power: ${watts} watts. Adaptation happens between efforts — an easy day now is the right call.`,
      }[personality];
      break;
    case "fatigued":
      message = {
        zen: `${load.hardRidesLast7d} hard rides this week. Today, rest IS the training. Breathe — the legs will answer.`,
        "drill-sergeant": `${load.hardRidesLast7d} hard rides in 7 days — outstanding work. Today we stand down. Recovery is an order!`,
        data: `${load.hardRidesLast7d} hard efforts in 7 days exceeds a sustainable load. An easy day today protects your next block.`,
      }[personality];
      break;
    case "recovery":
      message = {
        zen: "Your last ride is still settling in. If you ride today, keep it gentle — easy miles count too.",
        "drill-sergeant": "Back again? Good. Keep today smooth — we build on yesterday's work, not through it.",
        data: `Last ride was about ${hours} hours ago. An easy spin today aids recovery more than another hard effort.`,
      }[personality];
      break;
    case "ready":
    default:
      if (days >= 7) {
        message = {
          zen: "Welcome back — no catching up needed. Start easy; the road remembers you.",
          "drill-sergeant": "There you are! We start fresh TODAY. Clip in!",
          data: `It's been ${days} days. Consistency beats intensity on return — start moderate.`,
        }[personality];
      } else {
        message = {
          zen: "Rested and ready. When you ride today, ride with attention.",
          "drill-sergeant": "You're rested — that means no excuses left. Let's ride!",
          data: `It's been ${days} days since your last ride. A session today keeps the momentum.`,
        }[personality];
      }
      break;
  }

  return {
    state,
    stateLabel: BETWEEN_RIDE_LABELS[state],
    coachName,
    headline,
    message,
    streakLine,
  };
}
