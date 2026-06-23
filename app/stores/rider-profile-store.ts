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

/**
 * Compute training zones from max heart rate using the Karvonen formula
 * (uses resting HR if available for more accurate zones).
 */
export function computeTrainingZones(maxHr: number, restingHr?: number | null): TrainingZones {
  const rhr = restingHr ?? 0;
  const hrr = maxHr - rhr; // Heart rate reserve

  return {
    zone1: Math.round(rhr + hrr * 0.55), // 50-60%
    zone2: Math.round(rhr + hrr * 0.65), // 60-70%
    zone3: Math.round(rhr + hrr * 0.75), // 70-80%
    zone4: Math.round(rhr + hrr * 0.85), // 80-90%
    zone5: Math.round(rhr + hrr * 0.95), // 90-100%
  };
}

/**
 * Get FTP-based power zones (if FTP is known).
 * Returns watts for each zone boundary.
 */
export function computePowerZones(ftp: number): {
  zone1: number; // Active recovery (<55% FTP)
  zone2: number; // Endurance (56-75% FTP)
  zone3: number; // Tempo (76-90% FTP)
  zone4: number; // Threshold (91-105% FTP)
  zone5: number; // VO2Max (106-120% FTP)
} {
  return {
    zone1: Math.round(ftp * 0.50),
    zone2: Math.round(ftp * 0.65),
    zone3: Math.round(ftp * 0.83),
    zone4: Math.round(ftp * 0.98),
    zone5: Math.round(ftp * 1.13),
  };
}

/**
 * Estimate FTP from recent ride data using the 95% of 20-min power rule.
 * Falls back to a bodyweight-based estimate if no power data is available.
 */
export function estimateFtpFromRides(
  recentAvgPower: number,
  weightKg: number | null,
): number | null {
  if (recentAvgPower > 0) {
    // If we have avg power from recent rides, estimate FTP as ~75% of avg
    // (avg power over a ride is typically 60-80% of FTP for endurance rides)
    return Math.round(recentAvgPower / 0.75);
  }
  // Rough heuristic: 2.5-3.0 W/kg for untrained, up to 5+ for elite
  if (weightKg && weightKg > 0) {
    return Math.round(weightKg * 2.5);
  }
  return null;
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
  return "Accelerator Pitch";
}
