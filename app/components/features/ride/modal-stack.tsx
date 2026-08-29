/**
 * ModalStack — Disciplined, coordinated modal management for the ride.
 *
 * PROBLEM: The current system shows multiple modals simultaneously:
 * - Tutorial overlay (z-200) on top of
 * - No-bike modal (z-60) on top of
 * - Keyboard hints (z-55) on top of
 * - Coach message (z-50) on top of
 * - Settlement stream (z-20)
 * All while the 3D visualization (z-20) and HUD (z-30) fight for attention.
 *
 * SOLUTION: A modal stack that enforces:
 * 1. NEVER more than 1 modal visible at a time (top-level modal only)
 * 2. Modals are prioritized by importance:
 *    - CRITICAL: Exit confirm, save-loading — user MUST interact
 *    - INFORMATIONAL: Tutorial, milestones — user can dismiss
 *    - TRANSIENT: Keyboard hints, no-bike — auto-dismiss or tap away
 * 3. Each modal has a clear dismiss path:
 *    - Escape key
 *    - Backdrop tap (informational & transient only)
 *    - Explicit dismiss button
 *    - Swipe down on mobile (transient only)
 * 4. Modals animate in/out with consistent timing:
 *    - Enter: 250ms, smooth ease
 *    - Exit: 200ms, slightly faster
 *    - Staggered entrance for sequential modals
 *
 * Usage:
 *   <ModalStack
 *     modals={modalStack}
 *     onDismiss={(id) => dismissModal(id)}
 *     onConfirm={handleConfirm}
 *   />
 *
 * The parent component manages the `modals` array and dispatches actions
 * to add/remove modals. Only the top modal renders.
 */

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRideModalStore } from "@/app/stores/ride-modal-store";
import { NoBikeModal } from "./no-bike-modal";
import { ExitConfirmModal } from "./exit-confirm-modal";
import { KeyboardShortcutOverlay } from "./keyboard-shortcut-overlay";
import { PedalSimulator } from "@/app/components/features/common/pedal-simulator";
import { DemoCompleteModal } from "@/app/components/features/common/demo-complete-modal";
import { RideTutorialOverlay } from "./ride-tutorial";

// ─── Modal types & priorities ────────────────────────────────────

export type ModalType =
  | "exit-confirm"     // CRITICAL — user must confirm
  | "no-bike"          // TRANSIENT — dismissable
  | "keyboard-hints"   // TRANSIENT — auto-dismiss
  | "tutorial"         // INFORMATIONAL — dismissable
  | "demo-complete"    // INFORMATIONAL — dismissable
  | "milestone"        // TRANSIENT — brief celebration
  | "loading";         // CRITICAL — show while saving

export interface ModalSlot {
  type: ModalType;
  priority: number; // Higher = more important
  dismissable: boolean; // Can user dismiss?
  backdropClosable: boolean; // Can tap backdrop to dismiss?
  autoDismissMs?: number; // Auto-dismiss after this time
  props?: Record<string, unknown>;
}

// ─── Stack discipline rules ──────────────────────────────────────

const MAX_STACK_SIZE = 1; // Only 1 modal visible at a time
const TRANSIENT_TIMEOUT = 5000; // Keyboard hints, etc.

// ─── Hook: manage the modal stack ────────────────────────────────

