"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useClass, createPracticeClassMetadata, generateMockRouteData, type ClassWithRoute } from "../../../hooks/evm/use-class-data";
import dynamic from "next/dynamic";
import FocusRouteVisualizer from "../../../components/features/route/focus-route-visualizer";

const RouteVisualizer = dynamic(
  () => import("../../../components/features/route/route-visualizer"),
  { ssr: false }
);
import { DeviceSelector } from "../../../components/features/ble/device-selector";
import { useDeviceType, useOrientation, useActualViewportHeight } from "../../../lib/responsive";
import { useWorkoutAudio } from "../../../hooks/ai/use-workout-audio";
import { useCoachVoice } from "../../../hooks/common/use-coach-voice";
import { useAiInstructor } from "../../../hooks/ai/use-ai-instructor";
import { useRewards, REWARD_MODES } from "../../../hooks/rewards/use-rewards";
import { YellowRewardTicker } from "../../../components/features/common/yellow-reward-ticker";
import { DemoCompleteModal } from "../../../components/features/common/demo-complete-modal";
import { PedalSimulator } from "../../../components/features/common/pedal-simulator";
import {
  type WorkoutPlan,
  type WorkoutInterval,
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

  // Ride state
  const [isRiding, setIsRiding] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [rideProgress, setRideProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showHUD, setShowHUD] = useState(true);
  const [hudMode, setHudMode] = useState<"full" | "compact" | "minimal">("full");
  const [viewMode, setViewMode] = useState<"immersive" | "focus">(
    deviceType === "mobile" ? "focus" : "immersive"
  );

  // BLE Device Connection
  const [bleConnected, setBleConnected] = useState(false);
  const [useSimulator, setUseSimulator] = useState(false);

  // Reset simulator mode when not in practice mode
  useEffect(() => {
    if (!isPracticeMode && useSimulator) {
      setUseSimulator(false);
    }
  }, [isPracticeMode, useSimulator]);

  // Telemetry (buffer raw updates in refs; commit to React state at a UI rate for mobile perf)
  const [telemetry, setTelemetry] = useState({
    heartRate: 0,
    power: 0,
    cadence: 0,
    speed: 0,
    effort: 0,
  });
  const telemetryRawRef = useRef({
    heartRate: 0,
    power: 0,
    cadence: 0,
    speed: 0,
    effort: 0,
  });
  const lastTelemetryCommitMsRef = useRef(0);

  // Telemetry averages for completion screen
  const telemetrySamples = useRef<{ hr: number; power: number; effort: number }[]>([]);

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
  const { logs: aiLogs, isActive: aiActive, setIsActive: setAiActive } = useAiInstructor(
    classData?.instructor || 'Coach',
    aiPersonality || 'data',
    null // No Sui session in practice/standalone mode
  );

  // Yellow Rewards - Real-time streaming
  const rewards = useRewards({
    mode: "yellow-stream",
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

  // Handle simulator metrics updates (PRACTICE MODE ONLY - prevents cheating in real classes)
  const handleSimulatorMetrics = (metrics: {
    heartRate: number;
    power: number;
    cadence: number;
    speed: number;
    effort: number;
  }) => {
    // Security check: only allow simulator in practice mode
    if (!isPracticeMode) {
      console.warn('[Security] Simulator metrics rejected - not in practice mode');
      return;
    }

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

  // Auto-adjust HUD + default view mode based on device
  useEffect(() => {
    if (deviceType === "mobile") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHudMode("compact");
      // Default to Focus mode on mobile for battery + performance
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewMode("focus");
    } else if (deviceType === "tablet") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHudMode(orientation === "portrait" ? "compact" : "full");
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHudMode("full");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewMode("immersive");
    }
  }, [deviceType, orientation]);

  // Simulate ride progress (only when BLE not connected, not using simulator, or in auto mode)
  useEffect(() => {
    if (!isRiding || !classData || bleConnected || (useSimulator && isPracticeMode)) return;

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
      if (!bleConnected && !(useSimulator && isPracticeMode)) {
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
  }, [isRiding, classData, bleConnected, useSimulator, isPracticeMode]);

  // Also collect BLE and simulator telemetry samples (simulator only in practice mode)
  useEffect(() => {
    if (isRiding && (bleConnected || (useSimulator && isPracticeMode)) && telemetry.heartRate > 0) {
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
    setIsStarting(true);
    playCountdown(3);

    // Initialize Yellow rewards channel
    try {
      await rewards.startEarning();
      console.log("[Ride] Yellow rewards channel opened");
    } catch (err) {
      console.warn("[Ride] Failed to open rewards channel:", err);
    }

    // Start ride after countdown finishes
    setTimeout(() => {
      setIsRiding(true);
      setIsStarting(false);
      setRideProgress(0);
      setElapsedTime(0);
      telemetrySamples.current = [];
      lastSpokenBeatRef.current = null;
      lastIntervalRef.current = -1;
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

    // Finalize Yellow rewards
    let spinEarned = "0";
    if (rewards.isActive) {
      try {
        const result = await rewards.finalizeRewards();
        console.log("[Ride] Rewards finalized:", result);
        spinEarned = result.amount ? (Number(result.amount) / 1e18).toFixed(1) : "0";
      } catch (err) {
        console.warn("[Ride] Failed to finalize rewards:", err);
      }
    }

    // Show demo complete modal for practice mode
    if (isPracticeMode) {
      setDemoStats({
        duration: elapsedTime,
        avgHeartRate: avgHR,
        maxHeartRate: maxHR,
        effortScore: Math.min(1000, Math.round((avgHR / 200) * 1000)),
        spinEarned: spinEarned || "12.5", // Fallback for demo
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
    setHudMode(prev =>
      prev === "full" ? "compact" :
        prev === "compact" ? "minimal" : "full"
    );
  };

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
            elevationProfile={classData.route.route.coordinates.map((c) => c.ele || 0)}
            storyBeats={classData.route.route.storyBeats}
            progress={isRiding || rideProgress > 0 ? rideProgress / 100 : 0}
            className="h-full w-full"
          />
        ) : (
          <RouteVisualizer
            elevationProfile={classData.route.route.coordinates.map((c) => c.ele || 0)}
            theme={currentInterval ? PHASE_TO_THEME[currentInterval.phase] : (classData.metadata?.route.theme as 'neon' | 'alpine' | 'mars' | 'anime' | 'rainbow') || "neon"}
            storyBeats={classData.route.route.storyBeats}
            progress={isRiding || rideProgress > 0 ? rideProgress / 100 : 0}
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
              </div>

              <div className="flex items-center gap-2 ml-2">
                {/* View Mode Toggle */}
                <button
                  onClick={() => setViewMode((v) => (v === "immersive" ? "focus" : "immersive"))}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs sm:text-sm text-white/70 hover:bg-white/20 backdrop-blur active:scale-95 transition-all touch-manipulation min-h-[44px]"
                  aria-label="Toggle view mode"
                >
                  {viewMode === "immersive" ? "3D" : "2D"}
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
          {hudMode !== "minimal" && (isRiding || rideProgress > 0) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-3 sm:p-6">
              {/* Mobile: Single Column */}
              {deviceType === "mobile" && hudMode === "compact" && (
                <div className="flex flex-col gap-2 w-full max-w-[200px]">
                  {/* Yellow Rewards Ticker */}
                  {rewards.isActive && (
                    <YellowRewardTicker
                      streamState={rewards.streamState!}
                      mode={rewards.mode}
                      symbol="SPIN"
                      compact
                    />
                  )}

                  {/* Primary Metric - Large */}
                  <div className="rounded-xl bg-black/70 backdrop-blur-xl border border-white/20 p-4 text-center">
                    <p className="text-xs uppercase tracking-wider text-white/50 mb-1">Heart Rate</p>
                    <p className="text-4xl font-bold text-red-400">
                      {telemetry.heartRate}
                    </p>
                  </div>

                  {/* Secondary Metrics - Small */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-black/60 backdrop-blur-xl border border-white/10 p-2 text-center">
                      <p className="text-[10px] sm:text-xs uppercase text-white/40">Power</p>
                      <p className="text-xl font-bold text-yellow-400">{telemetry.power}</p>
                    </div>
                    <div className="rounded-lg bg-black/60 backdrop-blur-xl border border-white/10 p-2 text-center">
                      <p className="text-[10px] sm:text-xs uppercase text-white/40">RPM</p>
                      <p className="text-xl font-bold text-blue-400">{telemetry.cadence}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tablet Portrait: 1x4 Column */}
              {deviceType === "tablet" && orientation === "portrait" && (
                <div className="flex flex-col gap-3 w-full max-w-xs">
                  {[
                    { label: "Heart Rate", value: telemetry.heartRate, unit: "bpm", color: "text-red-400" },
                    { label: "Power", value: telemetry.power, unit: "W", color: "text-yellow-400" },
                    { label: "Cadence", value: telemetry.cadence, unit: "rpm", color: "text-blue-400" },
                    { label: "Speed", value: telemetry.speed.toFixed(1), unit: "km/h", color: "text-green-400" },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-xl bg-black/60 backdrop-blur-xl border border-white/20 p-3">
                      <p className="text-xs uppercase tracking-wider text-white/50 mb-1">{metric.label}</p>
                      <p className={`text-3xl font-bold ${metric.color}`}>
                        {metric.value}
                        <span className="text-sm text-white/50 ml-2">{metric.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Desktop/Tablet Landscape: 2x2 Grid + Yellow Ticker */}
              {(deviceType === "desktop" || (deviceType === "tablet" && orientation === "landscape")) && hudMode === "full" && (
                <div className="flex flex-col gap-4">
                  {/* Yellow Rewards Ticker */}
                  {rewards.isActive && rewards.streamState && (
                    <div className="flex justify-center">
                      <YellowRewardTicker
                        streamState={rewards.streamState}
                        mode={rewards.mode}
                        symbol="SPIN"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 sm:gap-6">
                    <div className="rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 p-4 sm:p-6 min-w-[160px] sm:min-w-[180px]">
                      <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Heart Rate</p>
                      <p className="text-4xl sm:text-5xl font-bold text-red-400">
                        {telemetry.heartRate}
                        <span className="text-lg sm:text-xl text-white/50 ml-2">bpm</span>
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 p-4 sm:p-6 min-w-[160px] sm:min-w-[180px]">
                      <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Power</p>
                      <p className="text-4xl sm:text-5xl font-bold text-yellow-400">
                        {telemetry.power}
                        <span className="text-lg sm:text-xl text-white/50 ml-2">W</span>
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 p-4 sm:p-6 min-w-[160px] sm:min-w-[180px]">
                      <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Cadence</p>
                      <p className="text-4xl sm:text-5xl font-bold text-blue-400">
                        {telemetry.cadence}
                        <span className="text-lg sm:text-xl text-white/50 ml-2">rpm</span>
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 p-4 sm:p-6 min-w-[160px] sm:min-w-[180px]">
                      <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Speed</p>
                      <p className="text-4xl sm:text-5xl font-bold text-green-400">
                        {telemetry.speed.toFixed(1)}
                        <span className="text-lg sm:text-xl text-white/50 ml-2">km/h</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom - Controls (Mobile Optimized) */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-3 sm:p-6 pointer-events-auto safe-bottom">
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

                  {/* Main stats row */}
                  <div className="flex items-center justify-between text-white">
                    <div className="text-left">
                      <p className="text-[10px] sm:text-sm text-white/50">Progress</p>
                      <p className="text-xl sm:text-2xl font-bold">{rideProgress.toFixed(0)}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] sm:text-sm text-white/50">Time</p>
                      <p className="text-xl sm:text-2xl font-bold">{formatTime(elapsedTime)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] sm:text-sm text-white/50">Effort</p>
                      <p className="text-xl sm:text-2xl font-bold text-purple-400">{telemetry.effort}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pre-ride Setup */}
              {!isRiding && rideProgress === 0 && (
                <div className="mb-4 max-w-sm mx-auto space-y-3">
                  {/* Workout Plan Selector */}
                  <div className="rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Workout Plan</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {PRESET_WORKOUTS.map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => setWorkoutPlan(preset)}
                          className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-95 touch-manipulation ${workoutPlan?.id === preset.id
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                      <button
                        onClick={() => setWorkoutPlan(null)}
                        className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-95 touch-manipulation ${!workoutPlan
                          ? 'bg-indigo-500 text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                          }`}
                      >
                        Free Ride
                      </button>
                    </div>
                    {workoutPlan && (
                      <p className="mt-1.5 text-[10px] text-white/40">
                        {workoutPlan.intervals.length} intervals
                        {' · '}{Math.round(workoutPlan.totalDuration / 60)} min
                        {' · '}{workoutPlan.difficulty}
                      </p>
                    )}
                  </div>

                  {/* Input Mode Toggle - Only in Practice Mode */}
                  {isPracticeMode && (
                    <div className="rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Input Mode</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setUseSimulator(false)}
                          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all active:scale-95 touch-manipulation ${!useSimulator
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}
                        >
                          🚴 BLE Device
                        </button>
                        <button
                          onClick={() => setUseSimulator(true)}
                          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all active:scale-95 touch-manipulation ${useSimulator
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}
                        >
                          ⌨️ Simulator
                        </button>
                      </div>
                      <p className="mt-1.5 text-[10px] text-white/40">
                        {useSimulator
                          ? deviceType === 'mobile' ? 'Tap buttons to pedal' : 'Use arrow keys to pedal'
                          : 'Connect your bike via Bluetooth'
                        }
                      </p>
                    </div>
                  )}

                  {(!isPracticeMode || !useSimulator) && (
                    <DeviceSelector
                      onMetricsUpdate={handleBleMetrics}
                      className="bg-black/80 backdrop-blur-xl border-white/10"
                    />
                  )}
                </div>
              )}

              {/* Controls - Touch Optimized */}
              <div className="flex items-center justify-center gap-3">
                {!isRiding ? (
                  <button
                    onClick={startRide}
                    disabled={isStarting}
                    className="relative rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white shadow-lg shadow-indigo-500/50 transition-all active:scale-95 touch-manipulation min-h-[56px] disabled:opacity-80 disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    {isStarting ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="animate-spin"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          {/* Bike wheel with spokes */}
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
                          {/* Center hub */}
                          <circle cx="12" cy="12" r="2" fill="currentColor" />
                        </svg>
                        <span>Starting...</span>
                      </span>
                    ) : (
                      <span>{rideProgress > 0 ? "Resume" : "Start Ride"}</span>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={pauseRide}
                    className="rounded-full bg-white/20 backdrop-blur px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white transition-all active:scale-95 touch-manipulation min-h-[56px]"
                  >
                    Pause
                  </button>
                )}
              </div>

              {/* BLE Status Indicator */}
              {bleConnected && (
                <div className="mt-3 flex items-center justify-center gap-2 text-green-400 text-xs">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Live telemetry connected
                </div>
              )}

              {/* Audio/Coach Status */}
              {isRiding && (audioConfigured || aiActive) && (
                <div className="mt-2 flex items-center justify-center gap-3 text-xs">
                  {isSpeaking && (
                    <span className="flex items-center gap-1.5 text-indigo-400">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                      Coach speaking
                    </span>
                  )}
                  {aiActive && (
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      AI Active
                    </span>
                  )}
                </div>
              )}

              {/* Latest AI Coach Message */}
              {isRiding && aiLogs.length > 0 && aiLogs[0].type === 'action' && (
                <div className="mt-2 max-w-sm mx-auto">
                  <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 text-xs text-indigo-300 text-center truncate">
                    {aiLogs[0].message}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Story Beat Alert - Mobile Optimized */}
      {currentBeat && isRiding && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none px-4 w-full max-w-[90%] sm:max-w-md">
          <div className="rounded-2xl bg-black/95 backdrop-blur-xl border-2 border-yellow-400 p-6 sm:p-8 text-center">
            <div className={`h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${currentBeat.type === "climb" ? "bg-yellow-500/20 text-yellow-400" :
              currentBeat.type === "sprint" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
              }`}>
              <svg className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{currentBeat.label}</h2>
            <p className="text-base sm:text-lg text-white/70 uppercase tracking-wider">{currentBeat.type}</p>
          </div>
        </div>
      )}

      {/* Completion Modal - Mobile Optimized */}
      {rideProgress >= 100 && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center pointer-events-auto p-4">
          <div className="rounded-3xl bg-gradient-to-br from-indigo-900/90 to-purple-900/90 border border-white/20 p-6 sm:p-12 text-center max-w-lg w-full backdrop-blur-xl">
            <div className="h-16 w-16 sm:h-24 sm:w-24 mx-auto mb-4 sm:mb-6 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 flex items-center justify-center">
              <svg className="h-8 w-8 sm:h-12 sm:w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 sm:mb-3">
              {isPracticeMode ? "Practice Complete!" : "Ride Complete!"}
            </h2>
            <p className="text-lg sm:text-xl text-white/70 mb-6 sm:mb-8">
              {isPracticeMode ? "Great way to preview your class!" : `Total Time: ${formatTime(elapsedTime)}`}
            </p>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
              <div className="rounded-xl bg-white/10 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-white/50">Avg HR</p>
                <p className="text-xl sm:text-2xl font-bold text-white">{telemetryAverages.avgHr}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-white/50">Avg Power</p>
                <p className="text-xl sm:text-2xl font-bold text-white">{telemetryAverages.avgPower}W</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-white/50">Effort</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-400">{telemetryAverages.avgEffort}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={exitRide}
                className="flex-1 rounded-full border border-white/20 bg-white/10 py-3 text-white font-semibold transition-all active:scale-95 touch-manipulation min-h-[56px]"
              >
                {isPracticeMode ? "Back to Builder" : "View Journey"}
              </button>
              {isPracticeMode ? (
                <button
                  onClick={() => router.push("/instructor/builder")}
                  className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-3 text-white font-semibold shadow-lg shadow-indigo-500/50 transition-all active:scale-95 touch-manipulation min-h-[56px]"
                >
                  Deploy Class
                </button>
              ) : (
                <button
                  className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-3 text-white font-semibold shadow-lg shadow-indigo-500/50 transition-all active:scale-95 touch-manipulation min-h-[56px]"
                >
                  Claim Rewards
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Demo Complete Modal */}
      <DemoCompleteModal
        isOpen={showDemoModal}
        onClose={handleDemoModalClose}
        stats={demoStats}
      />

      {/* Pedal Simulator - Only in Practice Mode */}
      {isPracticeMode && useSimulator && (
        <PedalSimulator
          isActive={isRiding}
          onMetricsUpdate={handleSimulatorMetrics}
        />
      )}
    </div>
  );
}
