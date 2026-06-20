/**
 * Coaching Store — AI coaching state for UI consumption.
 *
 * Written to by the coordinator (interval transitions, coaching messages,
 * audio speaking state). Components read via granular selectors.
 */

import { create } from "zustand";
import type { WorkoutInterval } from "@/app/lib/workout-plan";
import type { AgentDecision } from "@/app/lib/ai-types";
import type { AILogEntry } from "@/app/engines/types";

interface CoachingState {
  currentInterval: WorkoutInterval | null;
  currentIntervalIndex: number;
  intervalProgress: number;
  intervalRemaining: number;
  lastCoachMessage: string | null;
  isSpeaking: boolean;
  aiLogs: AILogEntry[];
  reasonerState: string;
  lastDecision: AgentDecision | null;
  thoughtLog: string[];
  routeTheme: string;
}

interface CoachingActions {
  setCurrentInterval: (interval: WorkoutInterval | null, index: number) => void;
  setIntervalProgress: (progress: number, remaining: number) => void;
  setLastCoachMessage: (msg: string | null) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setAiLogs: (logs: AILogEntry[]) => void;
  setReasonerState: (state: string) => void;
  setLastDecision: (decision: AgentDecision | null) => void;
  setThoughtLog: (log: string[]) => void;
  setRouteTheme: (theme: string) => void;
  reset: () => void;
}

const initialState: CoachingState = {
  currentInterval: null,
  currentIntervalIndex: -1,
  intervalProgress: 0,
  intervalRemaining: 0,
  lastCoachMessage: null,
  isSpeaking: false,
  aiLogs: [],
  reasonerState: "",
  lastDecision: null,
  thoughtLog: [],
  routeTheme: "neon",
};

export const useCoachingStore = create<CoachingState & CoachingActions>()((set) => ({
  ...initialState,

  setCurrentInterval: (interval, index) =>
    set({ currentInterval: interval, currentIntervalIndex: index }),
  setIntervalProgress: (progress, remaining) =>
    set({ intervalProgress: progress, intervalRemaining: remaining }),
  setLastCoachMessage: (msg) => set({ lastCoachMessage: msg }),
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setAiLogs: (logs) => set({ aiLogs: logs }),
  setReasonerState: (state) => set({ reasonerState: state }),
  setLastDecision: (decision) => set({ lastDecision: decision }),
  setThoughtLog: (log) => set({ thoughtLog: log }),
  setRouteTheme: (theme) => set({ routeTheme: theme }),

  reset: () => set(initialState),
}));

// ─── Granular Selectors ──────────────────────────────────────────

export const selectCurrentInterval = (s: CoachingState) => s.currentInterval;
export const selectCurrentIntervalIndex = (s: CoachingState) => s.currentIntervalIndex;
export const selectIntervalProgress = (s: CoachingState) => s.intervalProgress;
export const selectIntervalRemaining = (s: CoachingState) => s.intervalRemaining;
export const selectLastCoachMessage = (s: CoachingState) => s.lastCoachMessage;
export const selectIsSpeaking = (s: CoachingState) => s.isSpeaking;
export const selectAiLogs = (s: CoachingState) => s.aiLogs;
export const selectLastDecision = (s: CoachingState) => s.lastDecision;
export const selectRouteTheme = (s: CoachingState) => s.routeTheme;