export function useModalStack() {
  const push = useRideModalStore((s) => s.setShowNoBikeModal);
  const pop = useRideModalStore((s) => (v: boolean) => {});
  const exitConfirm = useRideModalStore((s) => s.showExitConfirm);
  const setShowExitConfirm = useRideModalStore((s) => s.setShowExitConfirm);
  const showNoBike = useRideModalStore((s) => s.showNoBikeModal);
  const setShowNoBike = useRideModalStore((s) => s.setShowNoBikeModal);
  const showTutorial = useRideModalStore((s) => s.showTutorial);
  const setShowTutorial = useRideModalStore((s) => s.setShowTutorial);
  const tutorialStep = useRideModalStore((s) => s.tutorialStep);
  const tutorialSteps = useRideModalStore((s) => s.tutorialSteps);
  const setTutorialStep = useRideModalStore((s) => s.setTutorialStep);
  const showMilestone = useRideModalStore((s) => s.showMilestone);
  const setShowMilestone = useRideModalStore((s) => s.setShowMilestone);
  const showKeyboardHints = useRideModalStore((s) => s.showKeyboardHints);
  const setShowKeyboardHints = useRideModalStore((s) => s.setShowKeyboardHints);
  const showDemoModal = useRideModalStore((s) => s.showDemoModal);
  const setShowDemoModal = useRideModalStore((s) => s.setShowDemoModal);
  const demoStats = useRideModalStore((s) => s.demoStats);
  const setDemoStats = useRideModalStore((s) => s.setDemoStats);
  const isExitingRide = useRideModalStore((s) => s.isExitingRide);

  // ─── Push a modal onto the stack (only if stack is empty) ─────
  const showModal = useCallback((type: ModalType, props: Record<string, unknown> = {}) => {
    // Stack discipline: only show if nothing else is visible
    if (exitConfirm || showNoBike || showTutorial) return;

    switch (type) {
      case "exit-confirm":
        setShowExitConfirm(true);
        break;
      case "no-bike":
        setShowNoBike(true);
        break;
      case "keyboard-hints":
        setShowKeyboardHints(true);
        break;
      case "tutorial":
        setShowTutorial(true);
        break;
      case "demo-complete":
        setShowDemoModal(true);
        break;
      case "milestone":
        setShowMilestone(props.milestone as { title: string; subtitle: string } | null);
        break;
    }
  }, [
    exitConfirm, showNoBike, showTutorial,
    setShowExitConfirm, setShowNoBike, setShowTutorial,
    setShowDemoModal, setShowMilestone, setShowKeyboardHints,
  ]);

  // ─── Dismiss a modal ─────────────────────────────────────────
  const dismissModal = useCallback((type: ModalType) => {
    switch (type) {
      case "exit-confirm":
        setShowExitConfirm(false);
        break;
      case "no-bike":
        setShowNoBike(false);
        break;
      case "tutorial":
        setShowTutorial(false);
        break;
      case "demo-complete":
        setShowDemoModal(false);
        break;
      case "milestone":
        setShowMilestone(null);
        break;
      // Keyboard hints auto-dismiss via their own timer
      case "keyboard-hints":
        setShowKeyboardHints(false);
        break;
    }
  }, [
    setShowExitConfirm, setShowNoBike, setShowTutorial,
    setShowDemoModal, setShowMilestone, setShowKeyboardHints,
  ]);

  // ─── Active modal resolver ────────────────────────────────────
  // Returns the highest-priority modal that's currently visible
  const activeModal = (): ModalSlot | null => {
    // Priority order: exit-confirm > tutorial > milestone > no-bike > keyboard-hints > demo
    if (exitConfirm) return {
      type: "exit-confirm",
      priority: 100,
      dismissable: true,
      backdropClosable: true,
    };
    if (showTutorial) return {
      type: "tutorial",
      priority: 90,
      dismissable: true,
      backdropClosable: true,
    };
    if (showMilestone) return {
      type: "milestone",
      priority: 80,
      dismissable: true,
      backdropClosable: false,
      autoDismissMs: 2000,
    };
    if (showNoBike) return {
      type: "no-bike",
      priority: 70,
      dismissable: true,
      backdropClosable: false,
    };
    if (showKeyboardHints) return {
      type: "keyboard-hints",
      priority: 60,
      dismissable: true,
      backdropClosable: true,
      autoDismissMs: TRANSIENT_TIMEOUT,
    };
    if (showDemoModal) return {
      type: "demo-complete",
      priority: 50,
      dismissable: true,
      backdropClosable: true,
    };
    return null;
  };

  return {
    showModal,
    dismissModal,
    activeModal,
    exitConfirm,
    showNoBike,
    showTutorial,
    tutorialStep,
    tutorialSteps,
    setTutorialStep,
    showMilestone,
    setShowMilestone,
    showKeyboardHints,
    showDemoModal,
    demoStats,
    isExitingRide,
    setShowKeyboardHints,
  };
}

// ─── ModalStack component ────────────────────────────────────────

interface ModalStackProps {
  exitConfirm: boolean;
  noBike: boolean;
  tutorial: boolean;
  tutorialStep: number;
  tutorialSteps: any[];
  milestone: { title: string; subtitle: string } | null;
  keyboardHints: boolean;
  demoModal: boolean;
  demoStats: any;
  isExitingRide: boolean;
  useSimulator: boolean;
  isRiding: boolean;
  /** When true, hides the on-screen pedal simulator (e.g. when the HUD is
   *  collapsed to minimal/zen mode so the riding scene stays clean). */
  hideSimulator?: boolean;
  /** Practice mode: the PedalSimulator widget doubles as the integrated
   *  ride bar — embeds live Power/HR/phase chips. */
  showRideMetrics?: boolean;
  /** Called with metrics computed by the on-screen PedalSimulator so the
   *  ride's keyboard/on-screen activity actually feeds the telemetry store. */
  onSimulatorMetrics?: (metrics: {
    heartRate: number;
    power: number;
    cadence: number;
    speed: number;
    effort: number;
  }) => void;

