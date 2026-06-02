/**
 * Ride Session Store - Global state management for ride sessions
 * 
 * Features:
 * - Centralized ride session state
 * - Telemetry data management
 * - Workout progress tracking
 * - Cross-component synchronization
 * - Persistence for recovery
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { WorkoutPlan, WorkoutInterval } from "@/app/lib/workout-plan";
import type { GhostState, GhostPerformance } from "@/app/lib/analytics/ghost-service";
import type { TelemetrySnapshot, MultiGhostState } from "@/app/engines/types";

// Types
export interface RideSession {
  id: string;
  classId: string;
  className: string;
  instructor: string;
  startTime: number;
  duration: number;
  isPractice: boolean;
}

export interface TelemetryData {
  heartRate: number;
  power: number;
  cadence: number;
  speed: number;
  distance: number;
  timestamp: number;
}

export interface RideStats {
  avgHeartRate: number;
  maxHeartRate: number;
  avgPower: number;
  maxPower: number;
  totalDistance: number;
  totalCalories: number;
  currentZone: string;
  timeInZones: Record<string, number>;
}

export interface RewardState {
  earned: number;
  threshold: number;
  claimed: boolean;
  claimable: boolean;
}

interface RideState {
  // Session
  session: RideSession | null;
  isActive: boolean;
  isPaused: boolean;
  elapsedTime: number;
  
  // Workout
  workoutPlan: WorkoutPlan | null;
  currentInterval: WorkoutInterval | null;
  intervalProgress: number;
  intervalRemaining: number;
  
  // Telemetry
  latestTelemetry: TelemetryData | null;
  telemetryHistory: TelemetryData[];
  stats: RideStats;
  
  // Rewards
  rewards: RewardState;
  
  // Ride lifecycle
  rideProgress: number;
  isStarting: boolean;
  isExiting: boolean;

  // Ghost & multiplayer
  ghostState: GhostState;
  ghostPerformance: GhostPerformance | null;
  multiGhostState: MultiGhostState[];

  // Telemetry averages
  telemetryAverages: {
    avgHr: number;
    avgPower: number;
    avgEffort: number;
  };

  // Coach message (latest from EventBus)
  lastCoachMessage: string | null;

  // AI coaching state
  aiActive: boolean;

  // Route state
  routeProgress: number;
  currentGear: number;

  // UI State
  showDemoModal: boolean;
  showCompleteModal: boolean;
  audioEnabled: boolean;
  coachingEnabled: boolean;
}

interface RideActions {
  // Session actions
  startSession: (session: Omit<RideSession, "startTime">) => void;
  endSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  
  // Workout actions
  setWorkoutPlan: (plan: WorkoutPlan | null) => void;
  setCurrentInterval: (interval: WorkoutInterval | null) => void;
  updateIntervalProgress: (progress: number, remaining: number) => void;
  
  // Telemetry actions
  addTelemetry: (data: Omit<TelemetryData, "timestamp">) => void;
  clearTelemetryHistory: () => void;
  
  // Stats actions
  updateStats: (updates: Partial<RideStats>) => void;
  resetStats: () => void;
  
  // Reward actions
  updateRewards: (updates: Partial<RewardState>) => void;
  claimRewards: () => void;
  
  // UI actions
  setShowDemoModal: (show: boolean) => void;
  setShowCompleteModal: (show: boolean) => void;
  toggleAudio: () => void;
  toggleCoaching: () => void;
  
  // Ride lifecycle actions
  setRideProgress: (progress: number) => void;
  setIsStarting: (starting: boolean) => void;
  setIsExiting: (exiting: boolean) => void;

  // Ghost actions
  setGhostState: (state: GhostState) => void;
  setGhostPerformance: (perf: GhostPerformance | null) => void;
  setMultiGhostState: (state: MultiGhostState[]) => void;

  // Telemetry averages
  setTelemetryAverages: (avgs: { avgHr: number; avgPower: number; avgEffort: number }) => void;

  // Coach message
  setLastCoachMessage: (msg: string | null) => void;

  // AI coaching
  setAiActive: (active: boolean) => void;

  // Gear / route
  setCurrentGear: (gear: number) => void;

  // Time tracking
  tick: (deltaMs: number) => void;
  
  // Reset all
  reset: () => void;
}

// Default stats
const defaultStats: RideStats = {
  avgHeartRate: 0,
  maxHeartRate: 0,
  avgPower: 0,
  maxPower: 0,
  totalDistance: 0,
  totalCalories: 0,
  currentZone: "rest",
  timeInZones: {
    recovery: 0,
    endurance: 0,
    tempo: 0,
    threshold: 0,
    vo2max: 0,
    anaerobic: 0,
  },
};

// Default rewards
const defaultRewards: RewardState = {
  earned: 0,
  threshold: 150,
  claimed: false,
  claimable: false,
};

// Initial state
const initialState: RideState = {
  session: null,
  isActive: false,
  isPaused: false,
  elapsedTime: 0,
  workoutPlan: null,
  currentInterval: null,
  intervalProgress: 0,
  intervalRemaining: 0,
  latestTelemetry: null,
  telemetryHistory: [],
  stats: { ...defaultStats },
  rewards: { ...defaultRewards },
  rideProgress: 0,
  isStarting: false,
  isExiting: false,
  ghostState: { leadLagTime: 0, distanceGap: 0, ghostPoint: null },
  ghostPerformance: null,
  multiGhostState: [],
  telemetryAverages: { avgHr: 0, avgPower: 0, avgEffort: 0 },
  lastCoachMessage: null,
  aiActive: false,
  routeProgress: 0,
  currentGear: 10,
  showDemoModal: false,
  showCompleteModal: false,
  audioEnabled: true,
  coachingEnabled: true,
};

// Create store with persistence
export const useRideStore = create<RideState & RideActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Session actions
      startSession: (sessionData) => {
        const session: RideSession = {
          ...sessionData,
          startTime: Date.now(),
        };
        set({
          session,
          isActive: true,
          isPaused: false,
          elapsedTime: 0,
          telemetryHistory: [],
          stats: { ...defaultStats },
          rewards: { ...defaultRewards },
        });
      },

      endSession: () => {
        set({ isActive: false, isPaused: false });
      },

      pauseSession: () => {
        set({ isPaused: true });
      },

      resumeSession: () => {
        set({ isPaused: false });
      },

      // Workout actions
      setWorkoutPlan: (plan) => {
        set({ workoutPlan: plan });
      },

      setCurrentInterval: (interval) => {
        set({ currentInterval: interval });
      },

      updateIntervalProgress: (progress, remaining) => {
        set({
          intervalProgress: progress,
          intervalRemaining: remaining,
        });
      },

      // Telemetry actions
      addTelemetry: (data) => {
        const telemetry: TelemetryData = {
          ...data,
          timestamp: Date.now(),
        };
        
        set((state) => {
          const newHistory = [...state.telemetryHistory, telemetry].slice(-300); // Keep last 5 minutes at 1Hz
          
          // Calculate rolling averages
          const avgHeartRate = Math.round(
            newHistory.reduce((sum, t) => sum + t.heartRate, 0) / newHistory.length
          );
          const avgPower = Math.round(
            newHistory.reduce((sum, t) => sum + t.power, 0) / newHistory.length
          );
          
          return {
            latestTelemetry: telemetry,
            telemetryHistory: newHistory,
            stats: {
              ...state.stats,
              avgHeartRate,
              avgPower,
              maxHeartRate: Math.max(state.stats.maxHeartRate, data.heartRate),
              maxPower: Math.max(state.stats.maxPower, data.power),
              totalDistance: data.distance,
            },
          };
        });
      },

      clearTelemetryHistory: () => {
        set({ telemetryHistory: [], latestTelemetry: null });
      },

      // Stats actions
      updateStats: (updates) => {
        set((state) => ({
          stats: { ...state.stats, ...updates },
        }));
      },

      resetStats: () => {
        set({ stats: { ...defaultStats } });
      },

      // Reward actions
      updateRewards: (updates) => {
        set((state) => ({
          rewards: { ...state.rewards, ...updates },
        }));
      },

      claimRewards: () => {
        set((state) => ({
          rewards: { ...state.rewards, claimed: true, claimable: false },
        }));
      },

      // UI actions
      setShowDemoModal: (show) => {
        set({ showDemoModal: show });
      },

      setShowCompleteModal: (show) => {
        set({ showCompleteModal: show });
      },

      toggleAudio: () => {
        set((state) => ({ audioEnabled: !state.audioEnabled }));
      },

      toggleCoaching: () => {
        set((state) => ({ coachingEnabled: !state.coachingEnabled }));
      },

      // Ride lifecycle
      setRideProgress: (progress) => set({ rideProgress: progress, routeProgress: progress / 100 }),
      setIsStarting: (starting) => set({ isStarting: starting }),
      setIsExiting: (exiting) => set({ isExiting: exiting }),

      // Ghost
      setGhostState: (state) => set({ ghostState: state }),
      setGhostPerformance: (perf) => set({ ghostPerformance: perf }),
      setMultiGhostState: (state) => set({ multiGhostState: state }),

      // Telemetry averages
      setTelemetryAverages: (avgs) => set({ telemetryAverages: avgs }),

      // Coach message
      setLastCoachMessage: (msg) => set({ lastCoachMessage: msg }),

      // AI coaching
      setAiActive: (active) => set({ aiActive: active }),

      // Gear
      setCurrentGear: (gear) => set({ currentGear: gear }),

      // Time tracking
      tick: (deltaMs) => {
        const { isActive, isPaused } = get();
        if (isActive && !isPaused) {
          set((state) => ({ elapsedTime: state.elapsedTime + deltaMs }));
        }
      },

      // Reset all
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "spinchain-ride-store",
      storage: createJSONStorage(() => localStorage),
      // Only persist certain fields
      partialize: (state) => ({
        session: state.session,
        isActive: state.isActive,
        isPaused: state.isPaused,
        elapsedTime: state.elapsedTime,
        workoutPlan: state.workoutPlan,
        stats: state.stats,
        rewards: state.rewards,
        audioEnabled: state.audioEnabled,
        coachingEnabled: state.coachingEnabled,
        // Don't persist: telemetryHistory (too large), UI state
      }),
    }
  )
);

// Selectors for performance
export const selectSession = (state: RideState & RideActions) => state.session;
export const selectIsActive = (state: RideState & RideActions) => state.isActive;
export const selectIsPaused = (state: RideState & RideActions) => state.isPaused;
export const selectElapsedTime = (state: RideState & RideActions) => state.elapsedTime;
export const selectLatestTelemetry = (state: RideState & RideActions) => state.latestTelemetry;
export const selectStats = (state: RideState & RideActions) => state.stats;
export const selectRewards = (state: RideState & RideActions) => state.rewards;

// Hook for time tracking
export function useRideTimer() {
  const { isActive, isPaused, elapsedTime, tick } = useRideStore();
  
  return {
    isActive,
    isPaused,
    elapsedTime,
    formattedTime: formatDuration(elapsedTime),
    tick,
  };
}

// Selectors for performance
export const selectRideProgress = (state: RideState & RideActions) => state.rideProgress;
export const selectIsStarting = (state: RideState & RideActions) => state.isStarting;
export const selectIsExiting = (state: RideState & RideActions) => state.isExiting;
export const selectGhostState = (state: RideState & RideActions) => state.ghostState;
export const selectMultiGhostState = (state: RideState & RideActions) => state.multiGhostState;
export const selectTelemetryAverages = (state: RideState & RideActions) => state.telemetryAverages;
export const selectLastCoachMessage = (state: RideState & RideActions) => state.lastCoachMessage;
export const selectAiActive = (state: RideState & RideActions) => state.aiActive;
export const selectCurrentGear = (state: RideState & RideActions) => state.currentGear;

// Utility to format duration
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
