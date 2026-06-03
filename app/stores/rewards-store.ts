/**
 * Rewards Store — Reward accrual state for UI consumption.
 *
 * Written to by the coordinator (rewards engine ticks, mode changes).
 * Components read via granular selectors.
 */

import { create } from "zustand";
import type { RewardMode } from "@/app/engines/types";
import type { RewardStreamState } from "@/app/lib/rewards";

interface RewardsState {
  mode: RewardMode;
  isActive: boolean;
  formattedReward: string;
  accumulatedReward: bigint;
  streamState: RewardStreamState | null;
  clearNodeConnected: boolean;
  simulatedReward: string;
  isSimulating: boolean;
  streamingRate: number;
}

interface RewardsActions {
  setMode: (mode: RewardMode) => void;
  setIsActive: (active: boolean) => void;
  setFormattedReward: (formatted: string) => void;
  setAccumulatedReward: (amount: bigint) => void;
  setStreamState: (state: RewardStreamState | null) => void;
  setClearNodeConnected: (connected: boolean) => void;
  setSimulatedReward: (reward: string) => void;
  setIsSimulating: (simulating: boolean) => void;
  setStreamingRate: (rate: number) => void;
  reset: () => void;
}

const initialState: RewardsState = {
  mode: "zk-batch",
  isActive: false,
  formattedReward: "0",
  accumulatedReward: BigInt(0),
  streamState: null,
  clearNodeConnected: false,
  simulatedReward: "0",
  isSimulating: false,
  streamingRate: 0,
};

export const useRewardsStore = create<RewardsState & RewardsActions>()((set) => ({
  ...initialState,

  setMode: (mode) => set({ mode }),
  setIsActive: (active) => set({ isActive: active }),
  setFormattedReward: (formatted) => set({ formattedReward: formatted }),
  setAccumulatedReward: (amount) => set({ accumulatedReward: amount }),
  setStreamState: (state) => set({ streamState: state }),
  setClearNodeConnected: (connected) => set({ clearNodeConnected: connected }),
  setSimulatedReward: (reward) => set({ simulatedReward: reward }),
  setIsSimulating: (simulating) => set({ isSimulating: simulating }),
  setStreamingRate: (rate) => set({ streamingRate: rate }),

  reset: () => set(initialState),
}));

// ─── Granular Selectors ──────────────────────────────────────────

export const selectRewardMode = (s: RewardsState) => s.mode;
export const selectRewardsActive = (s: RewardsState) => s.isActive;
export const selectFormattedReward = (s: RewardsState) => s.formattedReward;
export const selectStreamState = (s: RewardsState) => s.streamState;
export const selectClearNodeConnected = (s: RewardsState) => s.clearNodeConnected;
export const selectSimulatedReward = (s: RewardsState) => s.simulatedReward;
export const selectIsSimulating = (s: RewardsState) => s.isSimulating;
