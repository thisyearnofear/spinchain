"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useClass } from "../../../hooks/evm/use-class-data";
import { usePracticeConfig } from "../../../hooks/ride/use-practice-config";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useUIStore } from "@/app/stores/ui-store";
import { useRideModalStore } from "@/app/stores/ride-modal-store";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { usePanelState } from "../../../hooks/ui/use-panel-state";
import { useRideTutorial } from "../../../components/features/ride/ride-tutorial";
import { RideLoading, RideNotFound } from "../../../components/features/ride/ride-loading";
import { RideVisualization } from "../../../components/features/ride/ride-visualization";
import { useSwipeGesture } from "@/app/hooks/ride/use-swipe-gesture";
import {
  useDeviceType,
  useOrientation,
  useActualViewportHeight,
  usePerformanceTier,
} from "../../../lib/responsive";
import { CoachChannel } from "../../../components/features/ride/coach-channel";
import { RideHUDOverlayV2 } from "../../../components/features/ride/ride-hud-overlay-v2";
import { probeGpu } from "@/app/lib/gpu-probe";
import {
  RideTransitionOverlay,
  routeThumbnailForTheme,
} from "../../../components/features/ride/ride-transition-overlay";
import { RideCompletionV2 } from "../../../components/features/ride/ride-completion-v2";
import { ModalStack } from "../../../components/features/ride/modal-stack";
import { RideStartScreen } from "../../../components/features/ride/ride-start-screen";
import { RideHudControls } from "../../../components/features/ride/ride-hud-controls";
import type { RewardMode } from "../../../hooks/rewards/use-rewards";
import { useWakeLock } from "../../../hooks/use-wake-lock";
import { useRideCoordinator } from "@/app/engines/use-ride-coordinator";
import { useHaptic } from "../../../hooks/use-haptic";
import {
  type WorkoutPlan,
  PHASE_TO_THEME,
  PRESET_WORKOUTS,
} from "../../../lib/workout-plan";
import { SectionErrorBoundary } from "../../../components/layout/error-boundary";
import { useRideKeyboard } from "@/app/hooks/ride/use-ride-keyboard";
import { useRideAnalytics } from "@/app/hooks/ride/use-ride-analytics";
import { useBleData } from "@/app/hooks/ble/use-ble-data";
import type { FitnessMetrics } from "@/app/lib/ble/types";
import { useToast } from "@/app/components/ui/toast";
import { useRideRewards } from "@/app/hooks/ride/use-ride-rewards";
import { useRideSimulator } from "@/app/hooks/ride/use-ride-simulator";
import { useRideLifecycle } from "@/app/hooks/ride/use-ride-lifecycle";
import { useRideMilestones } from "@/app/hooks/ride/use-ride-milestones";
import { useRideMusicFlow } from "@/app/hooks/ride/use-ride-music-flow";
import { usePrPursuit } from "@/app/hooks/ride/use-pr-pursuit";
import { RideAiTelemetryBridge } from "@/app/components/features/ride/ride-ai-telemetry-bridge";

