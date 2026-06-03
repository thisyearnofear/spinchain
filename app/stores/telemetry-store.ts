/**
 * Telemetry Store — Real-time telemetry state for UI consumption.
 *
 * Written to by the coordinator's bridgeSnapshotToStore().
 * Components read via granular selectors to minimize re-renders.
 *
 * Design rules:
 * - Never write from React components; only the coordinator writes here.
 * - Selectors return scalars or stable references to avoid unnecessary re-renders.
 * - History arrays are capped (30 points) to bound memory.
 */

import { create } from "zustand";
import type { TelemetrySnapshot, TelemetryAverages, TelemetryHistory, MultiGhostState } from "@/app/engines/types";
import type { GhostState } from "@/app/lib/analytics/ghost-service";

const INITIAL_SNAPSHOT: TelemetrySnapshot = {
  heartRate: 0,
  power: 0,
  cadence: 0,
  speed: 0,
  effort: 0,
  wBal: 0,
  wBalPercentage: 100,
  currentGear: 10,
  gearRatio: 1.0,
  distance: 0,
  resistance: 0,
  timestamp: 0,
};

interface TelemetryState {
  snapshot: TelemetrySnapshot;
  history: TelemetryHistory;
  recentPower: number[];
  averages: TelemetryAverages;
  ghostState: GhostState;
  multiGhostState: MultiGhostState[];
  currentGear: number;
  ridePoints: { timestamp: number; heartRate: number; power: number; cadence: number; speed: number; distance: number; latitude?: number; longitude?: number; altitude?: number }[];
}

interface TelemetryActions {
  setSnapshot: (snapshot: TelemetrySnapshot) => void;
  setHistory: (history: TelemetryHistory) => void;
  setRecentPower: (power: number[]) => void;
  setAverages: (averages: TelemetryAverages) => void;
  setGhostState: (state: GhostState) => void;
  setMultiGhostState: (state: MultiGhostState[]) => void;
  setCurrentGear: (gear: number) => void;
  setRidePoints: (points: TelemetryState["ridePoints"]) => void;
  reset: () => void;
}

const initialState: TelemetryState = {
  snapshot: { ...INITIAL_SNAPSHOT },
  history: { power: [], cadence: [], heartRate: [] },
  recentPower: [],
  averages: { avgHr: 0, avgPower: 0, avgEffort: 0 },
  ghostState: { leadLagTime: 0, distanceGap: 0, ghostPoint: null },
  multiGhostState: [],
  currentGear: 10,
  ridePoints: [],
};

export const useTelemetryStore = create<TelemetryState & TelemetryActions>()((set) => ({
  ...initialState,

  setSnapshot: (snapshot) => set({ snapshot }),
  setHistory: (history) => set({ history }),
  setRecentPower: (power) => set({ recentPower: power }),
  setAverages: (averages) => set({ averages }),
  setGhostState: (state) => set({ ghostState: state }),
  setMultiGhostState: (state) => set({ multiGhostState: state }),
  setCurrentGear: (gear) => set({ currentGear: gear }),
  setRidePoints: (points) => set({ ridePoints: points }),

  reset: () => set(initialState),
}));

// ─── Granular Selectors ──────────────────────────────────────────

export const selectHeartRate = (s: TelemetryState) => s.snapshot.heartRate;
export const selectPower = (s: TelemetryState) => s.snapshot.power;
export const selectCadence = (s: TelemetryState) => s.snapshot.cadence;
export const selectSpeed = (s: TelemetryState) => s.snapshot.speed;
export const selectEffort = (s: TelemetryState) => s.snapshot.effort;
export const selectDistance = (s: TelemetryState) => s.snapshot.distance;
export const selectWBal = (s: TelemetryState) => s.snapshot.wBal;
export const selectWBalPercentage = (s: TelemetryState) => s.snapshot.wBalPercentage;
export const selectGearRatio = (s: TelemetryState) => s.snapshot.gearRatio;
export const selectCurrentGear = (s: TelemetryState) => s.currentGear;
export const selectTelemetrySnapshot = (s: TelemetryState) => s.snapshot;
export const selectTelemetryHistory = (s: TelemetryState) => s.history;
export const selectRecentPower = (s: TelemetryState) => s.recentPower;
export const selectTelemetryAverages = (s: TelemetryState) => s.averages;
export const selectGhostState = (s: TelemetryState) => s.ghostState;
export const selectMultiGhostState = (s: TelemetryState) => s.multiGhostState;
