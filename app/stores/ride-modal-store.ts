"use client";

import { create } from "zustand";
import type { RideSyncStatus } from "@/app/lib/analytics/ride-history";
import type { TutorialStepDef } from "@/app/components/features/ride/ride-tutorial";

interface DemoStats {
  duration: number;
  avgHeartRate: number;
  maxHeartRate: number;
  effortScore: number;
  spinEarned: string;
  rewardsWereActive: boolean;
}

interface MilestoneInfo {
  title: string;
  subtitle: string;
}

interface WalrusAnchorInfo {
  blobId: string;
  txDigest?: string;
}

interface RideModalState {
  showNoBikeModal: boolean;
  showKeyboardHints: boolean;
  showDemoModal: boolean;
  demoStats: DemoStats;
  showTutorial: boolean;
  tutorialStep: number;
  tutorialSteps: TutorialStepDef[];
  showMilestone: MilestoneInfo | null;
  completionSyncStatus: RideSyncStatus;
  completionPrimaryAction: "view_history" | "ride_again";
  walrusAnchorInfo: WalrusAnchorInfo | null;
  completedRideId: string | null;

  setShowNoBikeModal: (v: boolean) => void;
  setShowKeyboardHints: (v: boolean) => void;
  setShowDemoModal: (v: boolean) => void;
  setDemoStats: (stats: DemoStats) => void;
  setShowTutorial: (v: boolean) => void;
  setTutorialStep: (step: number) => void;
  setTutorialSteps: (steps: TutorialStepDef[]) => void;
  setShowMilestone: (m: MilestoneInfo | null) => void;
  setCompletionSyncStatus: (status: RideSyncStatus) => void;
  setCompletionPrimaryAction: (action: "view_history" | "ride_again") => void;
  setWalrusAnchorInfo: (info: WalrusAnchorInfo | null) => void;
  setCompletedRideId: (id: string | null) => void;
}

const initialDemoStats: DemoStats = {
  duration: 0,
  avgHeartRate: 0,
  maxHeartRate: 0,
  effortScore: 0,
  spinEarned: "0",
  rewardsWereActive: false,
};

export const useRideModalStore = create<RideModalState>((set) => ({
  showNoBikeModal: false,
  showKeyboardHints: false,
  showDemoModal: false,
  demoStats: initialDemoStats,
  showTutorial: false,
  tutorialStep: 0,
  tutorialSteps: [],
  showMilestone: null,
  completionSyncStatus: "local_only",
  completionPrimaryAction: "view_history",
  walrusAnchorInfo: null,
  completedRideId: null,

  setShowNoBikeModal: (v) => set({ showNoBikeModal: v }),
  setShowKeyboardHints: (v) => set({ showKeyboardHints: v }),
  setShowDemoModal: (v) => set({ showDemoModal: v }),
  setDemoStats: (stats) => set({ demoStats: stats }),
  setShowTutorial: (v) => set({ showTutorial: v }),
  setTutorialStep: (step) => set({ tutorialStep: step }),
  setTutorialSteps: (steps) => set({ tutorialSteps: steps }),
  setShowMilestone: (m) => set({ showMilestone: m }),
  setCompletionSyncStatus: (status) => set({ completionSyncStatus: status }),
  setCompletionPrimaryAction: (action) => set({ completionPrimaryAction: action }),
  setWalrusAnchorInfo: (info) => set({ walrusAnchorInfo: info }),
  setCompletedRideId: (id) => set({ completedRideId: id }),
}));
