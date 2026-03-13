"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useClass, createPracticeClassMetadata, generateMockRouteData, type ClassWithRoute } from "../../../hooks/evm/use-class-data";
import dynamic from "next/dynamic";
import FocusRouteVisualizer from "../../../components/features/route/focus-route-visualizer";
import { useAccount } from "wagmi";
import { usePanelState } from "../../../hooks/ui/use-panel-state";

const RouteVisualizer = dynamic(
  () => import("../../../components/features/route/route-visualizer"),
  { ssr: false }
);
import { RideControls } from "../../../components/features/ride/ride-controls";
import { RideCompletion } from "../../../components/features/ride/ride-completion";
import { RideHUD } from "../../../components/features/ride/ride-hud";
import { useDeviceType, useOrientation, useActualViewportHeight, usePerformanceTier } from "../../../lib/responsive";
import { useWorkoutAudio } from "../../../hooks/ai/use-workout-audio";
import { useCoachVoice } from "../../../hooks/common/use-coach-voice";
import { useAiInstructor } from "../../../hooks/ai/use-ai-instructor";
import { useAgentReasoner } from "../../../hooks/ai/use-agent-reasoner";
import { useRewards, type RewardMode } from "../../../hooks/rewards/use-rewards";
import { useUnifiedBle } from "../../../lib/mobile-bridge";
import { useZKClaim } from "../../../hooks/evm/use-zk-claim";
import { ANALYTICS_EVENTS, trackEvent } from "../../../lib/analytics/events";
import { useWakeLock } from "../../../hooks/use-wake-lock";
import { useFullscreen } from "../../../hooks/use-fullscreen";
import { useHaptic } from "../../../hooks/use-haptic";
import { DemoCompleteModal } from "../../../components/features/common/demo-complete-modal";
import {
  type WorkoutPlan,
  PHASE_DEFAULTS,
  PHASE_TO_THEME,
  PRESET_WORKOUTS,
  getCurrentInterval,
  getIntervalProgress,
  getIntervalRemaining,
} from "../../../lib/workout-plan";
import {
  calculateNextWBal,
  DEFAULT_WBAL_CONFIG,
  getWBalPercentage,
  getGearRatio,
  calculateVirtualSpeed,
  DEFAULT_ROAD_GEARS,
  type WBalConfig
} from "../../../lib/analytics/physiological-models";
import { downloadTCX, type RideRecordPoint } from "../../../lib/analytics/ride-recorder";
import { calculateGhostState, generateMockGhost, type GhostPerformance, type GhostState } from "../../../lib/analytics/ghost-service";
import { createCanonicalRideSummary, enqueueRideSync, getRetentionSignals, processRideSyncQueue, saveRideSummary, type RideSyncStatus } from "../../../lib/analytics/ride-history";

interface PracticeClassConfig {
  name: string;
  date: string;
  capacity: number;
  basePrice: number;
  maxPrice: number;
  curveType: "linear" | "exponential";
  rewardThreshold: number;
  rewardAmount: number;
  aiEnabled?: boolean;
  aiPersonality?: "zen" | "drill-sergeant" | "data";
  routeName: string;
  routeDistance: number;
  routeDuration: number;
  routeElevation: number;
  instructor: string;
}

function getSystemHudMode(
  deviceType: "mobile" | "tablet" | "desktop",
  orientation: "portrait" | "landscape",
  prefersReducedMotion: boolean,
): "full" | "compact" | "minimal" {
  if (prefersReducedMotion) return "minimal";
  if (deviceType === "mobile") return "compact";
  if (deviceType === "tablet") return orientation === "portrait" ? "compact" : "full";
  return "full";
}

function getSystemViewMode(
  deviceType: "mobile" | "tablet" | "desktop",
  performanceTier: "high" | "medium" | "low",
  prefersReducedMotion: boolean,
): "immersive" | "focus" {
  if (prefersReducedMotion) return "focus";
  return deviceType === "desktop" || performanceTier === "high" ? "immersive" : "focus";
}

