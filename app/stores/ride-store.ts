"use client";

/**
 * Centralized Ride Store — single source of truth for all ride state.
 *
 * Components subscribe to only the slices they need via selectors,
 * so a telemetry update (2-4Hz) only re-renders the HUD, not the
 * entire page. Callbacks live in the store as stable references.
 *
 * This replaces the 1750-line God Component pattern where 30+ hooks
 * and 18 useState calls created cascading re-render loops (React #185).
 */

import { create } from "zustand";
import type { RewardMode } from "@/app/hooks/rewards/use-rewards";
import type { WorkoutPlan } from "@/app/lib/workout-plan";
import type { RewardClaimStatus } from "@/app/components/features/ride/ride-completion";
import type { RideSyncStatus } from "@/app/lib/analytics/ride-history";

// ============================================================================
// State Shape
// ============================================================================

export interface RideState {
  // --- Ride Lifecycle ---
  isRiding: boolean;
  isStarting: boolean;
  isExiting: boolean;
  rideProgress: number;
  elapsedTime: number;

  // --- Connection ---
  bleConnected: boolean;
  useSimulator: boolean;
  connectionHint: string | null;

  // --- UI ---
  viewMode: "immersive" | "focus";
  showNoBikeModal: boolean;
  showKeyboardHints: boolean;
  showDemoModal: boolean;
  showMilestone: { title: string; subtitle: string } | null;

  // --- Rewards ---
  rewardMode: RewardMode;
  completedRideId: string | null;
  completionSyncStatus: RideSyncStatus;
  completionPrimaryAction: "view_history" | "ride_again";

  // --- Workout ---
  workoutPlan: WorkoutPlan | null;

  // --- Demo ---
  demoStats: {
    duration: number;
    avgHeartRate: number;
    maxHeartRate: number;
    effortScore: number;
    spinEarned: string;
    rewardsWereActive: boolean;
  };

  // --- Market (demo/guest) ---
  marketStats: {
    ticketsSold: number;
    revenue: number;
    capacity: number;
  };

  // --- Flow Background ---
  flowIntensity: number;

  // --- Actions ---
  setIsRiding: (v: boolean) => void;
  setIsStarting: (v: boolean) => void;
  setIsExiting: (v: boolean) => void;
  setRideProgress: (v: number) => void;
  setElapsedTime: (v: number | ((prev: number) => number)) => void;
  setBleConnected: (v: boolean) => void;
  setUseSimulator: (v: boolean) => void;
  setConnectionHint: (v: string | null) => void;
  setViewMode: (v: "immersive" | "focus") => void;
  setShowNoBikeModal: (v: boolean) => void;
  setShowKeyboardHints: (v: boolean) => void;
  setShowDemoModal: (v: boolean) => void;
  setShowMilestone: (v: { title: string; subtitle: string } | null) => void;
  setRewardMode: (v: RewardMode) => void;
  setCompletedRideId: (v: string | null) => void;
  setCompletionSyncStatus: (v: RideSyncStatus) => void;
  setCompletionPrimaryAction: (v: "view_history" | "ride_again") => void;
  setWorkoutPlan: (v: WorkoutPlan | null) => void;
  setDemoStats: (v: RideState["demoStats"]) => void;
  setMarketStats: (v: RideState["marketStats"]) => void;
  setFlowIntensity: (v: number) => void;

  // --- Batch reset for ride start ---
  resetForRideStart: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useRideStore = create<RideState>((set) => ({
  // --- Ride Lifecycle ---
  isRiding: false,
  isStarting: false,
  isExiting: false,
  rideProgress: 0,
  elapsedTime: 0,

  // --- Connection ---
  bleConnected: false,
  useSimulator: false,
  connectionHint: null,

  // --- UI ---
  viewMode: "immersive",
  showNoBikeModal: false,
  showKeyboardHints: false,
  showDemoModal: false,
  showMilestone: null,

  // --- Rewards ---
  rewardMode: "zk-batch",
  completedRideId: null,
  completionSyncStatus: "local_only",
  completionPrimaryAction: "view_history",

  // --- Workout ---
  workoutPlan: null,

  // --- Demo ---
  demoStats: {
    duration: 0,
    avgHeartRate: 0,
    maxHeartRate: 0,
    effortScore: 0,
    spinEarned: "0",
    rewardsWereActive: false,
  },

  // --- Market ---
  marketStats: {
    ticketsSold: 0,
    revenue: 0,
    capacity: 50,
  },

  // --- Flow ---
  flowIntensity: 0,

  // --- Actions ---
  setIsRiding: (v) => set({ isRiding: v }),
  setIsStarting: (v) => set({ isStarting: v }),
  setIsExiting: (v) => set({ isExiting: v }),
  setRideProgress: (v) => set({ rideProgress: v }),
  setElapsedTime: (v) =>
    set((state) => ({
      elapsedTime: typeof v === "function" ? v(state.elapsedTime) : v,
    })),
  setBleConnected: (v) => set({ bleConnected: v }),
  setUseSimulator: (v) => set({ useSimulator: v }),
  setConnectionHint: (v) => set({ connectionHint: v }),
  setViewMode: (v) => set({ viewMode: v }),
  setShowNoBikeModal: (v) => set({ showNoBikeModal: v }),
  setShowKeyboardHints: (v) => set({ showKeyboardHints: v }),
  setShowDemoModal: (v) => set({ showDemoModal: v }),
  setShowMilestone: (v) => set({ showMilestone: v }),
  setRewardMode: (v) => set({ rewardMode: v }),
  setCompletedRideId: (v) => set({ completedRideId: v }),
  setCompletionSyncStatus: (v) => set({ completionSyncStatus: v }),
  setCompletionPrimaryAction: (v) => set({ completionPrimaryAction: v }),
  setWorkoutPlan: (v) => set({ workoutPlan: v }),
  setDemoStats: (v) => set({ demoStats: v }),
  setMarketStats: (v) => set({ marketStats: v }),
  setFlowIntensity: (v) => set({ flowIntensity: v }),

  // --- Batch reset ---
  resetForRideStart: () =>
    set({
      isRiding: true,
      isStarting: false,
      isExiting: false,
      rideProgress: 0,
      elapsedTime: 0,
    }),
}));