export default function LiveRidePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = params.classId as string;
  const { openConnectModal } = useConnectModal();

  // ─── Reduced motion preference ─────────────────────────────────
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // ─── Data Loading ──────────────────────────────────────────────
  const { isPracticeMode, practiceConfig, practiceClassData } = usePracticeConfig(classId);
  const { classData: fetchedClassData, isLoading } = useClass(classId as `0x${string}`);
  const classData = isPracticeMode ? practiceClassData : fetchedClassData;
  const [loadStartedAt] = useState(() => Date.now());
  const classDataRef = useRef(classData);
  useEffect(() => { classDataRef.current = classData; }, [classData]);

  // ─── Device / Viewport ─────────────────────────────────────────
  const deviceType = useDeviceType();
  const orientation = useOrientation();
  const viewportHeight = useActualViewportHeight();
  const performanceTier = usePerformanceTier();

  // ─── Store Reads ───────────────────────────────────────────────
  const isRiding = useRideStore((s) => s.isActive);
  const isStarting = useRideStore((s) => s.isStarting);
  const isPaused = useRideStore((s) => s.isPaused);
  const rideProgress = useRideStore((s) => s.rideProgress);
  const elapsedTime = useRideStore((s) => s.elapsedTime);

  // NOTE: the page deliberately does NOT subscribe to live snapshot values
  // (heartRate/effort/history) — those change on every telemetry commit and
  // would re-render the whole page at up to 10Hz. Consumers that need them
  // read on demand via useTelemetryStore.getState() (see hooks below).
  const telemetryAverages = useTelemetryStore((s) => s.averages);

  const currentInterval = useCoachingStore((s) => s.currentInterval);

  // Modal state consumed by hooks further down; hoisted to keep hooks in order.
  const completedRideId = useRideModalStore((s) => s.completedRideId);
  const showCompletionScreen = useRideModalStore((s) => s.showCompletionScreen);

  // ─── Ride Coordinator ──────────────────────────────────────────
  const coordinator = useRideCoordinator();
  const coordinatorRef = useRef(coordinator);
  useEffect(() => {
    coordinatorRef.current = coordinator;
  }, [coordinator]);

  // ─── Panel State ───────────────────────────────────────────────
  const panelState = usePanelState(deviceType);
  const viewMode = useUIStore((s) => s.viewMode);
  const toggleViewMode = useUIStore((s) => s.toggleViewMode);
  const haptic = useHaptic();
  const gpuProbe = useMemo(() => {
    if (typeof window === "undefined") return null;
    try { return probeGpu(); } catch { return null; }
  }, []);
  const canRender3d = gpuProbe ? gpuProbe.recommendedMode === "tron-3d" : true;
  const effectiveIsFocus = viewMode === "focus";
  const handleToggleViewMode = useCallback(() => {
    // Allow override on low-end — VisualizationEngine will auto-degrade back
    // to Focus if FPS stays <25 for 15s, so trying 3D is safe.
    haptic.trigger(canRender3d ? "light" : "warning");
    toggleViewMode();
  }, [canRender3d, haptic, toggleViewMode]);
  const hudMode = useUIStore((s) => s.hudMode);
  const setHudMode = useUIStore((s) => s.setHudMode);
  const toggleQuietHud = useCallback(
    () => setHudMode(hudMode === "minimal" ? "full" : "minimal"),
    [setHudMode, hudMode],
  );

  // Auto-degrade to Focus when VisualizationEngine detects sustained low FPS.
  useEffect(() => {
    const bus = (coordinator as unknown as { bus?: { on: (e: string, h: (d: unknown) => void) => () => void } })?.bus;
    if (!bus) return;
    const unsub = bus.on("visualization:degraded", () => {
      if (useUIStore.getState().viewMode === "immersive") {
        useUIStore.getState().setViewMode("focus");
      }
    });
    return unsub;
  }, [coordinator]);

  // Feed VisualizationEngine FPS sampler so degraded detection actually works.
  // RouteVisualizer is frameloop="demand", so we drive onFrame from a lightweight rAF here.
  useEffect(() => {
    if (!isRiding || effectiveIsFocus) return;
    const viz = (coordinator as unknown as { visualization?: { onFrame: () => void } })?.visualization;
    if (!viz?.onFrame) return;
    let raf = 0;
    const loop = () => {
      viz.onFrame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isRiding, effectiveIsFocus, coordinator]);

  useEffect(() => {
    if (isRiding) panelState.startRideLayout();
    else panelState.endRideLayout();
  }, [isRiding, panelState]);

  const handleTogglePanel = useCallback(
    (key: Parameters<typeof panelState.toggle>[0]) => {
      if (deviceType === "mobile") {
        const isExpanded = panelState.state[key] === "expanded";
        if (isExpanded) panelState.collapse(key);
        else panelState.expandOne(key);
      } else {
        panelState.toggle(key);
      }
    },
    [deviceType, panelState],
  );

  const handleSnapPanel = useCallback(
    (key: Parameters<typeof panelState.snapPanelToEdge>[0]) => {
      panelState.snapPanelToEdge(key, { width: window.innerWidth, height: window.innerHeight });
    },
    [panelState],
  );

  const handleTrackWidgetInteraction = useCallback(() => {}, []);

  // ─── BLE / Simulator State ─────────────────────────────────────
  // The page owns the BLE metrics stream for the whole ride — DeviceSelector
  // only lives in the pre-ride panel, so it can't be the one forwarding
  // metrics or connection status once the ride starts.
  const trackLiveTelemetryRef = useRef<() => void>(() => {});
  const handleBleMetrics = useCallback((metrics: FitnessMetrics) => {
    coordinator.ingestBleMetrics(metrics);
    if (metrics.heartRate || metrics.power) trackLiveTelemetryRef.current();
  }, [coordinator]);
  const { isConnected: bleConnected } = useBleData({ onSuccess: handleBleMetrics, silent: true });
  const [useSimulator, setUseSimulator] = useState(() => {
    if (typeof window === "undefined") return false;
    const urlParams = new URLSearchParams(window.location.search);
    return isPracticeMode || urlParams.get("demo") === "true" || urlParams.get("sim") === "true";
  });

  useEffect(() => {
    useUIStore.setState({ deviceType, orientation, bleConnected, useSimulator, isPracticeMode });
  }, [deviceType, orientation, bleConnected, useSimulator, isPracticeMode]);

  useEffect(() => {
    useUIStore.setState({ widgetsMode: panelState.state.mobileRideWidgets });
  }, [panelState.state.mobileRideWidgets]);

  // ─── Workout Plan ──────────────────────────────────────────────
  const [workoutPlan] = useState<WorkoutPlan | null>(() => PRESET_WORKOUTS[1]);
  const agentName = classData?.instructor || "Coach";
  const aiPersonality = classData?.metadata?.ai?.personality;
  const [rewardMode] = useState<RewardMode>("zk-batch");

  // ─── Route Derived Data ────────────────────────────────────────
  const routeCoordinates = useMemo(
    () => classData?.route?.route.coordinates ?? [],
    [classData?.route?.route.coordinates],
  );
  const routeElevationProfile = useMemo(
    () => routeCoordinates.map((c) => c.ele || 0),
    [routeCoordinates],
  );
  const routeProgress = isRiding || rideProgress > 0 ? rideProgress / 100 : 0;
  const currentRouteCoordinate = useMemo(() => {
    if (routeCoordinates.length === 0) return null;
    const index = Math.min(
      routeCoordinates.length - 1,
      Math.max(0, Math.round(routeProgress * Math.max(0, routeCoordinates.length - 1))),
    );
    return routeCoordinates[index] ?? null;
  }, [routeCoordinates, routeProgress]);
  const routeTheme = currentInterval
    ? PHASE_TO_THEME[currentInterval.phase]
    : (classData?.metadata?.route.theme as "neon" | "alpine" | "mars" | "anime" | "rainbow") || "neon";

  // ─── Wallet / Guest / Training Mode ────────────────────────────
  const { isConnected: walletConnected, address } = useAccount();
  const isGuestMode = typeof window !== "undefined" && localStorage.getItem("spin-guest-mode") === "true" && !walletConnected;
  const isTrainingMode = useSimulator && !isPracticeMode && walletConnected;

  useEffect(() => {
    useUIStore.setState({ isGuestMode, isTrainingMode });
  }, [isGuestMode, isTrainingMode]);

  // ─── Mobile Hooks ──────────────────────────────────────────────
  const { request: requestWakeLock, release: releaseWakeLock, isActive: wakeLockActive } = useWakeLock();

  useEffect(() => {
    if (isRiding && deviceType === "mobile") requestWakeLock();
    else if (!isRiding && wakeLockActive) releaseWakeLock();
  }, [isRiding, deviceType, requestWakeLock, releaseWakeLock, wakeLockActive]);

  // ─── Audio (via coordinator) ───────────────────────────────────
  const playSound = useCallback((type: unknown) => coordinatorRef.current.playSound?.(type as never)?.catch?.(() => {}), []);
  const stopAudio = useCallback(() => coordinatorRef.current.stopAudio?.(), []);
  const speak = useCallback((text: string, emotion?: unknown) => coordinatorRef.current.speak?.(text, emotion as never)?.catch?.(() => {}), []);
  // Stable identity so ModalStack can be memoized and doesn't re-render per page render.
  const handleSimulatorMetrics = useCallback(
    (m: { heartRate: number; power: number; cadence: number; speed: number; effort: number }) =>
      coordinatorRef.current?.ingestSimulatorMetrics({ ...m, distance: 0, timestamp: Date.now() }),
    [],
  );

  // ─── Extracted Hooks ───────────────────────────────────────────
  const rewardsHook = useRideRewards({
    rewardMode,
    classId,
    classData,
    isPracticeMode,
    isTrainingMode,
    address,
    elapsedTime,
    telemetryAverages,
  });

  const simulatorHook = useRideSimulator({
    isRiding,
    isTrainingMode,
    isGuestMode,
    isPracticeMode,
  });

  const analyticsHook = useRideAnalytics({
    classId,
    isPracticeMode,
    isRiding,
    rideProgress,
    bleConnected,
    useSimulator,
    playSound,
  });

  useEffect(() => {
    trackLiveTelemetryRef.current = analyticsHook.trackLiveTelemetry;
  }, [analyticsHook.trackLiveTelemetry]);

  useRideKeyboard({
    isRiding,
    panelState,
    coordinator,
    playSound,
  });

  // Demo/practice mode: keyboard → cadence/power → reactive world is handled by
  // the PedalSimulator (wired to coordinator.ingestSimulatorMetrics via ModalStack).
  // It is the single keyboard→stats source (use-demo-effort was an unused W/S orphan).

  const lifecycle = useRideLifecycle({
    classId,
    classData,
    practiceConfig,
    isPracticeMode,
    isTrainingMode,
    bleConnected,
    useSimulator,
    walletConnected,
    address,
    rewardMode,
    agentName,
    workoutPlan,
    deviceType,
    performanceTier,
    elapsedTime,
    rewardClaimStatus: rewardsHook.rewardClaimStatus,
    useChainlinkRewards: rewardsHook.useChainlinkRewards,
    chainlinkSuccess: rewardsHook.chainlinkSuccess,
    zkSuccess: rewardsHook.zkSuccess,
    privacyScore: rewardsHook.privacyScore,
    privacyLevel: rewardsHook.privacyLevel,
    rewards: rewardsHook.rewards,
    coordinator,
    coordinatorRef,
    isRidingRef: simulatorHook.isRidingRef,
    trackedCompletionRef: analyticsHook.trackedCompletionRef,
    playSound,
    stopAudio,
    speak,
    setUseSimulator,
  });

  // Snapshot completion-time stats once, when the overlay opens. Previously these
  // were read via useTelemetryStore.getState() during render — correct only while
  // the page re-rendered every commit; they go stale once renders are event-driven.
  const [completionStats, setCompletionStats] = useState<{ avgHr: number; avgPower: number; avgEffort: number } | null>(null);
  useEffect(() => {
    if (showCompletionScreen && !completionStats) {
      const { averages } = useTelemetryStore.getState();
      setCompletionStats({ avgHr: averages.avgHr, avgPower: averages.avgPower, avgEffort: averages.avgEffort });
    } else if (!showCompletionScreen) {
      setCompletionStats(null);
    }
  }, [showCompletionScreen, completionStats]);

  // PR pursuit callouts during ride
  usePrPursuit(isRiding);

  // Flow engine, music, haptics, and sensory sync in one isolated hook so the
  // page doesn't own the telemetry→flow subscription or music transitions.
  const flow = useRideMusicFlow({ isRiding, currentInterval });

  // Peak telemetry tracking + milestone recording + real-time milestone popups.
  const milestones = useRideMilestones({
    isRiding,
    elapsedTime,
    showCompletionScreen,
    telemetryAverages,
    flow,
    reducedMotion,
  });
  useEffect(() => {
    if (completedRideId) {
      rewardsHook.setCompletedRideId(completedRideId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedRideId, rewardsHook.setCompletedRideId]);

  // ─── Auto-complete at 100% ─────────────────────────────────────
  // Nothing else ends a ride when the route finishes: at real-time speed a
  // rider exits manually, but the compressed practice clock hits 100% in
  // ~45 seconds — without this, the track marker pins at the finish and the
  // ride appears frozen. Persist + show completion instead.
  useEffect(() => {
    if (isRiding && rideProgress >= 100) {
      lifecycle.exitRide();
    }
  }, [isRiding, rideProgress, lifecycle]);

  // ─── BLE Disconnect Auto-Pause ─────────────────────────────────
  // Losing the bike mid-ride should pause, not keep the ride "running" on
  // dead telemetry. The native BLE service auto-reconnects; the rider
  // resumes from the paused screen once it's back.
  const toast = useToast();
  const prevBleConnectedRef = useRef(bleConnected);
  useEffect(() => {
    const wasConnected = prevBleConnectedRef.current;
    prevBleConnectedRef.current = bleConnected;
    if (wasConnected && !bleConnected && !useSimulator && useRideStore.getState().isActive) {
      lifecycle.pauseRide();
      toast.warning("Ride paused", "Your bike disconnected — attempting to reconnect. Resume when it's back.");
    }
  }, [bleConnected, useSimulator, lifecycle, toast]);

  // ─── Visibility Pause (save CPU when tab hidden) ──────────────
  // Go through the real pause flow so the coordinator halts and the rider
  // comes back to the paused screen with a Resume button — not a dead ride.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleVisibility = () => {
      if (document.hidden && useRideStore.getState().isActive) {
        lifecycle.pauseRide();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [lifecycle]);

  // ─── Activation sequence state ──────────────────────────────────
  const [showActivation, setShowActivation] = useState(false);
  const [activationComplete, setActivationComplete] = useState(false);
  const didAutoStartRef = useRef(false);

  // Practice/demo: one countdown → pedal. Bypass the Start screen (or honor ?auto=true).
  const wantsAutoStart =
    isPracticeMode || searchParams.get("auto") === "true";

  useEffect(() => {
    if (didAutoStartRef.current) return;
    if (!classData) return;
    if (!wantsAutoStart) return;
    if (isRiding || isStarting || isPaused || showCompletionScreen || showActivation || activationComplete) {
      return;
    }
    didAutoStartRef.current = true;
    setShowActivation(true);
  }, [
    classData,
    wantsAutoStart,
    isRiding,
    isStarting,
    isPaused,
    showCompletionScreen,
    showActivation,
    activationComplete,
  ]);

  // Countdown haptic + SFX live inside ActivationTransition (tick-aligned).
  // Do NOT call playCountdown(3) here — that used a 1s ElevenLabs loop that
  // fought the 700ms visual ticks and risked duplicate ceremony audio.

  // The page re-renders continuously (useFlowState ticks every 100ms,
  // sensory-sync, etc.), and `lifecycle` is a fresh object each render. If the
  // activation callbacks depend on it, `RideTransitionOverlay`'s countdown
  // effect re-subscribes on every render and the interval never fires — the
  // countdown gets stuck on "3" (and the Skip button never appears). Keep a
  // ref to the latest lifecycle so these callbacks are referentially stable.
  const lifecycleRef = useRef(lifecycle);
  useEffect(() => {
    lifecycleRef.current = lifecycle;
  });

  const handleActivationComplete = useCallback(() => {
    setActivationComplete(true);
    lifecycleRef.current.startRide();
    // Keep ActivationTransition mounted briefly so the GO flash can finish.
    window.setTimeout(() => setShowActivation(false), 700);
  }, []);

  const handleActivationSkip = useCallback(() => {
    setShowActivation(false);
    setActivationComplete(true);
    lifecycleRef.current.startRide();
  }, []);

  // "Ride Again" must actually ride again: close the completion screen,
  // reset the ride clock + telemetry + celebration refs so startRide treats
  // it as a fresh ride (not a resume), and replay the activation ceremony.
  // The ceremony's complete handler calls lifecycle.startRide(), which
  // disposes the old coordinator and starts a fresh one.
  const handleRideAgain = useCallback(() => {
    const modals = useRideModalStore.getState();
    modals.setShowCompletionScreen(false);
    modals.setWalrusAnchorInfo(null);
    modals.setShowMilestone(null);
    useRideStore.setState({ rideProgress: 0, elapsedTime: 0, isActive: false, isPaused: false, isStarting: false });
    useTelemetryStore.getState().reset();
    milestones.reset();
    analyticsHook.trackedCompletionRef.current = false;
    setActivationComplete(false);
    setShowActivation(true);
  }, [analyticsHook, milestones]);

  // ─── Tutorial ──────────────────────────────────────────────────
  const { nextStep: nextTutorial, dismiss: dismissTutorial } = useRideTutorial({ isPracticeMode, walletConnected });

  const showKeyboardHints = useRideModalStore((s) => s.showKeyboardHints);

  // Show keyboard controls hint when a simulator/practice ride starts
  useEffect(() => {
    if (isRiding && useSimulator) {
      useRideModalStore.getState().setShowKeyboardHints(true);
    }
  }, [isRiding, useSimulator]);

  // ─── Swipe gesture support (mobile) ─────────────────────────────
  const swipe = useSwipeGesture({
    onSwipeDown: () => {
      // Dismiss transient modals on swipe down
      if (useRideModalStore.getState().showKeyboardHints) {
        useRideModalStore.getState().setShowKeyboardHints(false);
      }
    },
    disabled: deviceType !== "mobile",
  });

  // ─── Transition state ──────────────────────────────────────────
  // Tracks where we are in the ride lifecycle for smooth transitions
  const transitionState = (() => {
    if (isLoading && !isPracticeMode) return "loading";
    if (showActivation && !showCompletionScreen) return "activation";
    if (showCompletionScreen) return "completion";
    return "riding";
  })();

  // Keyboard hints: no page-level auto-dismiss — they persist until the user
  // dismisses them (Esc / button) so controls stay discoverable. The overlay
  // itself handles its own intro fade; we don't fight it with a second timer.

  // ─── Modal store reads (hoisted before early returns — rules of hooks) ─
  const showExitConfirm = useRideModalStore((s) => s.showExitConfirm);
  const showNoBikeModal = useRideModalStore((s) => s.showNoBikeModal);
  const showTutorialModal = useRideModalStore((s) => s.showTutorial);
  const tutorialStep = useRideModalStore((s) => s.tutorialStep);
  const tutorialSteps = useRideModalStore((s) => s.tutorialSteps);
  const showMilestone = useRideModalStore((s) => s.showMilestone);
  const showDemoModal = useRideModalStore((s) => s.showDemoModal);
  const demoStats = useRideModalStore((s) => s.demoStats);
  const isExitingRide = useRideModalStore((s) => s.isExitingRide);

  // ─── Loading / Not Found Gates ─────────────────────────────────
  if (isLoading && !isPracticeMode) {
    return (
      <RideLoading
        classId={classId}
        isPracticeMode={isPracticeMode}
        practiceClassName={practiceConfig?.name}
        rewardModeLabel={rewardMode === "yellow-stream" ? "Live rewards" : "Ride rewards"}
        loadStartedAt={loadStartedAt}
        onPracticeMode={() => router.push("/rider?mode=practice")}
        onBack={() => router.push("/rider")}
      />
    );
  }
  if (!classData || !classData.route) return <RideNotFound onExit={lifecycle.exitRide} />;

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div
      ref={swipe.ref}
      className="fixed inset-0 bg-black"
      style={{ height: deviceType === "mobile" ? `${viewportHeight}px` : "100vh" }}
    >
      <RideAiTelemetryBridge
        isRiding={isRiding}
        isPracticeMode={isPracticeMode}
        classId={classId}
        classData={classData}
        currentInterval={currentInterval}
        elapsedTime={elapsedTime}
        coordinatorRef={coordinatorRef}
      />

      <SectionErrorBoundary title="ride visualization">
        <RideVisualization
          routeElevationProfile={routeElevationProfile}
          routeCoordinates={routeCoordinates}
          currentRouteCoordinate={currentRouteCoordinate}
          classData={classData}
          routeTheme={routeTheme}
          searchParams={searchParams}
          panelState={panelState.state}
          panelPositions={panelState.positions}
          onTogglePanel={handleTogglePanel}
          onSetPanelPosition={panelState.setPanelPosition}
          onSnapPanel={handleSnapPanel}
          onTrackWidgetInteraction={handleTrackWidgetInteraction}
          onExpandOne={panelState.expandOne}
          onHaptic={haptic.trigger}
          flowTier={flow.flowTier}
        />
      </SectionErrorBoundary>

      {/* ─── Coach channel (replaces full-screen overlay) ─────────── */}
      {/* Practice mode on mobile: raise it above the tall pedal-sheet bar.
          Hidden on the completion screen — the completion debrief speaks for
          the coach there (with optional vocal replay). */}
      {hudMode !== "minimal" && !showCompletionScreen && (
        <CoachChannel
          className={
            isRiding && useSimulator && deviceType === "mobile" ? "bottom-[22rem]" : ""
          }
        />
      )}

      {/* ─── Simplified reactive HUD (v2) ──────────────────────────── */}
      <SectionErrorBoundary title="ride HUD v2">
        <RideHUDOverlayV2
          hudMode={hudMode}
          isRiding={isRiding}
          showCompletionScreen={showCompletionScreen}
          flowTier={flow.flowTier}
          suppressBottomStack={isRiding && useSimulator}
          rideDurationSec={(classData?.metadata?.duration ?? 45) * 60}
          isPracticeMode={isPracticeMode}
        />
      </SectionErrorBoundary>

      {/* ─── Start ride (preview) — visible before the ride is active ───── */}
      {!isRiding && !isStarting && !isPaused && !showCompletionScreen && !showActivation && classData && (
        <RideStartScreen
          classData={classData}
          isPracticeMode={isPracticeMode}
          effectiveIsFocus={effectiveIsFocus}
          canRender3d={canRender3d}
          onToggleViewMode={handleToggleViewMode}
          onStart={() => setShowActivation(true)}
        />
      )}

      {/* ─── Ride controls cluster (visible, always available) ──────── */}
      {isRiding && !showCompletionScreen && (
        <RideHudControls
          hudMode={hudMode}
          onToggleHud={toggleQuietHud}
          onToggleViewMode={handleToggleViewMode}
          effectiveIsFocus={effectiveIsFocus}
          canRender3d={canRender3d}
          onShowKeyboardHints={() => useRideModalStore.getState().setShowKeyboardHints(true)}
        />
      )}

      {/* ─── Transition overlay (replaces raw activation) ──────────── */}
      <RideTransitionOverlay
        state={transitionState}
        onActivationComplete={handleActivationComplete}
        onSkipActivation={handleActivationSkip}
        activationPhase={currentInterval?.phase ?? undefined}
        routeThumbnailUrl={routeThumbnailForTheme(
          classData?.metadata?.route?.theme,
        )}
        routeLabel={
          classData?.metadata?.route?.name ??
          classData?.metadata?.name ??
          classData?.name ??
          null
        }
        hasData={!!classData}
        loadProgress={Math.min(1, (Date.now() - loadStartedAt) / 5000)}
        loadTotal={5000}
        reducedMotion={reducedMotion}
      />

      {/* ─── Completion celebration (v2) ───────────────────────────── */}
      {showCompletionScreen && (
        <RideCompletionV2
          isPracticeMode={isPracticeMode}
          walletConnected={walletConnected}
          elapsedTime={elapsedTime}
          classDurationSec={(classData?.metadata?.duration ?? 45) * 60}
          flowTier={flow.flowTier}
          avgHeartRate={completionStats?.avgHr ?? telemetryAverages.avgHr}
          avgPower={completionStats?.avgPower ?? telemetryAverages.avgPower}
          avgEffort={completionStats?.avgEffort ?? telemetryAverages.avgEffort}
          telemetrySource={useSimulator ? "simulator" : (bleConnected ? "live-bike" : "estimated")}
          onExit={lifecycle.handleCompletionExit}
          onRideAgain={handleRideAgain}
          onClaimRewards={rewardsHook.handleClaimRewards}
          onConnectWallet={() => openConnectModal?.()}
          onSpeakDebrief={(text) => void speak(text, "data")}
          rewardClaimStatus={rewardsHook.rewardClaimStatus}
          spinEarned={rewardsHook.rewards.formattedReward}
          agentName={agentName}
          agentPersonality={aiPersonality as "zen" | "drill-sergeant" | "data"}
          walrusAnchorInfo={null}
          classId={classId}
          completedRideId={completedRideId ?? undefined}
          settlementStatus={undefined}
          maxHeartRate={milestones.maxHRRef.current}
          maxPower={milestones.maxPowerRef.current}
          peakEffort={milestones.peakEffortRef.current}
          rideMilestones={milestones.rideMilestones}
        />
      )}

      {/* ─── Modal stack (disciplined, single modal at a time) ─────── */}
      <SectionErrorBoundary title="ride modals">
      <ModalStack
        exitConfirm={showExitConfirm}
        noBike={showNoBikeModal}
        tutorial={showTutorialModal}
        tutorialStep={tutorialStep}
        tutorialSteps={tutorialSteps}
        milestone={showMilestone}
        keyboardHints={showKeyboardHints}
        demoModal={showDemoModal}
        demoStats={demoStats}
        isExitingRide={isExitingRide}
        useSimulator={useSimulator}
        isRiding={isRiding}
        hideSimulator={hudMode === "minimal"}
        showRideMetrics={useSimulator}
        onSimulatorMetrics={handleSimulatorMetrics}

        // Callbacks
        onExitConfirm={() => {
          useRideModalStore.getState().setShowExitConfirm(false);
          lifecycle.exitRide();
        }}
        onExitCancel={() => useRideModalStore.getState().setShowExitConfirm(false)}
        onNoBikeSimulator={() => {
          setUseSimulator(true);
          useRideModalStore.getState().setShowNoBikeModal(false);
        }}
        onNoBikeDismiss={() => useRideModalStore.getState().setShowNoBikeModal(false)}
        onTutorialNext={nextTutorial}
        onTutorialDismiss={dismissTutorial}
        onDemoClose={lifecycle.handleDemoModalClose}
        onKeyboardDismiss={() => useRideModalStore.getState().setShowKeyboardHints(false)}
      />
      </SectionErrorBoundary>
    </div>
  );
}
