"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { RideCompletion, type RewardClaimStatus } from "./ride-completion";
import { NoBikeModal } from "./no-bike-modal";
import { KeyboardShortcutOverlay } from "./keyboard-shortcut-overlay";
import { PedalSimulator } from "@/app/components/features/common/pedal-simulator";
import { DemoCompleteModal } from "@/app/components/features/common/demo-complete-modal";
import { RideTutorialOverlay, type TutorialStep } from "./ride-tutorial";
import { downloadTCX, type RideRecordPoint } from "@/app/lib/analytics/ride-recorder";
import type { RideSyncStatus } from "@/app/lib/analytics/ride-history";
import type { RewardMode } from "@/app/hooks/rewards/use-rewards";
import type { DemoCompleteModalProps } from "@/app/components/features/common/demo-complete-modal";
import type { EnhancedClassMetadata } from "@/app/lib/contracts";

interface RideModalsProps {
  rideProgress: number;
  isPracticeMode: boolean;
  isTrainingMode: boolean;
  isRiding: boolean;
  elapsedTime: number;
  telemetryAverages: { avgHr: number; avgPower: number; avgEffort: number };
  bleConnected: boolean;
  useSimulator: boolean;
  classId: string;
  classData: { name: string; instructor: string; startTime?: number; metadata?: EnhancedClassMetadata | null } | null;
  practiceConfig: { name?: string; instructor?: string } | null;
  rewardsFormattedReward: string;
  handleClaimRewards: () => void;
  rewardClaimStatus?: RewardClaimStatus;
  completionSyncStatus: RideSyncStatus;
  completionPrimaryAction: "view_history" | "ride_again";
  showMilestone: { title: string; subtitle: string } | null;
  showNoBikeModal: boolean;
  showKeyboardHints: boolean;
  showDemoModal: boolean;
  demoStats: DemoCompleteModalProps["stats"];
  showTutorial: boolean;
  tutorialStep: TutorialStep;
  agentName: string;
  aiPersonality: "zen" | "drill-sergeant" | "data";
  _rewardMode: RewardMode;
  _walletConnected: boolean;
  ridePointsRef: React.MutableRefObject<RideRecordPoint[]>;
  router: AppRouterInstance;
  onExitRide: () => void;
  onEnableSimulatorFromModal: () => void;
  onDismissNoBike: () => void;
  onDismissKeyboardHints: () => void;
  onDemoModalClose: () => void;
  onNextTutorial: () => void;
  onDismissTutorial: () => void;
  onSimulatorMetrics: (m: {
    heartRate: number;
    power: number;
    cadence: number;
    speed: number;
    effort: number;
    distance?: number;
    timestamp?: number;
  }) => void;
}

export function RideModals({
  rideProgress,
  isPracticeMode,
  isTrainingMode,
  isRiding,
  elapsedTime,
  telemetryAverages,
  bleConnected,
  useSimulator,
  classId,
  classData,
  practiceConfig: _practiceConfig,
  rewardsFormattedReward,
  handleClaimRewards,
  rewardClaimStatus,
  completionSyncStatus,
  completionPrimaryAction,
  showMilestone,
  showNoBikeModal,
  showKeyboardHints,
  showDemoModal,
  demoStats,
  showTutorial,
  tutorialStep,
  agentName,
  aiPersonality,
  _rewardMode,
  _walletConnected,
  ridePointsRef,
  router,
  onExitRide,
  onEnableSimulatorFromModal,
  onDismissNoBike,
  onDismissKeyboardHints,
  onDemoModalClose,
  onNextTutorial,
  onDismissTutorial,
  onSimulatorMetrics,
}: RideModalsProps) {
  return (
    <>
      {/* Milestone Celebration Overlay */}
      <AnimatePresence>
        {showMilestone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.5, filter: "blur(20px)" }}
            className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/40 blur-[120px] animate-pulse rounded-full scale-150" />
              <div className="relative bg-black/80 backdrop-blur-3xl border-2 border-indigo-500/50 rounded-[3rem] px-12 py-10 text-center shadow-[0_0_100px_rgba(99,102,241,0.4)]">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{ duration: 0.5, repeat: 2 }}
                  className="inline-block mb-4"
                >
                  <Sparkles className="w-16 h-16 text-indigo-400" />
                </motion.div>
                <h2 className="text-5xl font-black text-white tracking-tighter mb-2 italic uppercase">
                  {showMilestone.title}
                </h2>
                <p className="text-indigo-300 font-bold text-lg uppercase tracking-widest opacity-80">
                  {showMilestone.subtitle}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion Modal */}
      {rideProgress >= 100 && (
        <RideCompletion
          isPracticeMode={isPracticeMode}
          elapsedTime={elapsedTime}
          avgHeartRate={telemetryAverages.avgHr}
          avgPower={telemetryAverages.avgPower}
          avgEffort={telemetryAverages.avgEffort}
          telemetrySource={
            bleConnected ? "live-bike" : useSimulator ? "simulator" : "estimated"
          }
          onExit={onExitRide}
          onRideAgain={() => router.push(`/rider/ride/${classId}`)}
          onShare={() => {
            if (typeof window === "undefined") return;
            const spinText = isTrainingMode ? "Training Mode" : `${rewardsFormattedReward} SPIN`;
            const text = `Just finished ${classData?.name || "a SpinChain ride"} — ${telemetryAverages.avgEffort}/1000 effort, ${spinText}.`;
            if (navigator.share) {
              navigator.share({ title: "SpinChain Ride Complete", text, url: window.location.origin + "/rider/journey" }).catch(() => {});
              return;
            }
            navigator.clipboard.writeText(text).catch(() => {});
          }}
          onDeploy={isPracticeMode ? () => router.push("/instructor/builder") : undefined}
          onUpgrade={
            !isPracticeMode && !isTrainingMode
              ? () => router.push("/rider/journey?upgrade=analytics")
              : undefined
          }
          onClaimRewards={!isPracticeMode && !isTrainingMode ? handleClaimRewards : undefined}
          rewardClaimStatus={rewardClaimStatus}
          spinEarned={isTrainingMode ? "0" : rewardsFormattedReward}
          agentName={agentName}
          agentPersonality={aiPersonality || "data"}
          syncStatus={completionSyncStatus}
          primaryAction={completionPrimaryAction}
          onExportTCX={() => {
            downloadTCX(
              {
                id: classId,
                name: classData?.name || "SpinChain Ride",
                startTime: classData?.startTime ? classData.startTime * 1000 : Date.now(),
                instructor: classData?.instructor,
              },
              ridePointsRef.current,
            );
          }}
        />
      )}

      {/* No Bike Connected Modal */}
      <NoBikeModal
        open={showNoBikeModal}
        onEnableSimulator={onEnableSimulatorFromModal}
        onDismiss={onDismissNoBike}
      />

      {/* Keyboard Shortcut Overlay */}
      <KeyboardShortcutOverlay
        show={showKeyboardHints}
        onDismiss={onDismissKeyboardHints}
      />

      {/* Pedal Simulator */}
      {useSimulator && (
        <PedalSimulator
          isActive={isRiding}
          onMetricsUpdate={onSimulatorMetrics}
        />
      )}

      {/* Demo Complete Modal */}
      <DemoCompleteModal
        isOpen={showDemoModal}
        onClose={onDemoModalClose}
        stats={demoStats}
      />

      {/* Onboarding Tutorial Overlay */}
      {showTutorial && (
        <RideTutorialOverlay
          step={tutorialStep}
          onNext={onNextTutorial}
          onDismiss={onDismissTutorial}
        />
      )}
    </>
  );
}
