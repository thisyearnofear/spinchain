"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type FitnessGoal = "endurance" | "weight-loss" | "event-training" | "curious";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type RideFrequency = "first-time" | "1-2-week" | "3-4-week" | "daily";
export type Motivation = "competition" | "data" | "coaching" | "vibes";
export type CoachPersonality = "drill-sergeant" | "zen-master" | "data-analyst";

export interface RiderProfile {
  goal: FitnessGoal | null;
  experience: ExperienceLevel | null;
  frequency: RideFrequency | null;
  motivation: Motivation | null;
  coachPersonality: CoachPersonality | null;
  displayName: string | null;
  createdAt: number | null;
}

interface RiderProfileState extends RiderProfile {
  setProfile: (profile: Partial<RiderProfile>) => void;
  isComplete: () => boolean;
  reset: () => void;
}

const emptyProfile: RiderProfile = {
  goal: null,
  experience: null,
  frequency: null,
  motivation: null,
  coachPersonality: null,
  displayName: null,
  createdAt: null,
};

export const useRiderProfile = create<RiderProfileState>()(
  persist(
    (set, get) => ({
      ...emptyProfile,
      setProfile: (profile) => set((state) => ({ ...state, ...profile })),
      isComplete: () => {
        const s = get();
        return !!(s.goal && s.experience && s.frequency && s.motivation);
      },
      reset: () => set(emptyProfile),
    }),
    {
      name: "spinchain-rider-profile",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const GOAL_LABELS: Record<FitnessGoal, string> = {
  "endurance": "Build endurance",
  "weight-loss": "Lose weight",
  "event-training": "Train for an event",
  "curious": "Just curious",
};

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  "beginner": "Beginner",
  "intermediate": "Intermediate",
  "advanced": "Advanced",
};

export const FREQUENCY_LABELS: Record<RideFrequency, string> = {
  "first-time": "First time on a bike",
  "1-2-week": "1-2 times a week",
  "3-4-week": "3-4 times a week",
  "daily": "Daily rider",
};

export const MOTIVATION_LABELS: Record<Motivation, string> = {
  "competition": "Competition & PRs",
  "data": "Data & metrics",
  "coaching": "Guided coaching",
  "vibes": "Music & vibes",
};

export const COACH_LABELS: Record<CoachPersonality, string> = {
  "drill-sergeant": "Drill Sergeant",
  "zen-master": "Zen Master",
  "data-analyst": "Data Analyst",
};

export function getRecommendedDifficulty(profile: Partial<RiderProfile>): "easy" | "moderate" | "hard" {
  if (!profile.experience) return "moderate";
  if (profile.experience === "beginner") return "easy";
  if (profile.experience === "advanced") return "hard";
  return "moderate";
}

export function getRecommendedDuration(profile: Partial<RiderProfile>): number {
  if (!profile.frequency || profile.frequency === "first-time") return 10;
  if (profile.frequency === "1-2-week") return 20;
  if (profile.frequency === "3-4-week") return 30;
  return 45;
}
