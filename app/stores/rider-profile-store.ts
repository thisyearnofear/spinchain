"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type FitnessGoal = "endurance" | "weight-loss" | "event-training" | "curious";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type RideFrequency = "first-time" | "1-2-week" | "3-4-week" | "daily";
export type Motivation = "competition" | "data" | "coaching" | "vibes";
export type CoachPersonality = "drill-sergeant" | "zen-master" | "data-analyst";

export interface InjuryInfo {
  area: string;
  notes?: string;
  severity: "minor" | "moderate" | "severe";
}

/**
 * Heart-rate ceilings per training zone, in bpm. `ZONE_HRR` in
 * app/lib/ride-effort is the same ladder the ride loop reads from; this shape
 * is what gets persisted and synced.
 */
export interface TrainingZones {
  zone1: number; // Recovery (50-60% maxHR)
  zone2: number; // Endurance (60-70% maxHR)
  zone3: number; // Tempo (70-80% maxHR)
  zone4: number; // Threshold (80-90% maxHR)
  zone5: number; // Sprint (90-100% maxHR)
}

export interface RiderProfile {
  goal: FitnessGoal | null;
  experience: ExperienceLevel | null;
  frequency: RideFrequency | null;
  motivation: Motivation | null;
  coachPersonality: CoachPersonality | null;
  displayName: string | null;
  createdAt: number | null;
  // Biometric fields (Phase 1)
  ftp: number | null;
  maxHr: number | null;
  restingHr: number | null;
  weightKg: number | null;
  heightCm: number | null;
  injuries: InjuryInfo[];
  trainingZones: TrainingZones | null;
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
  ftp: null,
  maxHr: null,
  restingHr: null,
  weightKg: null,
  heightCm: null,
  injuries: [],
  trainingZones: null,
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

export function toProfilePayload(s: RiderProfile): RiderProfile {
  return {
    goal: s.goal,
    experience: s.experience,
    frequency: s.frequency,
    motivation: s.motivation,
    coachPersonality: s.coachPersonality,
    displayName: s.displayName,
    createdAt: s.createdAt,
    ftp: s.ftp,
    maxHr: s.maxHr,
    restingHr: s.restingHr,
    weightKg: s.weightKg,
    heightCm: s.heightCm,
    injuries: s.injuries,
    trainingZones: s.trainingZones,
  };
}

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

/**
 * Adaptive difficulty — adjusts recommendation based on actual ride history
 * instead of just the quiz. Uses avg effort from recent rides to bump
 * difficulty up or down.
 */
export function getAdaptiveDifficulty(
  profile: Partial<RiderProfile>,
  recentAvgEffort: number,
  recentRideCount: number,
): "easy" | "moderate" | "hard" {
  // Start with quiz-based recommendation
  let base = getRecommendedDifficulty(profile);

  // Need at least 3 rides to adapt
  if (recentRideCount < 3) return base;

  // Effort tiers: <500 bronze, 500-650 silver, 650-800 gold, 800+ platinum
  // If rider is consistently hitting gold/platinum, bump up
  if (recentAvgEffort >= 700) {
    base = base === "easy" ? "moderate" : base === "moderate" ? "hard" : "hard";
  }
  // If rider is consistently below silver, bump down
  else if (recentAvgEffort < 450) {
    base = base === "hard" ? "moderate" : base === "moderate" ? "easy" : "easy";
  }

  return base;
}

export function getRecommendedDuration(profile: Partial<RiderProfile>): number {
  if (!profile.frequency || profile.frequency === "first-time") return 10;
  if (profile.frequency === "1-2-week") return 20;
  if (profile.frequency === "3-4-week") return 30;
  return 45;
}

export function mapCoachPersonalityToEngine(p: CoachPersonality | null): "zen" | "drill-sergeant" | "data" {
  if (p === "zen-master") return "zen";
  if (p === "data-analyst") return "data";
  return "drill-sergeant";
}

export function getRecommendedRideName(difficulty: "easy" | "moderate" | "hard"): string {
  if (difficulty === "easy") return "Gentle Start";
  if (difficulty === "hard") return "Alpine Challenge";
  return "Interval Builder";
}
