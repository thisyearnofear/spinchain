"use client";

import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import { Sparkles } from "lucide-react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { RideCompletion, type RewardClaimStatus } from "./ride-completion";
import { NoBikeModal } from "./no-bike-modal";
import { KeyboardShortcutOverlay } from "./keyboard-shortcut-overlay";
import { PedalSimulator } from "@/app/components/features/common/pedal-simulator";
import { DemoCompleteModal } from "@/app/components/features/common/demo-complete-modal";
import { RideTutorialOverlay } from "./ride-tutorial";
import { downloadTCX, type RideRecordPoint } from "@/app/lib/analytics/ride-recorder";
import type { EnhancedClassMetadata } from "@/app/lib/contracts";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useUIStore } from "@/app/stores/ui-store";
import { useRideModalStore } from "@/app/stores/ride-modal-store";

interface RideModalsProps {
  classId: string;
  classData: { name: string; instructor: string; startTime?: number; metadata?: EnhancedClassMetadata | null } | null;
  rewardsFormattedReward: string;
  handleClaimRewards: () => void;
  rewardClaimStatus?: RewardClaimStatus;
  agentName: string;
  aiPersonality: "zen" | "drill-sergeant" | "data";
  ridePointsRef: React.MutableRefObject<RideRecordPoint[]>;
  router: AppRouterInstance;
  onExitRide: () => void;
  onCompletionExit: () => void;
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

export const RideModals = memo(function RideModals({
  classId,
  classData,
  rewardsFormattedReward,
  handleClaimRewards,
  rewardClaimStatus,
  agentName,
  aiPersonality,
  ridePointsRef,
  router,
  onExitRide: _onExitRide,
  onCompletionExit,
  onEnableSimulatorFromModal,
  onDismissNoBike,
  onDismissKeyboardHints,
  onDemoModalClose,
  onNextTutorial,
  onDismissTutorial,
  onSimulatorMetrics,
}: RideModalsProps) {
  const isRiding = useRideStore((s) => s.isActive);
  const elapsedTime = useRideStore((s) => s.elapsedTime);

  const isPracticeMode = useUIStore((s) => s.isPracticeMode);
  const isTrainingMode = useUIStore((s) => s.isTrainingMode);
  const bleConnected = useUIStore((s) => s.bleConnected);
  const useSimulator = useUIStore((s) => s.useSimulator);

  const telemetryAverages = useTelemetryStore((s) => s.averages);

  const showMilestone = useRideModalStore((s) => s.showMilestone);
  const showNoBikeModal = useRideModalStore((s) => s.showNoBikeModal);
  const showKeyboardHints = useRideModalStore((s) => s.showKeyboardHints);
  const showDemoModal = useRideModalStore((s) => s.showDemoModal);
  const demoStats = useRideModalStore((s) => s.demoStats);
  const showTutorial = useRideModalStore((s) => s.showTutorial);
  const tutorialStep = useRideModalStore((s) => s.tutorialStep);
  const tutorialSteps = useRideModalStore((s) => s.tutorialSteps);
  const showCompletionScreen = useRideModalStore((s) => s.showCompletionScreen);
  const isExitingRide = useRideModalStore((s) => s.isExitingRide);
  const completionSyncStatus = useRideModalStore((s) => s.completionSyncStatus);
  const completionPrimaryAction = useRideModalStore((s) => s.completionPrimaryAction);
  const walrusAnchorInfo = useRideModalStore((s) => s.walrusAnchorInfo);

  return (
    <>
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

      {/* Exit loading overlay — shown while Walrus upload + Sui anchoring is in progress */}
      <AnimatePresence>
        {isExitingRide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[90] bg-black/80 backdrop-blur-sm pointer-events-auto"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              <div className="text-center">
                <p className="text-sm font-bold text-white tracking-tight">Saving your ride</p>
                <p className="text-xs text-white/50 mt-1">Uploading to Walrus & anchoring on Sui…</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showCompletionScreen && (
        <RideCompletion
          isPracticeMode={isPracticeMode}
          elapsedTime={elapsedTime}
          avgHeartRate={telemetryAverages.avgHr}
          avgPower={telemetryAverages.avgPower}
          avgEffort={telemetryAverages.avgEffort}
          telemetrySource={
            bleConnected ? "live-bike" : useSimulator ? "simulator" : "estimated"
          }
          onExit={onCompletionExit}
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
          walrusAnchorInfo={walrusAnchorInfo}
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

      <NoBikeModal
        open={showNoBikeModal}
        onEnableSimulator={onEnableSimulatorFromModal}
        onDismiss={onDismissNoBike}
      />

      <KeyboardShortcutOverlay
        show={showKeyboardHints}
        onDismiss={onDismissKeyboardHints}
      />

      {useSimulator && (
        <PedalSimulator
          isActive={isRiding}
          onMetricsUpdate={onSimulatorMetrics}
        />
      )}

      {showDemoModal && !showCompletionScreen && (
        <DemoCompleteModal
          isOpen={showDemoModal}
          onClose={onDemoModalClose}
          stats={demoStats}
        />
      )}

      {showTutorial && (
        <RideTutorialOverlay
          step={tutorialStep}
          steps={tutorialSteps}
          onNext={onNextTutorial}
          onDismiss={onDismissTutorial}
        />
      )}
    </>
  );
});