export default function LiveRidePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = params.classId as string;

  const isPracticeMode = searchParams.get("mode") === "practice";

  const practiceConfig: PracticeClassConfig | null = useMemo(() => {
    if (!isPracticeMode) return null;
    const name = searchParams.get("name");
    const date = searchParams.get("date");
    const instructor = searchParams.get("instructor");
    if (!name || !date || !instructor) return null;

    return {
      name,
      date,
      capacity: Number(searchParams.get("capacity")) || 50,
      basePrice: Number(searchParams.get("basePrice")) || 0.02,
      maxPrice: Number(searchParams.get("maxPrice")) || 0.08,
      curveType: (searchParams.get("curveType") as "linear" | "exponential") || "linear",
      rewardThreshold: Number(searchParams.get("rewardThreshold")) || 150,
      rewardAmount: Number(searchParams.get("rewardAmount")) || 20,
      aiEnabled: searchParams.get("aiEnabled") === "true",
      aiPersonality: (searchParams.get("aiPersonality") as "zen" | "drill-sergeant" | "data") || undefined,
      routeName: searchParams.get("routeName") || "Practice Route",
      routeDistance: Number(searchParams.get("routeDistance")) || 20,
      routeDuration: Number(searchParams.get("routeDuration")) || 45,
      routeElevation: Number(searchParams.get("routeElevation")) || 300,
      instructor,
    };
  }, [isPracticeMode, searchParams]);

  const practiceClassData: ClassWithRoute | null = useMemo(() => {
    if (!practiceConfig) return null;

    const metadata = createPracticeClassMetadata(
      {
        name: practiceConfig.name,
        date: practiceConfig.date,
        capacity: practiceConfig.capacity,
        basePrice: practiceConfig.basePrice,
        maxPrice: practiceConfig.maxPrice,
        curveType: practiceConfig.curveType,
        rewardThreshold: practiceConfig.rewardThreshold,
        rewardAmount: practiceConfig.rewardAmount,
        suiPerformance: true,
        aiEnabled: practiceConfig.aiEnabled,
        aiPersonality: practiceConfig.aiPersonality,
      },
      {
        name: practiceConfig.routeName,
        distance: practiceConfig.routeDistance,
        duration: practiceConfig.routeDuration,
        elevationGain: practiceConfig.routeElevation,
        theme: "neon",
        storyBeatsCount: 4,
      },
      practiceConfig.instructor
    );

    const route = generateMockRouteData(metadata);

    return {
      address: classId as `0x${string}`,
      name: metadata.name,
      instructor: metadata.instructor,
      startTime: metadata.startTime,
      endTime: metadata.endTime,
      maxRiders: practiceConfig.capacity,
      ticketsSold: 0,
      currentPrice: practiceConfig.basePrice.toString(),
      metadata,
      route,
      routeLoading: false,
      routeError: null,
    };
  }, [practiceConfig, classId]);

  const { classData: fetchedClassData, isLoading } = useClass(classId as `0x${string}`);
  const classData = isPracticeMode ? practiceClassData : fetchedClassData;
  const [loadStartedAt] = useState(() => Date.now());
  const deviceType = useDeviceType();
  const orientation = useOrientation();
  const viewportHeight = useActualViewportHeight();
  const performanceTier = usePerformanceTier();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Collapsible panel state
  const panelState = usePanelState(deviceType);

  // Keyboard shortcut for collapse all (C key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        // Only toggle if not in an input field
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        if (panelState.isAllCollapsed) {
          panelState.expandAll();
        } else {
          panelState.collapseAll();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panelState]);

  // Ride state
  const [isRiding, setIsRiding] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [rideProgress, setRideProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showHUD] = useState(true);
  const [hudMode, setHudMode] = useState<"full" | "compact" | "minimal">("full");
  const hudModePreferenceRef = useRef<"system" | "stored" | "manual">("system");
  const viewModePreferenceRef = useRef<"system" | "stored" | "manual">("system");

  // Mobile accordion: when expanding a panel on mobile, collapse others (one at a time)
  const handleTogglePanel = useCallback((key: Parameters<typeof panelState.toggle>[0]) => {
    if (deviceType === "mobile") {
      // On mobile, use accordion behavior - expand one, collapse others
      const isCurrentlyExpanded = panelState.state[key];
      if (isCurrentlyExpanded) {
        // If already expanded, just collapse it
        panelState.collapse(key);
      } else {
        // If collapsed, expand it and collapse others
        panelState.expandOne(key);
      }
    } else {
      // On desktop/tablet, use normal toggle
      panelState.toggle(key);
    }
  }, [deviceType, panelState]);

  // Mobile: Start with all panels collapsed when riding to maximize ride visibility
  // Users can expand one panel at a time using accordion behavior
  useEffect(() => {
    if (deviceType === "mobile" && isRiding) {
      // Collapse all panels when ride starts on mobile to maximize view
      panelState.collapseAll();
    } else if (deviceType === "mobile" && !isRiding) {
      // When not riding, allow panels to be expanded
      panelState.reset();
    }
  }, [deviceType, isRiding, panelState]);

  // Mobile widget panel visibility - default to hidden on mobile when riding to maximize ride view
  const [widgetsVisible, setWidgetsVisible] = useState(true);
  
  // On mobile, default widgets to hidden when riding starts
  useEffect(() => {
    if (typeof window !== "undefined" && deviceType === "mobile") {
      if (isRiding) {
        // Hide widgets when ride starts
        setWidgetsVisible(false);
      } else {
        // Show widgets when not riding
        setWidgetsVisible(true);
      }
    }
  }, [deviceType, isRiding]);

  // Onboarding Tutorial State
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Show tutorial for first-time riders or when explicitly requested
    const searchParams = new URLSearchParams(window.location.search);
    const hasSeenTutorial = localStorage.getItem("spinchain:onboarding:ride-tutorial");
    if (!hasSeenTutorial || searchParams.get("setup") === "true") {
      setShowTutorial(true);
    }
  }, []);

  // Tutorial Content
  const tutorialSteps = [
    {
      title: "Welcome to your HUD",
      content: "This is your performance center. Track your power, cadence, and heart rate as you ride.",
      position: "top-1/4 left-1/2 -translate-x-1/2",
    },
    {
      title: "Earn as you sweat",
      content: "Your Effort Score (bottom right) determines your SPIN rewards. The harder you work, the more you earn!",
      position: "top-20 right-10",
    },
    {
      title: "Real-time Rewards",
      content: "Enable 'Live Mode' for instant rewards during your ride, or 'Standard Mode' for private, batched rewards.",
      position: "bottom-48 left-10",
    },
    {
      title: "Private & Secure",
      content: "Your health data is private. We only verify your effort on the blockchain without ever seeing your raw biometrics.",
      position: "bottom-40 right-10",
    },
    {
      title: "Ready to Start?",
      content: "Link your bike or use the simulator to begin your journey.",
      position: "bottom-32 left-1/2 -translate-x-1/2",
    }
  ];

  const nextTutorial = () => {
    if (tutorialStep < tutorialSteps.length - 1) {
      setTutorialStep(s => s + 1);
    } else {
      setShowTutorial(false);
      localStorage.setItem("spinchain:onboarding:ride-tutorial", "true");
    }
  };

  // Persisted HUD preference (client-only)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("spinchain:ride:hudMode");
      if (stored === "full" || stored === "compact" || stored === "minimal") {
        hudModePreferenceRef.current = "stored";
        setHudMode(stored);
      }
    } catch {
      // ignore
    }
  }, []);
  const [viewMode, setViewMode] = useState<"immersive" | "focus">(
    getSystemViewMode(deviceType, performanceTier, false)
  );

  // Persisted preference (client-only)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("spinchain:ride:viewMode");
      if (stored === "focus" || stored === "immersive") {
        viewModePreferenceRef.current = "stored";
        setViewMode(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const applyViewMode = (next: "immersive" | "focus", source: "system" | "manual") => {
    setViewMode(next);
    viewModePreferenceRef.current = source;
    if (source === "manual") {
      try {
        window.localStorage.setItem("spinchain:ride:viewMode", next);
      } catch {
        // ignore
      }
    }
  };

  const applyHudMode = (next: "full" | "compact" | "minimal", source: "system" | "manual") => {
    setHudMode(next);
    hudModePreferenceRef.current = source;
    if (source === "manual") {
      try {
        window.localStorage.setItem("spinchain:ride:hudMode", next);
      } catch {
        // ignore
      }
    }
  };

  // Accessibility: prefer reduced motion => default to focus mode + minimal HUD
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;

    const apply = () => {
      setPrefersReducedMotion(mq.matches);
    };

    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // BLE Device Connection
  const [bleConnected, setBleConnected] = useState(false);
  // Simulator mode is a user choice — Capacitor BLE works natively on iOS/Android/web
  // Auto-enable simulator in demo mode (?demo=true URL param)
  const [useSimulator, setUseSimulator] = useState(() => {
    if (typeof window === "undefined") return false;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("demo") === "true" || urlParams.get("sim") === "true";
  });
  const [connectionHint, setConnectionHint] = useState<string | null>(null);

  // Auto-start ride in demo mode
  const autoStartDemo = searchParams.get("auto") === "true";

  useEffect(() => {
    if (bleConnected || useSimulator) {
      setConnectionHint(null);
    }
  }, [bleConnected, isPracticeMode, useSimulator]);

  // Telemetry (buffer raw updates in refs; commit to React state at a UI rate for mobile perf)
  const [telemetry, setTelemetry] = useState({
    heartRate: 0,
    power: 0,
    cadence: 0,
    speed: 0,
    effort: 0,
    wBal: DEFAULT_WBAL_CONFIG.wPrime,
    wBalPercentage: 100,
    currentGear: 10,
    gearRatio: 1.0,
    distance: 0,
    timestamp: Date.now(),
  });
  const [recentPowerHistory, setRecentPowerHistory] = useState<number[]>([]);
  const telemetryRawRef = useRef({
    heartRate: 0,
    power: 0,
    cadence: 0,
    speed: 0,
    effort: 0,
    wBal: DEFAULT_WBAL_CONFIG.wPrime,
    wBalPercentage: 100,
    currentGear: 10,
    gearRatio: 1.0,
    distance: 0,
    timestamp: Date.now(),
  });

  // Physiological Model Refs
  const wBalRef = useRef<number>(DEFAULT_WBAL_CONFIG.wPrime);
  const wBalConfigRef = useRef<WBalConfig>(DEFAULT_WBAL_CONFIG);
  const [currentGear, setCurrentGear] = useState(10); // Start in middle gear
  const lastWBalUpdateMsRef = useRef<number>(0);
  
  // Ghost Rider State
  const [ghostPerformance, setGhostPerformance] = useState<GhostPerformance | null>(null);
  const [ghostState, setGhostState] = useState<GhostState>({
    leadLagTime: 0,
    distanceGap: 0,
    ghostPoint: null,
  });
  
  const lastTelemetryCommitMsRef = useRef(0);
  const trackedEntryViewRef = useRef(false);
  const trackedLiveTelemetryRef = useRef(false);
  const trackedCompletionRef = useRef(false);

  // Telemetry averages for completion screen
  const telemetrySamples = useRef<{ hr: number; power: number; effort: number }[]>([]);
  const ridePointsRef = useRef<RideRecordPoint[]>([]);
  const routeCoordinates = useMemo(
    () => classData?.route?.route.coordinates ?? [],
    [classData?.route?.route.coordinates],
  );

  useEffect(() => {
    if (routeCoordinates.length > 0 && !ghostPerformance) {
      const mock = generateMockGhost(routeCoordinates, 25); // 25 km/h target
      setGhostPerformance(mock);
    }
  }, [routeCoordinates, ghostPerformance]);

  const routeElevationProfile = useMemo(
    () => routeCoordinates.map((coordinate) => coordinate.ele || 0),
    [routeCoordinates],
  );
  const routeProgress = isRiding || rideProgress > 0 ? rideProgress / 100 : 0;
  const visualizerMode: "preview" | "ride" | "finished" =
    rideProgress >= 100
      ? "finished"
      : (isRiding || rideProgress > 0)
        ? "ride"
        : "preview";
  const currentRouteCoordinate = useMemo(() => {
    if (routeCoordinates.length === 0) return null;
    const index = Math.min(
      routeCoordinates.length - 1,
      Math.max(0, Math.round(routeProgress * Math.max(0, routeCoordinates.length - 1))),
    );
    return routeCoordinates[index] ?? null;
  }, [routeCoordinates, routeProgress]);

  // Rate-limit reward recording to avoid async pressure on mobile
  const lastRewardRecordMsRef = useRef(0);
  const pendingRewardRecordRef = useRef(false);

  // Workout plan state
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(
    () => PRESET_WORKOUTS[1] // Default to HIIT 45 for demo; will be selectable
  );

  // Current interval tracking (derived from elapsed time)
  const currentIntervalIndex = workoutPlan
    ? getCurrentInterval(workoutPlan.intervals, elapsedTime)
    : -1;
  const currentInterval = workoutPlan?.intervals[currentIntervalIndex] ?? null;
  const intervalProgress = workoutPlan
    ? getIntervalProgress(workoutPlan.intervals, elapsedTime)
    : 0;
  const intervalRemaining = workoutPlan
    ? getIntervalRemaining(workoutPlan.intervals, elapsedTime)
    : 0;
  const routeTheme = currentInterval
    ? PHASE_TO_THEME[currentInterval.phase]
    : (classData?.metadata?.route.theme as "neon" | "alpine" | "mars" | "anime" | "rainbow") || "neon";

  // Audio hooks
  const aiPersonality = classData?.metadata?.ai?.personality;
  const coachPersonality = aiPersonality === 'drill-sergeant' ? 'drill' : aiPersonality === 'zen' ? 'zen' : 'data';
  const { playSound, playCountdown, stopAll: stopAudio, isConfigured: audioConfigured } = useWorkoutAudio();
  const { speak, stop: stopVoice, isSpeaking } = useCoachVoice({
    personality: coachPersonality,
    intensity: rideProgress / 100,
  });

  // AI Instructor
  const { setResistance } = useUnifiedBle();
  const [aiActive, setAiActive] = useState(false);
  const agentName = classData?.instructor || 'Coach';
  const { logs: aiLogs, addLog: addAiLog } = useAiInstructor({
    agentName,
    personality: aiPersonality || 'data',
    sessionObjectId: null, // No Sui session in practice/standalone mode
    metrics: telemetry,
    currentInterval,
    isEnabled: aiActive,
    setResistance,
  });

  const { state: reasonerState, lastDecision, thoughtLog, reason: triggerReasoning } = useAgentReasoner({
    agentName,
    personality: aiPersonality || 'data',
    enabled: aiActive,
  });

  // ZK Proof + Privacy
  const {
    claimWithZK,
    isGeneratingProof,
    isSuccess: zkSuccess,
    privacyScore,
    privacyLevel,
    error: zkError,
  } = useZKClaim();

  const handleClaimRewards = async () => {
    if (isPracticeMode) return;
    const threshold = classData?.metadata?.rewards?.threshold ?? 150;
    await claimWithZK(
      {
        spinClass: (classId as `0x${string}`),
        rider: '0x0000000000000000000000000000000000000000',
        rewardAmount: String(classData?.metadata?.rewards?.amount ?? 0),
        classId: (classId as `0x${string}`),
      },
      {
        heartRate: telemetryAverages.avgHr || telemetry.heartRate,
        threshold,
        duration: Math.floor(elapsedTime / 60),
      }
    );
  };

  // Reward mode selection — default to zk-batch, yellow-stream available as beta for wallet users
  const { isConnected: walletConnected, address } = useAccount();
  const [rewardMode, setRewardMode] = useState<RewardMode>("zk-batch");

  // Guest mode — reward selector is disabled; user must connect wallet to earn
  const isGuestMode = typeof window !== "undefined" && localStorage.getItem("spin-guest-mode") === "true" && !walletConnected;

  // Training mode: simulator is active in a paid class (rewards disabled but can test experience)
  const isTrainingMode = useSimulator && !isPracticeMode && walletConnected;
  const canEarnRewards = !isTrainingMode && (rewardMode === "zk-batch" || (rewardMode === "yellow-stream" && walletConnected));

  // Rewards — mode selectable, defaults to zk-batch
  const rewards = useRewards({
    mode: rewardMode,
    classId: classId as string,
    instructor: (classData?.instructor as `0x${string}`) || "0x0",
    depositAmount: BigInt(0), // Demo mode - no real deposit required
  });

  // Mobile experience hooks - wake lock, fullscreen, haptic
  const { request: requestWakeLock, release: releaseWakeLock, isActive: wakeLockActive } = useWakeLock();
  const { toggle: toggleFullscreen, isActive: fullscreenActive } = useFullscreen();
  const haptic = useHaptic();

  // Activate wake lock and fullscreen when riding starts on mobile
  useEffect(() => {
    if (isRiding && deviceType === "mobile") {
      requestWakeLock();
      // Offer fullscreen but don't force it
    } else if (!isRiding && wakeLockActive) {
      releaseWakeLock();
    }
  }, [isRiding, deviceType, requestWakeLock, releaseWakeLock, wakeLockActive]);

  // Demo complete modal state
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [completionSyncStatus, setCompletionSyncStatus] = useState<RideSyncStatus>("local_only");
  const [completionPrimaryAction, setCompletionPrimaryAction] = useState<"view_history" | "ride_again">("view_history");
  const [demoStats, setDemoStats] = useState({
    duration: 0,
    avgHeartRate: 0,
    maxHeartRate: 0,
    effortScore: 0,
    spinEarned: "0",
    rewardsWereActive: false,
  });

  // Track last spoken beat to avoid repeats
  const lastSpokenBeatRef = useRef<string | null>(null);

  // Track interval transitions for audio cues
  const lastIntervalRef = useRef<number>(-1);

  // Coach message overlay — last spoken text, cleared after 4s
  const [lastCoachMessage, setLastCoachMessage] = useState<string | null>(null);
  const coachMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cadence drift detection — track how long cadence has been below target
  const cadenceDriftMsRef = useRef<number>(0);
  const lastCadenceCheckRef = useRef<number>(Date.now());
  const lastDriftNudgeRef = useRef<string | null>(null);

  // Keyboard Shifting (Virtual Gears)
  useEffect(() => {
    if (typeof window === "undefined" || !isRiding) return;
    
    const totalGears = DEFAULT_ROAD_GEARS.front.length * DEFAULT_ROAD_GEARS.rear.length;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        setCurrentGear(prev => Math.min(totalGears, prev + 1));
        playSound?.("resistanceUp");
      } else if (e.key === "ArrowDown") {
        setCurrentGear(prev => Math.max(1, prev - 1));
        playSound?.("resistanceDown");
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRiding, playSound]);

  // Commit buffered telemetry into React state at a fixed rate to reduce rerenders
  useEffect(() => {
    if (!isRiding) return;

    const uiHz = deviceType === "mobile" ? 2 : 4;
    const intervalMs = Math.floor(1000 / uiHz);

    const id = setInterval(() => {
      const now = Date.now();
      if (now - lastTelemetryCommitMsRef.current < intervalMs) return;
      
      const deltaSeconds = lastWBalUpdateMsRef.current > 0 
        ? (now - lastWBalUpdateMsRef.current) / 1000 
        : intervalMs / 1000;
      
      lastWBalUpdateMsRef.current = now;
      lastTelemetryCommitMsRef.current = now;
      
      // Update Physiological Model (W'bal)
      const power = telemetryRawRef.current.power;
      const nextWBal = calculateNextWBal(
        wBalRef.current,
        power,
        deltaSeconds,
        wBalConfigRef.current
      );
      
      wBalRef.current = nextWBal;
      const percentage = getWBalPercentage(nextWBal, wBalConfigRef.current.wPrime);
      
      // Calculate Virtual Speed based on Gear
      const { ratio } = getGearRatio(currentGear);
      const virtualSpeed = calculateVirtualSpeed(telemetryRawRef.current.cadence, ratio);
      
      // Sync with raw ref for consistent display
      telemetryRawRef.current = {
        ...telemetryRawRef.current,
        speed: virtualSpeed > 0 ? virtualSpeed : telemetryRawRef.current.speed,
        distance: telemetryRawRef.current.distance + ((virtualSpeed * deltaSeconds) / 3600),
        wBal: nextWBal,
        wBalPercentage: percentage,
        currentGear,
        gearRatio: ratio,
        timestamp: now,
      };
      
      // Record point for TCX export (at ~1Hz)
      if (Math.round(now / 1000) !== Math.round(lastTelemetryCommitMsRef.current / 1000)) {
        const currentCoord = currentRouteCoordinate;
        ridePointsRef.current.push({
          timestamp: now,
          heartRate: telemetryRawRef.current.heartRate,
          power: telemetryRawRef.current.power,
          cadence: telemetryRawRef.current.cadence,
          speed: telemetryRawRef.current.speed,
          distance: telemetryRawRef.current.distance,
          latitude: currentCoord?.lat,
          longitude: currentCoord?.lng,
          altitude: currentCoord?.ele,
        });
      }
      
      // Update Ghost Rider position and lead/lag
      if (ghostPerformance) {
        const nextGhost = calculateGhostState(
          ghostPerformance.points,
          telemetryRawRef.current.distance * 1000,
          elapsedTime
        );
        setGhostState(nextGhost);
      }
      
      setTelemetry(telemetryRawRef.current);
    }, intervalMs);

    return () => clearInterval(id);
  }, [isRiding, deviceType]);

  useEffect(() => {
    if (telemetry.power <= 0) return;
    setRecentPowerHistory((previous) => [...previous.slice(-19), telemetry.power]);
  }, [telemetry.power]);

  // Handle BLE metrics updates
  const handleBleMetrics = async (metrics: {
    heartRate?: number;
    power?: number;
    cadence?: number;
    speed?: number;
    effort?: number;
    distance?: number;
    timestamp?: number;
  }) => {
    // Buffer raw telemetry (do not trigger React rerender here)
    telemetryRawRef.current = {
      ...telemetryRawRef.current,
      heartRate: metrics.heartRate ?? telemetryRawRef.current.heartRate,
      power: metrics.power ?? telemetryRawRef.current.power,
      cadence: metrics.cadence ?? telemetryRawRef.current.cadence,
      speed: metrics.speed ?? telemetryRawRef.current.speed,
      effort: metrics.effort ?? telemetryRawRef.current.effort,
      distance: metrics.distance ?? telemetryRawRef.current.distance,
      timestamp: metrics.timestamp ?? Date.now(),
    };
    if (metrics.heartRate || metrics.power) {
      setBleConnected(true);
      if (!trackedLiveTelemetryRef.current) {
        trackedLiveTelemetryRef.current = true;
        trackEvent(ANALYTICS_EVENTS.TELEMETRY_LIVE_READY, {
          classId,
          practiceMode: isPracticeMode,
        });
      }
    }

    // Record effort for Yellow rewards (rate-limited; do not block UI)
    // Skip recording in training mode (simulator in paid class) - rewards disabled
    if (isRiding && rewards.isActive && (metrics.heartRate || metrics.power) && !isTrainingMode) {
      const now = Date.now();
      const minIntervalMs = deviceType === "mobile" ? 500 : 250; // 2Hz mobile, 4Hz desktop

      if (!pendingRewardRecordRef.current && now - lastRewardRecordMsRef.current >= minIntervalMs) {
        pendingRewardRecordRef.current = true;
        lastRewardRecordMsRef.current = now;

        void rewards
          .recordEffort({
            timestamp: now,
            heartRate: metrics.heartRate || telemetry.heartRate,
            power: metrics.power || telemetry.power,
            cadence: metrics.cadence || telemetry.cadence,
          })
          .catch((err) => {
            // Best-effort
            console.debug("[Ride] Failed to record effort:", err);
          })
          .finally(() => {
            pendingRewardRecordRef.current = false;
          });
      }
    }
  };

  // Handle simulator metrics updates
  const handleSimulatorMetrics = (metrics: {
    heartRate: number;
    power: number;
    cadence: number;
    speed: number;
    effort: number;
    distance?: number;
    timestamp?: number;
  }) => {

    telemetryRawRef.current = {
      ...telemetryRawRef.current,
      ...metrics,
      distance: metrics.distance ?? telemetryRawRef.current.distance,
      timestamp: metrics.timestamp ?? Date.now(),
    };
    // Simulator is a user-driven control; update UI immediately for responsiveness
    setTelemetry(telemetryRawRef.current);

    // Advance ride progress cadence-weighted: no pedaling = no progress.
    // Each simulator tick is 0.5s; scale by cadence vs target (80 RPM).
    // At target cadence the rider advances at normal pace; below = slower; above = faster (capped at 1.5×).
    if (isRiding && classData && metrics.cadence > 0) {
      const TARGET_CADENCE = 80;
      const cadenceRatio = Math.min(metrics.cadence / TARGET_CADENCE, 1.5);
      const tickSeconds = 0.5 * cadenceRatio;

      setElapsedTime(prev => {
        const newTime = prev + tickSeconds;
        const duration = (classData.metadata?.duration || 45) * 60;
        const newProgress = Math.min((newTime / duration) * 100, 100);
        setRideProgress(newProgress);

        if (newProgress >= 100) {
          setIsRiding(false);
        }

        return newTime;
      });
    }
  };

  // Auto-adjust HUD and view mode only while following system defaults.
  useEffect(() => {
    if (hudModePreferenceRef.current === "system") {
      setHudMode(getSystemHudMode(deviceType, orientation, prefersReducedMotion));
    }

    if (viewModePreferenceRef.current === "system") {
      setViewMode(getSystemViewMode(deviceType, performanceTier, prefersReducedMotion));
    }
  }, [deviceType, orientation, performanceTier, prefersReducedMotion]);

  useEffect(() => {
    if (isRiding || rideProgress > 0 || trackedEntryViewRef.current) return;
    trackedEntryViewRef.current = true;
    trackEvent(ANALYTICS_EVENTS.RIDE_ENTRY_VIEWED, {
      classId,
      practiceMode: isPracticeMode,
    });
  }, [classId, isPracticeMode, isRiding, rideProgress]);

  // Simulate ride progress (only when BLE not connected and not using simulator)
  useEffect(() => {
    if (!isRiding || !classData || bleConnected || useSimulator) return;

    const interval = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        const duration = (classData.metadata?.duration || 45) * 60;
        const newProgress = Math.min((newTime / duration) * 100, 100);
        setRideProgress(newProgress);

        if (newProgress >= 100) {
          setIsRiding(false);
        }

        return newTime;
      });

      // Only simulate telemetry if BLE not connected and not using simulator
      if (!bleConnected && !useSimulator) {
        const prev = telemetryRawRef.current;
        const newTelemetry = {
          ...prev,
          heartRate: prev.heartRate || 120 + Math.floor(Math.random() * 40),
          power: prev.power || 150 + Math.floor(Math.random() * 100),
          cadence: prev.cadence || 80 + Math.floor(Math.random() * 20),
          speed: prev.speed || 25 + Math.random() * 10,
          effort: prev.effort || 140 + Math.floor(Math.random() * 30),
        };
        telemetryRawRef.current = newTelemetry;

        // Collect samples for averages
        telemetrySamples.current.push({
          hr: newTelemetry.heartRate,
          power: newTelemetry.power,
          effort: newTelemetry.effort,
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRiding, classData, bleConnected, useSimulator]);

  // Also collect BLE and simulator telemetry samples
  useEffect(() => {
    if (isRiding && (bleConnected || useSimulator) && telemetry.heartRate > 0) {
      telemetrySamples.current.push({
        hr: telemetry.heartRate,
        power: telemetry.power,
        effort: telemetry.effort,
      });
    }
  }, [isRiding, bleConnected, useSimulator, isPracticeMode, telemetry.heartRate, telemetry.power, telemetry.effort]);

  // Interval transition: announce phase changes with coach voice + SFX
  useEffect(() => {
    if (!isRiding || !workoutPlan || currentIntervalIndex < 0) return;
    if (lastIntervalRef.current === currentIntervalIndex) return;

    const prevIndex = lastIntervalRef.current;
    lastIntervalRef.current = currentIntervalIndex;

    // Skip first interval announcement on ride start (already handled by startRide)
    if (prevIndex === -1) return;

    const interval = workoutPlan.intervals[currentIntervalIndex];
    if (!interval) return;

    // Play phase-appropriate SFX
    if (interval.phase === 'sprint') {
      playSound('intervalStart');
    } else if (interval.phase === 'recovery' || interval.phase === 'cooldown') {
      playSound('recover');
    } else if (interval.phase === 'interval') {
      playSound('resistanceUp');
    }

    // Coach announces the interval transition
    if (interval.coachCue) {
      const emotion = PHASE_DEFAULTS[interval.phase].coachEmotion;
      speak(interval.coachCue, emotion);
      setLastCoachMessage(interval.coachCue);
      if (coachMessageTimerRef.current) clearTimeout(coachMessageTimerRef.current);
      coachMessageTimerRef.current = setTimeout(() => setLastCoachMessage(null), 4000);
    }
  }, [isRiding, workoutPlan, currentIntervalIndex, playSound, speak]);

  // Countdown warning at 5 seconds before interval ends
  useEffect(() => {
    if (!isRiding || !workoutPlan || !currentInterval) return;
    if (intervalRemaining <= 5 && intervalRemaining > 4) {
      playSound('countdown');
    }
  }, [isRiding, workoutPlan, currentInterval, intervalRemaining, playSound]);

  const currentBeat = useMemo(() => {
    const beats = classData?.route?.route.storyBeats;
    if (!beats) return undefined;
    return beats.find((beat) => {
      const beatProgress = beat.progress * 100;
      return rideProgress >= beatProgress && rideProgress < beatProgress + 3;
    });
  }, [classData?.route?.route.storyBeats, rideProgress]);

  // Voice coach announces story beats
  useEffect(() => {
    if (!currentBeat || !isRiding) return;
    const beatKey = `${currentBeat.progress}-${currentBeat.label}`;
    if (lastSpokenBeatRef.current === beatKey) return;
    lastSpokenBeatRef.current = beatKey;

    // Play SFX based on beat type
    if (currentBeat.type === 'sprint') {
      playSound('sprint');
    } else if (currentBeat.type === 'climb') {
      playSound('climb');
    } else if (currentBeat.type === 'rest') {
      playSound('recover');
    }

    // Coach announces the beat
    const emotion = currentBeat.type === 'sprint' ? 'intense' as const
      : currentBeat.type === 'climb' ? 'focused' as const
        : currentBeat.type === 'rest' ? 'calm' as const
          : 'focused' as const;
    speak(currentBeat.label, emotion);
    setLastCoachMessage(currentBeat.label);
    if (coachMessageTimerRef.current) clearTimeout(coachMessageTimerRef.current);
    coachMessageTimerRef.current = setTimeout(() => setLastCoachMessage(null), 4000);
  }, [currentBeat, isRiding, playSound, speak]);

  // Activate AI instructor when riding — always on in practice/demo mode
  useEffect(() => {
    setAiActive(isRiding && (isPracticeMode || !!classData?.metadata?.ai?.enabled));
  }, [isRiding, isPracticeMode, classData?.metadata?.ai?.enabled, setAiActive]);

  // Speak AI instructor actions
  useEffect(() => {
    if (aiLogs.length === 0) return;
    const latest = aiLogs[0];
    if (latest.type === 'action' && !isSpeaking) {
      speak(latest.message, 'intense');
      setLastCoachMessage(latest.message);
      if (coachMessageTimerRef.current) clearTimeout(coachMessageTimerRef.current);
      coachMessageTimerRef.current = setTimeout(() => setLastCoachMessage(null), 4000);
    }
  }, [aiLogs, isSpeaking, speak]);

  // Cadence drift detection — nudge rider if below target RPM for >8s
  useEffect(() => {
    if (!isRiding || !currentInterval?.targetRpm) return;
    const [minRpm] = currentInterval.targetRpm;
    const now = Date.now();
    const delta = now - lastCadenceCheckRef.current;
    lastCadenceCheckRef.current = now;

    if (telemetry.cadence < minRpm - 10) {
      cadenceDriftMsRef.current += delta;
    } else {
      cadenceDriftMsRef.current = 0;
    }

    const intervalKey = `${currentIntervalIndex}-${currentInterval.phase}`;
    if (cadenceDriftMsRef.current >= 8000 && lastDriftNudgeRef.current !== intervalKey) {
      lastDriftNudgeRef.current = intervalKey;
      cadenceDriftMsRef.current = 0;
      const nudge = 'Pick up the pace!';
      speak(nudge, 'intense');
      setLastCoachMessage(nudge);
      if (coachMessageTimerRef.current) clearTimeout(coachMessageTimerRef.current);
      coachMessageTimerRef.current = setTimeout(() => setLastCoachMessage(null), 4000);
    }
  }, [isRiding, telemetry.cadence, currentInterval, currentIntervalIndex, speak]);

  // Periodic agent reasoning during ride
  useEffect(() => {
    if (!isRiding || !aiActive) return;

    const interval = setInterval(() => {
      triggerReasoning({
        telemetry: {
          avgBpm: telemetry.heartRate,
          resistance: telemetry.power,
          duration: elapsedTime,
        },
        market: {
          ticketsSold: classData?.ticketsSold ?? 0,
          revenue: 0,
          capacity: classData?.maxRiders ?? 50,
        },
        recentDecisions: thoughtLog.slice(0, 3),
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [isRiding, aiActive, telemetry.heartRate, telemetry.power, elapsedTime, classData?.ticketsSold, classData?.maxRiders, thoughtLog, triggerReasoning]);

  // Compute averages for completion
  const telemetryAverages = useMemo(() => {
    const samples = telemetrySamples.current;
    if (samples.length === 0) return { avgHr: 0, avgPower: 0, avgEffort: 0 };
    const sum = samples.reduce((acc, s) => ({
      hr: acc.hr + s.hr,
      power: acc.power + s.power,
      effort: acc.effort + s.effort,
    }), { hr: 0, power: 0, effort: 0 });
    return {
      avgHr: Math.round(sum.hr / samples.length),
      avgPower: Math.round(sum.power / samples.length),
      avgEffort: Math.round(sum.effort / samples.length),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideProgress >= 100]);

  const startRide = async () => {
    const telemetryReady = bleConnected || (isPracticeMode && useSimulator);
    if (!telemetryReady) {
      setConnectionHint("Connect your bike before starting to capture live telemetry.");
      trackEvent(ANALYTICS_EVENTS.RIDE_START_BLOCKED_NO_TELEMETRY, {
        classId,
        practiceMode: isPracticeMode,
      });
      return;
    }

    trackEvent(ANALYTICS_EVENTS.RIDE_STARTED, {
      classId,
      source: bleConnected ? 'live-bike' : 'simulator',
      practiceMode: isPracticeMode,
    });

    setIsStarting(true);
    playCountdown(3);

    // Pre-ride ClearNode connectivity check for Yellow mode
    if (rewardMode === "yellow-stream" && !rewards.clearNodeConnected) {
      // Non-blocking warning — ride can still start but rewards may not stream
      console.warn("[Ride] Yellow mode selected but ClearNode is not connected. Rewards may not stream.");
    }

    // Initialize rewards (gracefully handles no-wallet for zk-batch)
    // Skip in training mode - simulator in paid class doesn't earn rewards
    if (!isTrainingMode) {
      try {
        await rewards.startEarning();
        console.log("[Ride] Rewards channel opened, mode:", rewardMode);
      } catch (err) {
        // Non-blocking — guest users can still ride without earning
        console.warn("[Ride] Rewards init skipped:", err);
      }
    } else {
      console.log("[Ride] Training mode - rewards disabled");
    }

    // Start ride after countdown finishes
    setTimeout(() => {
      setIsRiding(true);
      setIsStarting(false);
      setRideProgress(0);
      setElapsedTime(0);
      setRecentPowerHistory([]);
      telemetrySamples.current = [];
      lastSpokenBeatRef.current = null;
      lastIntervalRef.current = -1;
      trackedCompletionRef.current = false;
      speak("Let's go!", 'intense');
    }, 3000);
  };

  const pauseRide = () => {
    setIsRiding(false);
    playSound('recover');
  };
  const exitRide = async () => {
    setIsExiting(true);
    stopAudio();
    stopVoice();
    setAiActive(false);

    // Calculate demo stats
    const samples = telemetrySamples.current;
    const avgHR = samples.length > 0
      ? Math.round(samples.reduce((sum, s) => sum + s.hr, 0) / samples.length)
      : 0;
    const maxHR = samples.length > 0
      ? Math.max(...samples.map(s => s.hr))
      : 0;

    // Finalize rewards logic
    let spinEarned = "0";
    const effortScore = Math.min(1000, Math.round((avgHR / 200) * 1000));
    
    // Calculate potential reward based on IncentiveEngine.sol logic:
    // Base: 10 SPIN, Bonus: (effortScore * 90) / 1000
    const potentialReward = 10 + (effortScore * 90) / 1000;
    
    if (rewards.isActive) {
      try {
        const result = await rewards.finalizeRewards();
        console.log("[Ride] Rewards finalized:", result);
        spinEarned = result.amount ? (Number(result.amount) / 1e18).toFixed(1) : "0";
      } catch (err) {
        console.warn("[Ride] Failed to finalize rewards:", err);
      }
    }

    // Use actual reward if earned, otherwise show potential for guest/practice mode
    const displaySpin = spinEarned !== "0" ? spinEarned : potentialReward.toFixed(1);

    // Show demo complete modal for practice mode
    const telemetrySource = bleConnected ? "live-bike" : (isPracticeMode && useSimulator) ? "simulator" : "estimated";

    const threshold = classData?.metadata?.rewards?.threshold ?? 180;
    const summaryId = `${classId}-${Date.now()}`;
    const zoneThreshold = Math.max(160, Math.round(threshold * 0.8));
    const zoneSprint = Math.max(190, Math.round(threshold * 1.05));
    const hrValues = samples.map((sample) => sample.hr);
    const zoneCounts = hrValues.reduce(
      (acc, hr) => {
        if (hr >= zoneSprint) acc.sprint += 1;
        else if (hr >= zoneThreshold) acc.threshold += 1;
        else if (hr >= 120) acc.endurance += 1;
        else acc.recovery += 1;
        return acc;
      },
      { recovery: 0, endurance: 0, threshold: 0, sprint: 0 },
    );
    const totalSamples = Math.max(1, samples.length);

    const canonicalSummary = createCanonicalRideSummary({
      id: summaryId,
      riderId: address ?? "guest",
      classId,
      className: classData?.name || practiceConfig?.name || "SpinChain Ride",
      instructor: classData?.instructor || practiceConfig?.instructor || agentName,
      completedAt: Date.now(),
      durationSec: elapsedTime,
      avgHeartRate: avgHR,
      avgPower: telemetryAverages.avgPower,
      avgEffort: telemetryAverages.avgEffort,
      spinEarned: Number(displaySpin),
      telemetrySource,
      effortTier: telemetryAverages.avgEffort >= 800 ? "platinum" : telemetryAverages.avgEffort >= 650 ? "gold" : telemetryAverages.avgEffort >= 500 ? "silver" : "bronze",
      zones: {
        recovery: Math.round((zoneCounts.recovery / totalSamples) * 100),
        endurance: Math.round((zoneCounts.endurance / totalSamples) * 100),
        threshold: Math.round((zoneCounts.threshold / totalSamples) * 100),
        sprint: Math.round((zoneCounts.sprint / totalSamples) * 100),
      },
      proof: {
        mode: rewardMode === "sui-native" ? "none" : rewardMode,
        isVerified: zkSuccess,
        privacyScore,
        privacyLevel,
      },
      onChain: {
        attempted: walletConnected,
        status: walletConnected ? (zkSuccess ? "confirmed" : "pending") : "skipped",
      },
    });
    const saved = saveRideSummary(canonicalSummary);
    const latest = saved.find((ride) => ride.id === canonicalSummary.id) ?? canonicalSummary;
    const queued = enqueueRideSync(latest);
    setCompletionSyncStatus(queued.sync.status);
    setCompletionPrimaryAction(getRetentionSignals(saved).ctaPrimary);
    void processRideSyncQueue();

    if (isPracticeMode) {
      setDemoStats({
        duration: elapsedTime,
        avgHeartRate: avgHR,
        maxHeartRate: maxHR,
        effortScore,
        spinEarned: displaySpin,
        rewardsWereActive: true, // Show "You would have earned" with the calculated amount
      });
      setIsExiting(false);
      setShowDemoModal(true);
    } else {
      router.push("/rider/journey?completed=true");
    }
  };

  const handleDemoModalClose = () => {
    setShowDemoModal(false);
    router.push("/rider");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const cycleHudMode = () => {
    const next = hudMode === "full" ? "compact" : hudMode === "compact" ? "minimal" : "full";
    applyHudMode(next, "manual");
  };

  useEffect(() => {
    if (rideProgress < 100 || trackedCompletionRef.current) return;
    trackedCompletionRef.current = true;
    trackEvent(ANALYTICS_EVENTS.RIDE_COMPLETED, {
      classId,
      source: bleConnected ? 'live-bike' : (isPracticeMode && useSimulator) ? 'simulator' : 'estimated',
      practiceMode: isPracticeMode,
    });
  }, [bleConnected, classId, isPracticeMode, rideProgress, useSimulator]);

  const loadingDurationMs = Date.now() - loadStartedAt;
  const isLikelyStuck = loadingDurationMs > 12000;

  const loadingStats = [
    {
      label: "Class",
      value: isPracticeMode
        ? practiceConfig?.name || "Practice Ride"
        : classId.slice(0, 6).concat("…"),
    },
    {
      label: "Mode",
      value: isPracticeMode ? "Practice" : "Live Class",
    },
    {
      label: "Rewards",
      value: rewardMode === "yellow-stream" ? "Yellow Stream" : rewardMode === "zk-batch" ? "ZK Batch" : "Sui Native",
    },
  ];

  const loadingTips = [
    "Warm-up tip: keep cadence steady for better early effort scoring.",
    "Stay in control zones first, then push for sprint windows.",
    "No wallet connected? You can still ride in practice mode.",
  ];

  if (isLoading && !isPracticeMode) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-cyan-300" />
            <div>
              <p className="text-base font-semibold text-white">Preparing your ride experience</p>
              <p className="text-xs text-white/60">Loading route, coach profile, and reward pipeline…</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {loadingStats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-white/10 bg-black/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-white/50">{stat.label}</p>
                <p className="mt-1 truncate text-sm font-medium text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-cyan-100/80">Rider insight</p>
            <p className="mt-1 text-sm text-cyan-50">{loadingTips[Math.floor((loadingDurationMs / 2500) % loadingTips.length)]}</p>
          </div>

          {isLikelyStuck && (
            <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-500/10 p-3">
              <p className="text-sm text-amber-100">
                This is taking longer than expected. If your wallet isn’t connected yet, you can continue in practice mode.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => router.push("/rider?mode=practice")}
                  className="rounded-md bg-amber-300/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-200"
                >
                  Open Practice Mode
                </button>
                <button
                  onClick={() => router.push("/rider")}
                  className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:text-white"
                >
                  Back to Classes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!classData || !classData.route) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">Route not found</p>
          <button
            onClick={exitRide}
            className="text-white/60 hover:text-white text-sm"
          >
            ← Back to classes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black"
      style={{ height: deviceType === "mobile" ? `${viewportHeight}px` : "100vh" }}
    >
      {/* Full-Screen Visualization */}
      <div className="absolute inset-0">
        {viewMode === "focus" ? (
          <FocusRouteVisualizer
            elevationProfile={routeElevationProfile}
            storyBeats={classData.route.route.storyBeats}
            progress={routeProgress}
            currentPower={telemetry.power}
            recentPower={recentPowerHistory}
            ftp={Math.max(classData?.metadata?.rewards?.threshold ?? 200, 200)}
            theme={routeTheme}
            stats={{ hr: telemetry.heartRate, power: telemetry.power, cadence: telemetry.cadence }}
            avatarId={searchParams.get("avatarId") || undefined}
            equipmentId={searchParams.get("equipmentId") || undefined}
            routeName={classData.metadata?.route.name || classData.name}
            routeStartCoordinate={routeCoordinates[0] ?? null}
            currentCoordinate={currentRouteCoordinate}
            intervalPhase={currentInterval?.phase ?? null}
            className="h-full w-full"
            panelState={panelState.state}
            onTogglePanel={handleTogglePanel}
            useAccordion={deviceType === "mobile"}
            onExpandOne={panelState.expandOne}
            onHaptic={deviceType === "mobile" ? haptic.trigger : undefined}
          />
        ) : (
          <RouteVisualizer
            elevationProfile={routeElevationProfile}
            theme={routeTheme}
            storyBeats={classData.route.route.storyBeats}
            progress={routeProgress}
            mode={visualizerMode}
            stats={{ hr: telemetry.heartRate, power: telemetry.power, cadence: telemetry.cadence }}
            avatarId={searchParams.get("avatarId") || undefined}
            equipmentId={searchParams.get("equipmentId") || undefined}
            quality={deviceType === "mobile" ? "low" : "high"}
            className="h-full w-full"
          />
        )}

        {/* Mini Stats Bar - Mobile: Always visible during ride */}
        {isRiding && deviceType === "mobile" && (
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl px-4 py-2 pointer-events-none z-40">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Time</span>
                <span className="text-sm font-bold text-white">{formatTime(elapsedTime)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Progress</span>
                <span className="text-sm font-bold text-white">{Math.round(rideProgress)}%</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {telemetry.heartRate > 0 && (
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-white/40">HR</span>
                  <span className="text-sm font-bold text-rose-400">{telemetry.heartRate}</span>
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Watts</span>
                <span className="text-sm font-bold text-yellow-400">{telemetry.power}</span>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar - Segmented by workout intervals */}
        <div className="absolute inset-x-0 bottom-0 h-2 sm:h-3 bg-black/50 flex">
          {workoutPlan ? (
            workoutPlan.intervals.map((interval, i) => {
              const widthPct = (interval.durationSeconds / workoutPlan.totalDuration) * 100;
              const isCurrent = i === currentIntervalIndex;
              const isComplete = i < currentIntervalIndex;
              const phaseColor = interval.phase === 'sprint' ? 'bg-red-500'
                : interval.phase === 'interval' ? 'bg-yellow-500'
                  : interval.phase === 'warmup' ? 'bg-green-500'
                    : interval.phase === 'recovery' ? 'bg-blue-500'
                      : interval.phase === 'cooldown' ? 'bg-indigo-400'
                        : 'bg-purple-500';
              return (
                <div
                  key={i}
                  className="relative h-full border-r border-black/30 last:border-r-0"
                  style={{ width: `${widthPct}%` }}
                >
                  <div
                    className={`h-full transition-all duration-300 ${phaseColor} ${isComplete ? 'opacity-100' : isCurrent ? 'opacity-80' : 'opacity-20'
                      }`}
                    style={{ width: isCurrent ? `${intervalProgress * 100}%` : isComplete ? '100%' : '0%' }}
                  />
                  {isCurrent && (
                    <div className="absolute top-0 right-0 bottom-0 w-0.5 bg-white animate-pulse"
                      style={{ left: `${intervalProgress * 100}%` }} />
                  )}
                </div>
              );
            })
          ) : (
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
              style={{ width: `${rideProgress}%` }}
            />
          )}
        </div>
      </div>

      {/* HUD Overlay */}
      {showHUD && (
        <div className="absolute inset-0 pointer-events-none z-30">
          {/* Top Bar - Mobile Optimized */}
          <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/90 to-transparent p-3 sm:p-6 pointer-events-auto safe-top z-[45]">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex-1 min-w-0 z-50 relative">
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-lg sm:text-2xl font-bold text-white truncate">
                    {classData.name}
                  </h1>
                  {isPracticeMode && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Practice
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-white/60 truncate">
                  {classData.instructor}
                </p>
                {(isRiding || rideProgress > 0) && (
                  <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[11px] text-white/80">
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      bleConnected ? "bg-emerald-400" : useSimulator ? "bg-amber-400" : "bg-zinc-400"
                    }`} />
                    {bleConnected ? "Live telemetry" : useSimulator ? (isTrainingMode ? "Training Mode" : "Simulator telemetry") : "No telemetry"}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 ml-2">
                {/* Training Mode Toggle - allow wallet-connected users to test experience */}
                {!isRiding && walletConnected && !isPracticeMode && (
                  <button
                    onClick={() => setUseSimulator(!useSimulator)}
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium backdrop-blur transition-all border ${
                      useSimulator
                        ? "border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                        : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
                    }`}
                    title={useSimulator ? "Disable Training Mode" : "Enable Training Mode to test experience without bike"}
                  >
                    <span className={useSimulator ? "animate-pulse" : ""}>🎯</span>
                    <span className="hidden sm:inline">{useSimulator ? "Training" : "Train?"}</span>
                    {useSimulator && <span className="text-amber-400/60 ml-0.5 text-[9px]">No rewards</span>}
                  </button>
                )}
                {/* Training Mode Badge - shown when simulator is active in a paid class with wallet connected */}
                {isTrainingMode && !isRiding && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] font-medium text-amber-300 backdrop-blur animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Training Mode
                    <span className="text-amber-400/60 ml-1">Rewards Disabled</span>
                  </div>
                )}
                {/* Reward Mode Selector (pre-ride) / Active Mode Badge (during ride) */}
                {!isRiding ? (
                  <div className="flex items-center gap-1" title={isGuestMode ? "Connect wallet to earn rewards" : undefined}>
                    {(["zk-batch", "yellow-stream"] as RewardMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          if (isGuestMode) return;
                          if (m === "yellow-stream" && !walletConnected) return;
                          if (isTrainingMode && m === "yellow-stream") return; // Disable yellow-stream in training mode
                          setRewardMode(m);
                        }}
                        disabled={isGuestMode || (m === "yellow-stream" && !walletConnected) || (isTrainingMode && m === "yellow-stream")}
                        className={`rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-medium backdrop-blur transition-all min-h-[36px] ${
                          rewardMode === m
                            ? "bg-white/20 text-white border border-white/30"
                            : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10 hover:text-white/60"
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        {m === "zk-batch" ? "Standard" : "Live"}
                        {m === "yellow-stream" && (
                          <>
                            <span className="ml-1 text-[8px] text-yellow-400">β</span>
                            {rewardMode === "yellow-stream" && (
                              <span
                                className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${
                                  rewards.clearNodeConnected ? "bg-emerald-400" : "bg-zinc-500"
                                }`}
                                title={rewards.clearNodeConnected ? "Connection Active" : "Offline"}
                              />
                            )}
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-[10px] font-medium text-white/80 backdrop-blur">
                    {rewardMode === "yellow-stream" ? (
                      <>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          rewards.clearNodeConnected ? "bg-yellow-400 animate-pulse" : "bg-zinc-500"
                        }`} />
                        <span className="text-yellow-300">Live</span>
                        {rewards.formattedReward !== "0" && (
                          <span className="text-yellow-400 font-bold">{rewards.formattedReward} SPIN</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        <span className="text-indigo-300">Standard</span>
                        {rewards.formattedReward !== "0" ? (
                          <span className="text-indigo-200 font-bold">{rewards.formattedReward} SPIN</span>
                        ) : rewards.isActive ? (
                          <span className="text-indigo-300/60 italic">Processing…</span>
                        ) : null}
                      </>
                    )}
                  </div>
                )}
                {/* Collapse/Expand All Panels */}
                <button
                  onClick={() => {
                    if (panelState.isAllCollapsed) {
                      panelState.expandAll();
                    } else {
                      panelState.collapseAll();
                    }
                  }}
                  className="hidden sm:inline-flex rounded-lg bg-white/10 px-3 py-2 text-xs sm:text-sm text-white/60 hover:bg-white/20 backdrop-blur active:scale-95 transition-all touch-manipulation min-h-[44px]"
                  aria-label={panelState.isAllCollapsed ? "Expand all panels" : "Collapse all panels"}
                  title="Press C to toggle (keyboard shortcut)"
                >
                  {panelState.isAllCollapsed ? "▢ Expand" : "▤ Collapse"}
                </button>
                {/* Reset UI prefs (useful for testing / getting back to defaults) */}
                <button
                  onClick={() => {
                    try {
                      window.localStorage.removeItem("spinchain:ride:viewMode");
                      window.localStorage.removeItem("spinchain:ride:hudMode");
                    } catch {
                      // ignore
                    }

                    hudModePreferenceRef.current = "system";
                    viewModePreferenceRef.current = "system";
                    applyHudMode(
                      getSystemHudMode(deviceType, orientation, prefersReducedMotion),
                      "system",
                    );
                    applyViewMode(
                      getSystemViewMode(deviceType, performanceTier, prefersReducedMotion),
                      "system",
                    );
                    panelState.reset();
                  }}
                  className="hidden sm:inline-flex rounded-lg bg-white/10 px-3 py-2 text-xs sm:text-sm text-white/60 hover:bg-white/20 backdrop-blur active:scale-95 transition-all touch-manipulation min-h-[44px]"
                  aria-label="Reset ride UI preferences"
                >
                  Reset
                </button>
                {/* View mode status badge (mobile only, non-interactive) */}
                <span className="sm:hidden inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/50">
                  {viewMode === "focus" ? "2D" : "3D"}
                </span>
                {/* View Mode Toggle */}
                <button
                  onClick={() => applyViewMode(viewMode === "immersive" ? "focus" : "immersive", "manual")}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs sm:text-sm text-white/70 hover:bg-white/20 backdrop-blur active:scale-95 transition-all touch-manipulation min-h-[44px]"
                  aria-label="Toggle view mode"
                >
                  {viewMode === "immersive" ? "→ 2D" : "→ 3D"}
                </button>
                {/* HUD Mode Toggle (Mobile) */}
                {deviceType === "mobile" && (
                  <button
                    onClick={cycleHudMode}
                    className="rounded-lg bg-white/10 p-2 sm:p-2.5 text-white/70 hover:bg-white/20 backdrop-blur active:scale-95 transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Toggle HUD"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                )}

                {/* Exit Button */}
                <button
                  onClick={exitRide}
                  disabled={isExiting}
                  className="rounded-lg bg-white/10 p-2 sm:p-2.5 text-white/70 hover:bg-white/20 backdrop-blur active:scale-95 transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Exit ride"
                >
                  {isExiting ? (
                    <svg
                      className="animate-spin h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray="4 4"
                        opacity="0.3"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray="15 45"
                        opacity="0.8"
                      />
                      <circle cx="12" cy="12" r="2" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Center - Telemetry (Responsive Layout) - Only show when riding */}
          {(!isRiding || deviceType !== "mobile" || widgetsVisible) && (
          <RideHUD
            telemetry={telemetry}
            deviceType={deviceType}
            orientation={orientation}
            hudMode={hudMode}
            isRiding={isRiding}
            rideProgress={rideProgress}
            rewardsActive={rewards.isActive}
            rewardsStreamState={rewards.streamState ?? null}
            rewardsMode={rewards.mode}
            intervalPhase={currentInterval?.phase ?? null}
            aiLog={aiLogs[0]}
            ghostState={ghostState}
          />
          )}

          {/* Bottom - Controls (Mobile Optimized) */}
          {deviceType === "mobile" && isRiding && (
            // Floating toggle button to show/hide widgets on mobile
            <button
              onClick={() => {
                haptic.trigger("light");
                setWidgetsVisible(!widgetsVisible);
              }}
              className="absolute right-4 bottom-24 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-black/70 backdrop-blur-xl border border-white/20 shadow-lg transition-transform active:scale-95"
              aria-label={widgetsVisible ? "Hide widgets" : "Show widgets"}
            >
              {widgetsVisible ? (
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          )}
          <div className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent pointer-events-auto safe-bottom transition-all duration-300 ${deviceType === "mobile" && isRiding && !widgetsVisible ? "translate-y-full opacity-0" : ""} ${isRiding && useSimulator && deviceType === "mobile" ? "pb-52 pt-3 px-3" : "p-3 sm:p-6"} ${!isRiding && deviceType === "desktop" ? "sm:max-h-[50vh] sm:flex sm:flex-col" : ""}`}>
            <div className={`max-w-7xl mx-auto ${!isRiding && deviceType === "desktop" ? "overflow-y-auto flex-1 min-h-0" : ""}`}>
              {/* Progress Info + Interval Status */}
              {hudMode !== "minimal" && (
                <div className="mb-3 sm:mb-4">
                  {/* Current Interval Banner */}
                  {isRiding && currentInterval && (
                    <div className="mb-2 flex items-center justify-between rounded-lg bg-black/60 backdrop-blur border border-white/10 px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${currentInterval.phase === 'sprint' ? 'bg-red-500'
                          : currentInterval.phase === 'interval' ? 'bg-yellow-500'
                            : currentInterval.phase === 'warmup' ? 'bg-green-500'
                              : currentInterval.phase === 'recovery' ? 'bg-blue-500'
                                : currentInterval.phase === 'cooldown' ? 'bg-indigo-400'
                                  : 'bg-purple-500'
                          }`} />
                        <span className="text-xs sm:text-sm font-semibold text-white uppercase tracking-wider">
                          {currentInterval.phase}
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm font-mono text-white/70">
                        {formatTime(Math.ceil(intervalRemaining))} left
                      </span>
                      {/* Coming up next */}
                      {workoutPlan && currentIntervalIndex < workoutPlan.intervals.length - 1 && (() => {
                        const next = workoutPlan.intervals[currentIntervalIndex + 1];
                        return (
                          <span className="hidden sm:flex items-center gap-1 text-[10px] text-white/40">
                            <span>Next:</span>
                            <span className={`font-semibold ${
                              next.phase === 'sprint' ? 'text-red-400'
                              : next.phase === 'recovery' ? 'text-blue-400'
                              : next.phase === 'interval' ? 'text-yellow-400'
                              : 'text-white/60'
                            }`}>{next.phase}</span>
                            <span>{formatTime(next.durationSeconds)}</span>
                          </span>
                        );
                      })()}
                      {/* Target RPM zone comparison */}
                      {currentInterval.targetRpm && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/40">RPM</span>
                          <span className={`text-xs font-bold ${telemetry.cadence >= currentInterval.targetRpm[0] && telemetry.cadence <= currentInterval.targetRpm[1]
                            ? 'text-green-400'
                            : telemetry.cadence < currentInterval.targetRpm[0]
                              ? 'text-blue-400'
                              : 'text-red-400'
                            }`}>
                            {telemetry.cadence}
                            <span className="text-white/30 font-normal"> / {currentInterval.targetRpm[0]}-{currentInterval.targetRpm[1]}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Feedback - below interval phase banner */}
                  {isRiding && aiActive && (
                    <div className="mb-2">
                      <div className="rounded-xl border border-indigo-500/25 bg-black/70 backdrop-blur-xl px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">🧠</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                            {agentName}
                          </span>
                          <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                            reasonerState === "thinking"
                              ? "bg-amber-500/20 text-amber-300"
                              : reasonerState === "acting"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-white/10 text-white/40"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              reasonerState === "thinking"
                                ? "bg-amber-400 animate-pulse"
                                : reasonerState === "acting"
                                  ? "bg-emerald-400 animate-pulse"
                                  : "bg-white/30"
                            }`} />
                            {reasonerState === "thinking" ? "Reasoning…" : reasonerState === "acting" ? "Acting" : "Monitoring"}
                          </span>
                        </div>
                        {lastDecision ? (
                          <p className="text-[11px] leading-relaxed text-white/70 line-clamp-2">
                            &ldquo;{lastDecision.thoughtProcess}&rdquo;
                          </p>
                        ) : thoughtLog.length > 0 ? (
                          <p className="text-[11px] leading-relaxed text-white/70 line-clamp-2">
                            &ldquo;{thoughtLog[0]}&rdquo;
                          </p>
                        ) : (
                          <p className="text-[11px] text-white/40 italic">
                            Analyzing telemetry stream…
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Main stats row */}
                  <div className="flex items-center justify-between text-white">
                    <div className="text-left">
                      <p className="text-[10px] sm:text-sm text-white/50">Progress</p>
                      <p className="text-xl sm:text-2xl font-bold">{rideProgress.toFixed(0)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] sm:text-sm text-white/50">Time</p>
                      <div className="flex items-center gap-2 justify-center">
                        <p className="text-xl sm:text-2xl font-bold">{formatTime(elapsedTime)}</p>
                        {isRiding && (
                          <button
                            onClick={pauseRide}
                            className="rounded-full bg-white/20 backdrop-blur px-3 py-1 text-xs font-semibold text-white transition-all active:scale-95 touch-manipulation"
                            aria-label="Pause ride"
                          >
                            ⏸ Pause
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] sm:text-sm text-white/50">Effort</p>
                      <p className="text-xl sm:text-2xl font-bold text-purple-400">{telemetry.effort}</p>
                    </div>
                  </div>
                </div>
              )}

              <RideControls
                isRiding={isRiding}
                isStarting={isStarting}
                rideProgress={rideProgress}
                isPracticeMode={isPracticeMode}
                isTrainingMode={isTrainingMode}
                useSimulator={useSimulator}
                deviceType={deviceType}
                workoutPlan={workoutPlan}
                bleConnected={bleConnected}
                walletConnected={walletConnected}
                canStartRide={bleConnected || useSimulator}
                startHint={connectionHint}
                onStartRide={startRide}
                onPauseRide={pauseRide}
                onSetWorkoutPlan={setWorkoutPlan}
                onSetUseSimulator={setUseSimulator}
                onBleMetrics={handleBleMetrics}
                onSimulatorMetrics={handleSimulatorMetrics}
                onHaptic={haptic.trigger}
                panelState={panelState.state}
                onTogglePanel={handleTogglePanel}
              />

              {/* Agent Reasoning HUD moved above interval banner - removed from here */}

              {/* Coach voice indicator */}
              {isRiding && isSpeaking && (
                <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] text-indigo-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  Speaking
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Coach message text overlay — shown for 4s after any spoken cue */}
      {lastCoachMessage && isRiding && !currentBeat && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none px-4 w-full max-w-[90%] sm:max-w-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="rounded-2xl border border-white/15 bg-black/75 backdrop-blur-xl px-5 py-3 text-center shadow-lg">
            <p className="text-sm sm:text-base font-semibold text-white leading-snug">&ldquo;{lastCoachMessage}&rdquo;</p>
          </div>
        </div>
      )}

      {/* Sprint flash border — pulses red on sprint phase entry */}
      {isRiding && currentInterval?.phase === 'sprint' && (
        <div className="absolute inset-0 pointer-events-none rounded-none border-4 border-red-500/60 animate-pulse" />
      )}

      {/* Story Beat Alert - Mobile Optimized */}
      {currentBeat && isRiding && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none px-4 w-full max-w-[90%] sm:max-w-md">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-black/85 p-6 text-center shadow-[0_32px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8">
            <div
              className={`absolute inset-0 opacity-60 ${
                currentBeat.type === "climb"
                  ? "bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.25),_transparent_60%)]"
                  : currentBeat.type === "sprint"
                    ? "bg-[radial-gradient(circle_at_top,_rgba(251,113,133,0.28),_transparent_60%)]"
                    : "bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.24),_transparent_60%)]"
              }`}
            />
            <div className="relative">
              <div className="mb-2 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/45">
                <span>Story Beat</span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span>{routeTheme}</span>
              </div>
              <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border ${
                currentBeat.type === "climb"
                  ? "border-yellow-400/35 bg-yellow-500/10 text-yellow-300"
                  : currentBeat.type === "sprint"
                    ? "border-rose-400/35 bg-rose-500/10 text-rose-300"
                    : "border-sky-400/35 bg-sky-500/10 text-sky-300"
              }`}>
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {currentBeat.type === "climb" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 16l5-8 3 4 6-8" />
                  ) : currentBeat.type === "sprint" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12h10M12 7v10" />
                  )}
                </svg>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">{currentBeat.label}</h2>
              <p className="text-sm uppercase tracking-[0.28em] text-white/60">{currentBeat.type}</p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-xs text-white/72">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Phase</div>
                  <div className="mt-1 text-sm font-semibold text-white">{currentInterval?.phase ?? "Cruise"}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Progress</div>
                  <div className="mt-1 text-sm font-semibold text-white">{rideProgress.toFixed(0)}%</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Effort</div>
                  <div className="mt-1 text-sm font-semibold text-white">{telemetry.effort}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completion Modal - Mobile Optimized */}
      {rideProgress >= 100 && (
        <RideCompletion
          isPracticeMode={isPracticeMode}
          elapsedTime={elapsedTime}
          avgHeartRate={telemetryAverages.avgHr}
          avgPower={telemetryAverages.avgPower}
          avgEffort={telemetryAverages.avgEffort}
          telemetrySource={bleConnected ? "live-bike" : useSimulator ? "simulator" : "estimated"}
          onExit={exitRide}
          onRideAgain={() => router.push(`/rider/ride/${classId}`)}
          onShare={() => {
            if (typeof window === "undefined") return;
            const spinText = isTrainingMode ? "Training Mode" : `${rewards.formattedReward} SPIN`;
            const text = `Just finished ${classData?.name || "a SpinChain ride"} — ${telemetryAverages.avgEffort}/1000 effort, ${spinText}.`;
            if (navigator.share) {
              navigator.share({ title: "SpinChain Ride Complete", text, url: window.location.origin + "/rider/journey" }).catch(() => {});
              return;
            }
            navigator.clipboard.writeText(text).catch(() => {});
          }}
          onDeploy={isPracticeMode ? () => router.push("/instructor/builder") : undefined}
          onUpgrade={!isPracticeMode && !isTrainingMode ? () => router.push("/rider/journey?upgrade=analytics") : undefined}
          onClaimRewards={!isPracticeMode && !isTrainingMode ? handleClaimRewards : undefined}
          zkProofStatus={!isPracticeMode && !isTrainingMode ? { isGenerating: isGeneratingProof, isSuccess: zkSuccess, privacyScore, privacyLevel, error: zkError } : undefined}
          spinEarned={isTrainingMode ? "0" : rewards.formattedReward}
          agentName={agentName}
          agentPersonality={aiPersonality || "data"}
          syncStatus={completionSyncStatus}
          primaryAction={completionPrimaryAction}
          onExportTCX={() => {
            downloadTCX({
              id: classId,
              name: classData?.name || "SpinChain Ride",
              startTime: classData?.startTime ? classData.startTime * 1000 : Date.now(),
              instructor: classData?.instructor,
            }, ridePointsRef.current);
          }}
        />
      )}

      {/* Demo Complete Modal */}
      <DemoCompleteModal
        isOpen={showDemoModal}
        onClose={handleDemoModalClose}
        stats={demoStats}
      />

      {/* Onboarding Tutorial Overlay */}
      {showTutorial && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-500 p-6">
          <div className={`absolute ${tutorialSteps[tutorialStep].position} max-w-sm w-full transform transition-all duration-500 scale-100 opacity-100`}>
            <div className="rounded-3xl border border-white/20 bg-indigo-600/90 p-8 shadow-[0_20px_50px_rgba(79,70,229,0.3)] backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">
                  Step {tutorialStep + 1} of {tutorialSteps.length}
                </span>
                <button 
                  onClick={() => setShowTutorial(false)}
                  className="text-indigo-200 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                {tutorialSteps[tutorialStep].title}
              </h3>
              <p className="text-indigo-50/80 leading-relaxed mb-8">
                {tutorialSteps[tutorialStep].content}
              </p>
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => setShowTutorial(false)}
                  className="text-sm font-medium text-indigo-200 hover:text-white transition-colors"
                >
                  Skip tutorial
                </button>
                <button
                  onClick={nextTutorial}
                  className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-indigo-600 shadow-xl shadow-white/10 hover:bg-indigo-50 active:scale-95 transition-all"
                >
                  <span>{tutorialStep === tutorialSteps.length - 1 ? "Got it!" : "Next"}</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Visual indicator arrow pointing to the actual UI element could be added here */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[16px] border-t-indigo-600/90 opacity-0 sm:opacity-100" />
          </div>
        </div>
      )}

    </div>
  );
}
