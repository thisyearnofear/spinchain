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
  completionSettlementStatus: "pending" | "confirmed" | "failed" | "skipped" | undefined;
  completionPrimaryAction: "view_history" | "ride_again";
  walrusAnchorInfo: WalrusAnchorInfo | null;
  completedRideId: string | null;
  isExitingRide: boolean;
  showCompletionScreen: boolean;
  showExitConfirm: boolean;

  setShowNoBikeModal: (v: boolean) => void;
  setShowKeyboardHints: (v: boolean) => void;
  setShowDemoModal: (v: boolean) => void;
  setDemoStats: (stats: DemoStats) => void;
  setShowTutorial: (v: boolean) => void;
  setTutorialStep: (step: number) => void;
  setTutorialSteps: (steps: TutorialStepDef[]) => void;
  setShowMilestone: (m: MilestoneInfo | null) => void;
  setCompletionSyncStatus: (status: RideSyncStatus) => void;
  setCompletionSettlementStatus: (status: "pending" | "confirmed" | "failed" | "skipped" | undefined) => void;
  setCompletionPrimaryAction: (action: "view_history" | "ride_again") => void;
  setWalrusAnchorInfo: (info: WalrusAnchorInfo | null) => void;
  setCompletedRideId: (id: string | null) => void;
  setIsExitingRide: (v: boolean) => void;
  setShowCompletionScreen: (v: boolean) => void;
  setShowExitConfirm: (v: boolean) => void;
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
  completionSettlementStatus: undefined,
  completionPrimaryAction: "view_history",
  walrusAnchorInfo: null,
  completedRideId: null,
  isExitingRide: false,
  showCompletionScreen: false,
  showExitConfirm: false,

  setShowNoBikeModal: (v) => set({ showNoBikeModal: v }),
  setShowKeyboardHints: (v) => set({ showKeyboardHints: v }),
  setShowDemoModal: (v) => set({ showDemoModal: v }),
  setDemoStats: (stats) => set({ demoStats: stats }),
  setShowTutorial: (v) => set({ showTutorial: v }),
  setTutorialStep: (step) => set({ tutorialStep: step }),
  setTutorialSteps: (steps) => set({ tutorialSteps: steps }),
  setShowMilestone: (m) => set({ showMilestone: m }),
  setCompletionSyncStatus: (status) => set({ completionSyncStatus: status }),
  setCompletionSettlementStatus: (status) => set({ completionSettlementStatus: status }),
  setCompletionPrimaryAction: (action) => set({ completionPrimaryAction: action }),
  setWalrusAnchorInfo: (info) => set({ walrusAnchorInfo: info }),
  setCompletedRideId: (id) => set({ completedRideId: id }),
  setIsExitingRide: (v) => set({ isExitingRide: v }),
  setShowCompletionScreen: (v) => set({ showCompletionScreen: v }),
  setShowExitConfirm: (v) => set({ showExitConfirm: v }),
}));
