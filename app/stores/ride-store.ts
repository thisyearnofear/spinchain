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

/**
 * Debounced localStorage adapter. The ride clock (elapsedTime) is partialized
 * for pause/resume and ticks every second; zustand/persist otherwise performs a
 * synchronous JSON.stringify + localStorage.setItem on the main thread for every
 * setState. Coalesce writes to a short trailing-edge debounce, but flush on
 * pagehide and before any read so a pending write is never dropped (closing the
 * tab inside the debounce window) or read stale (read-your-writes).
 */
function createDebouncedStorage(delayMs = 400) {
  let pending: { name: string; value: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending === null) return;
    const { name, value } = pending;
    pending = null;
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  };

  // A trailing-edge debounce alone would drop the last ride-clock tick if the
  // tab is closed or background-killed inside the debounce window.
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
  }

  return {
    getItem: (name: string) => {
      flush();
      return window.localStorage.getItem(name);
    },
    setItem: (name: string, value: string) => {
      pending = { name, value };
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    removeItem: (name: string) => {
      flush();
      window.localStorage.removeItem(name);
    },
  };
}

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
      storage: createJSONStorage(() => createDebouncedStorage()),
      // isActive is deliberately not persisted: rehydrating an "active" ride
      // after a reload would show a live HUD with no running coordinator.
      // Persisted elapsedTime>0 rehydrates as the paused/resume state instead.
      partialize: (state) => ({
        session: state.session,
        elapsedTime: state.elapsedTime,
      }),
    },
  ),
);

export type RidePhase = "preRide" | "starting" | "active" | "paused";

export function getRidePhase(state: RideState): RidePhase {
  if (state.isStarting) return "starting";
  if (state.isActive) return "active";
  if (state.rideProgress > 0 || state.elapsedTime > 0) return "paused";
  return "preRide";
}

export const selectRidePhase = (s: RideState): RidePhase => getRidePhase(s);

export const selectIsActive = (s: RideState) => s.isActive;
export const selectIsPaused = (s: RideState) => s.isPaused;
export const selectElapsedTime = (s: RideState) => s.elapsedTime;
export const selectRideProgress = (s: RideState) => s.rideProgress;
export const selectIsStarting = (s: RideState) => s.isStarting;
export const selectIsExiting = (s: RideState) => s.isExiting;
