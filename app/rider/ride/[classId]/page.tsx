"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useClass, createPracticeClassMetadata, generateMockRouteData, type ClassWithRoute } from "../../../hooks/evm/use-class-data";
import dynamic from "next/dynamic";
import FocusRouteVisualizer from "../../../components/features/route/focus-route-visualizer";
import { useAccount } from "wagmi";

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
import { useZKClaim } from "../../../hooks/evm/use-zk-claim";
import { ANALYTICS_EVENTS, trackEvent } from "../../../lib/analytics/events";
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
  const deviceType = useDeviceType();
  const orientation = useOrientation();
  const viewportHeight = useActualViewportHeight();
  const performanceTier = usePerformanceTier();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

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
      title: "Welcome to the HUD",
      content: "This is your control center. Track your power, cadence, and heart rate in real-time.",
      position: "top-1/4 left-1/2 -translate-x-1/2",
    },
    {
      title: "Effort Score",
      content: "The Effort Score (bottom right) is what determines your SPIN rewards. Keep it high to earn more!",
      position: "top-20 right-10",
    },
    {
      title: "ZK Privacy",
      content: "Notice the shield icon? Your raw health data never leaves this device. Only a private proof is sent to the blockchain.",
      position: "bottom-40 right-10",
    },
    {
      title: "Ready to Start?",
      content: "Link your device or use the simulator to begin your ride.",
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
  const [useSimulator, setUseSimulator] = useState(false);
  const [connectionHint, setConnectionHint] = useState<string | null>(null);

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
  });
  const [recentPowerHistory, setRecentPowerHistory] = useState<number[]>([]);
  const telemetryRawRef = useRef({
    heartRate: 0,
    power: 0,
    cadence: 0,
    speed: 0,
    effort: 0,
  });
  const lastTelemetryCommitMsRef = useRef(0);
  const trackedEntryViewRef = useRef(false);
  const trackedLiveTelemetryRef = useRef(false);
  const trackedCompletionRef = useRef(false);

  // Telemetry averages for completion screen
  const telemetrySamples = useRef<{ hr: number; power: number; effort: number }[]>([]);
  const routeCoordinates = useMemo(
    () => classData?.route?.route.coordinates ?? [],
    [classData?.route?.route.coordinates],
  );
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

  // Audio hooks
  const aiPersonality = classData?.metadata?.ai?.personality;
  const coachPersonality = aiPersonality === 'drill-sergeant' ? 'drill' : aiPersonality === 'zen' ? 'zen' : 'data';
  const { playSound, playCountdown, stopAll: stopAudio, isConfigured: audioConfigured } = useWorkoutAudio();
  const { speak, stop: stopVoice, isSpeaking } = useCoachVoice({
    personality: coachPersonality,
    intensity: rideProgress / 100,
  });

  // AI Instructor
  const agentName = classData?.instructor || 'Coach';
  const { logs: aiLogs, isActive: aiActive, setIsActive: setAiActive } = useAiInstructor(
    agentName,
    aiPersonality || 'data',
    null // No Sui session in practice/standalone mode
  );

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
  const { isConnected: walletConnected } = useAccount();
  const [rewardMode, setRewardMode] = useState<RewardMode>("zk-batch");

  // Guest mode — reward selector is disabled; user must connect wallet to earn
  const isGuestMode = typeof window !== "undefined" && localStorage.getItem("spin-guest-mode") === "true" && !walletConnected;

  // Rewards — mode selectable, defaults to zk-batch
  const rewards = useRewards({
    mode: rewardMode,
    classId: classId as string,
    instructor: (classData?.instructor as `0x${string}`) || "0x0",
    depositAmount: BigInt(0), // Demo mode - no real deposit required
  });

  // Demo complete modal state
  const [showDemoModal, setShowDemoModal] = useState(false);
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

  // Track interval transitions for audio cues
  const lastIntervalRef = useRef<number>(-1);

  // Commit buffered telemetry into React state at a fixed rate to reduce rerenders
  useEffect(() => {
    if (!isRiding) return;

    const uiHz = deviceType === "mobile" ? 2 : 4;
    const intervalMs = Math.floor(1000 / uiHz);

    const id = setInterval(() => {
      const now = Date.now();
      if (now - lastTelemetryCommitMsRef.current < intervalMs) return;
      lastTelemetryCommitMsRef.current = now;
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
  }) => {
    // Buffer raw telemetry (do not trigger React rerender here)
    telemetryRawRef.current = {
      heartRate: metrics.heartRate ?? telemetryRawRef.current.heartRate,
      power: metrics.power ?? telemetryRawRef.current.power,
      cadence: metrics.cadence ?? telemetryRawRef.current.cadence,
      speed: metrics.speed ?? telemetryRawRef.current.speed,
      effort: metrics.effort ?? telemetryRawRef.current.effort,
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
    if (isRiding && rewards.isActive && (metrics.heartRate || metrics.power)) {
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
  }) => {

    telemetryRawRef.current = metrics;
    // Simulator is a user-driven control; update UI immediately for responsiveness
    setTelemetry(metrics);

    // Also update ride progress based on cadence
    if (isRiding && classData) {
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
      return rideProgress >= beatProgress && rideProgress < beatProgress + 1;
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
  }, [currentBeat, isRiding, playSound, speak]);

  // Activate AI instructor when riding
  useEffect(() => {
    setAiActive(isRiding && !!classData?.metadata?.ai?.enabled);
  }, [isRiding, classData?.metadata?.ai?.enabled, setAiActive]);

  // Speak AI instructor actions
  useEffect(() => {
    if (aiLogs.length === 0) return;
    const latest = aiLogs[0];
    if (latest.type === 'action' && !isSpeaking) {
      speak(latest.message, 'intense');
    }
  }, [aiLogs, isSpeaking, speak]);

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
    try {
      await rewards.startEarning();
      console.log("[Ride] Rewards channel opened, mode:", rewardMode);
    } catch (err) {
      // Non-blocking — guest users can still ride without earning
      console.warn("[Ride] Rewards init skipped:", err);
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

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 sm:h-16 sm:w-16 mx-auto animate-spin rounded-full border-4 border-white/20 border-t-white mb-4" />
          <p className="text-sm sm:text-base text-white/60">Loading route...</p>
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
        <div className="absolute inset-0 pointer-events-none">
          {/* Top Bar - Mobile Optimized */}
          <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/90 to-transparent p-3 sm:p-6 pointer-events-auto safe-top">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex-1 min-w-0">
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
                      bleConnected ? "bg-emerald-400" : (isPracticeMode && useSimulator) ? "bg-amber-400" : "bg-zinc-400"
                    }`} />
                    {bleConnected ? "Live telemetry" : (isPracticeMode && useSimulator) ? "Simulator telemetry" : "No telemetry"}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 ml-2">
                {/* Reward Mode Selector (pre-ride) / Active Mode Badge (during ride) */}
                {!isRiding ? (
                  <div className="flex items-center gap-1" title={isGuestMode ? "Connect wallet to earn rewards" : undefined}>
                    {(["zk-batch", "yellow-stream"] as RewardMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          if (isGuestMode) return;
                          if (m === "yellow-stream" && !walletConnected) return;
                          setRewardMode(m);
                        }}
                        disabled={isGuestMode || (m === "yellow-stream" && !walletConnected)}
                        className={`rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-medium backdrop-blur transition-all min-h-[36px] ${
                          rewardMode === m
                            ? "bg-white/20 text-white border border-white/30"
                            : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10 hover:text-white/60"
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        {m === "zk-batch" ? "ZK" : "Yellow"}
                        {m === "yellow-stream" && (
                          <>
                            <span className="ml-1 text-[8px] text-yellow-400">β</span>
                            {rewardMode === "yellow-stream" && (
                              <span
                                className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${
                                  rewards.clearNodeConnected ? "bg-emerald-400" : "bg-zinc-500"
                                }`}
                                title={rewards.clearNodeConnected ? "ClearNode connected" : "ClearNode offline"}
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
                        <span className="text-yellow-300">Yellow</span>
                        {rewards.formattedReward !== "0" && (
                          <span className="text-yellow-400 font-bold">{rewards.formattedReward} SPIN</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        <span className="text-indigo-300">ZK</span>
                        {rewards.formattedReward !== "0" ? (
                          <span className="text-indigo-200 font-bold">{rewards.formattedReward} SPIN</span>
                        ) : rewards.isActive ? (
                          <span className="text-indigo-300/60 italic">Proof pending…</span>
                        ) : null}
                      </>
                    )}
                  </div>
                )}
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
          />

          {/* Bottom - Controls (Mobile Optimized) */}
          <div className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent pointer-events-auto safe-bottom ${isRiding && useSimulator && deviceType === "mobile" ? "pb-52 pt-3 px-3" : "p-3 sm:p-6"}`}>
            <div className="max-w-7xl mx-auto">
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
                            &ldquo;{lastDecision.reasoning || lastDecision.thoughtProcess}&rdquo;
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
                useSimulator={useSimulator}
                deviceType={deviceType}
                workoutPlan={workoutPlan}
                bleConnected={bleConnected}
                canStartRide={bleConnected || useSimulator}
                startHint={connectionHint}
                onStartRide={startRide}
                onPauseRide={pauseRide}
                onSetWorkoutPlan={setWorkoutPlan}
                onSetUseSimulator={setUseSimulator}
                onBleMetrics={handleBleMetrics}
                onSimulatorMetrics={handleSimulatorMetrics}
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
          telemetrySource={bleConnected ? "live-bike" : (isPracticeMode && useSimulator) ? "simulator" : "estimated"}
          onExit={exitRide}
          onDeploy={isPracticeMode ? () => router.push("/instructor/builder") : undefined}
          onUpgrade={!isPracticeMode ? () => router.push("/rider/journey?upgrade=analytics") : undefined}
          onClaimRewards={!isPracticeMode ? handleClaimRewards : undefined}
          zkProofStatus={!isPracticeMode ? { isGenerating: isGeneratingProof, isSuccess: zkSuccess, privacyScore, privacyLevel, error: zkError } : undefined}
          spinEarned={rewards.formattedReward}
          agentName={agentName}
          agentPersonality={aiPersonality || "data"}
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
