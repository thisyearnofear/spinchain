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

export const useRewardsStore = create<RewardsState>()(() => ({
  ...initialState,
}));