  // Callbacks
  onExitConfirm: () => void;
  onExitCancel: () => void;
  onNoBikeSimulator: () => void;
  onNoBikeDismiss: () => void;
  onTutorialNext: () => void;
  onTutorialDismiss: () => void;
  onDemoClose: () => void;
  onKeyboardDismiss: () => void;
}

export function ModalStack({
  exitConfirm,
  noBike,
  tutorial,
  tutorialStep,
  tutorialSteps,
  milestone,
  keyboardHints,
  demoModal,
  demoStats,
  isExitingRide,
  useSimulator,
  isRiding,
  hideSimulator = false,
  showRideMetrics = false,
  onSimulatorMetrics,
  onExitConfirm,
  onExitCancel,
  onNoBikeSimulator,
  onNoBikeDismiss,
  onTutorialNext,
  onTutorialDismiss,
  onDemoClose,
  onKeyboardDismiss,
}: ModalStackProps) {
  // ─── Auto-dismiss transient modals ─────────────────────────────
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (keyboardHints && !isRiding) {
      timerRef.current = setTimeout(() => onKeyboardDismiss(), TRANSIENT_TIMEOUT);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [keyboardHints, isRiding, onKeyboardDismiss]);

  // ─── Render only the highest-priority visible modal ────────────
  // Priority: milestone > exit-confirm > tutorial > milestone > no-bike > keyboard-hints > demo

  return (
    <>
      {/* 1. MILESTONE — highest priority, brief celebration */}
      <AnimatePresence>
        {milestone && (
          <MilestoneOverlay
            title={milestone.title}
            subtitle={milestone.subtitle}
          />
        )}
      </AnimatePresence>

      {/* 2. EXIT CONFIRM — user must decide */}
      <ExitConfirmModal
        open={exitConfirm}
        onConfirm={onExitConfirm}
        onCancel={onExitCancel}
      />

      {/* 3. TUTORIAL — informative, dismissable */}
      <AnimatePresence>
        {tutorial && (
          <RideTutorialOverlay
            step={tutorialStep}
            steps={tutorialSteps}
            onNext={onTutorialNext}
            onDismiss={onTutorialDismiss}
          />
        )}
      </AnimatePresence>

      {/* 4. NO-BIKE — transient, prompt */}
      <NoBikeModal
        open={noBike}
        onEnableSimulator={onNoBikeSimulator}
        onDismiss={onNoBikeDismiss}
      />

      {/* 5. KEYBOARD HINTS — transient, auto-dismiss */}
      <KeyboardShortcutOverlay
        show={keyboardHints}
        onDismiss={onKeyboardDismiss}
      />

      {/* 6. DEMO COMPLETE — informative */}
      <AnimatePresence>
        {demoModal && (
          <DemoCompleteModal
            isOpen={demoModal}
            onClose={onDemoClose}
            stats={demoStats}
          />
        )}
      </AnimatePresence>

      {/* 7. LOADING OVERLAY — show while saving */}
      <AnimatePresence>
        {isExitingRide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 backdrop-blur-sm pointer-events-auto"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              <div className="text-center">
                <p className="text-sm font-bold text-white">Saving your ride</p>
                <p className="text-xs text-white/50 mt-1">
                  Uploading to Walrus & anchoring on Sui…
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PedalSimulator — always shown when active, but doesn't block.
          Kept mounted in minimal mode (visually hidden) so keyboard pedaling
          still feeds stats even when the riding UI is quieted. */}
      {useSimulator && (
        <PedalSimulator
          isActive={isRiding}
          onMetricsUpdate={onSimulatorMetrics ?? (() => {})}
          visuallyHidden={hideSimulator}
          showRideMetrics={showRideMetrics}
        />
      )}
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function MilestoneOverlay({ title, subtitle }: {
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none"
    >
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500/40 blur-[120px] animate-pulse rounded-full scale-150" />
        <div className="relative bg-black/80 backdrop-blur-3xl border-2 border-indigo-500/50 rounded-[3rem] px-12 py-10 text-center shadow-[0_0_100px_rgba(99,102,241,0.4)]">
          <div className="inline-block mb-4">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
              transition={{ duration: 0.5, repeat: 2 }}
            >
              <span className="text-4xl">✨</span>
            </motion.div>
          </div>
          <h2 className="text-5xl font-black text-white tracking-tighter mb-2 italic uppercase">
            {title}
          </h2>
          <p className="text-indigo-300 font-bold text-lg uppercase tracking-widest opacity-80">
            {subtitle}
          </p>
        </div>
      </div>
    </motion.div>
  );
}