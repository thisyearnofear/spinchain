/**
 * Ride Store — Lifecycle-only state for ride sessions.
 *
 * Telemetry, coaching, rewards, and UI state live in domain stores:
 * - telemetry-store: snapshot, history, averages, ghost state
 * - coaching-store: intervals, coach messages, AI state
 * - rewards-store: reward accrual, mode, stream state
 * - ui-store: HUD mode, view mode, device state
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MultiGhostState } from "@/app/engines/types";

export interface RideSession {
  id: string;
  classId: string;
  className: string;
  instructor: string;
  startTime: number;
  duration: number;
  isPractice: boolean;
}

interface RideState {
  session: RideSession | null;
  isActive: boolean;
  isPaused: boolean;
  elapsedTime: number;
  rideProgress: number;
  isStarting: boolean;
  isExiting: boolean;
  multiGhostState: MultiGhostState[];
}

const initialState: RideState = {
  session: null,
  isActive: false,
  isPaused: false,
  elapsedTime: 0,
  rideProgress: 0,
  isStarting: false,
  isExiting: false,
  multiGhostState: [],
};

export const useRideStore = create<RideState>()(
  persist(
    () => ({
      ...initialState,
    }),
    {
      name: "spinchain-ride-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        session: state.session,
        isActive: state.isActive,
        elapsedTime: state.elapsedTime,
      }),
    },
  ),
);

export const selectIsActive = (s: RideState) => s.isActive;
export const selectIsPaused = (s: RideState) => s.isPaused;
export const selectElapsedTime = (s: RideState) => s.elapsedTime;
export const selectRideProgress = (s: RideState) => s.rideProgress;
export const selectIsStarting = (s: RideState) => s.isStarting;
export const selectIsExiting = (s: RideState) => s.isExiting;
