"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useClass } from "../../../hooks/use-class-data";
import RouteVisualizer from "../../../components/route-visualizer";

/**
 * Live Ride Page
 * Full-screen immersive route experience with real-time progress tracking
 * ENHANCEMENT FIRST: Reuses existing RouteVisualizer component
 */

export default function LiveRidePage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  
  const { classData, isLoading } = useClass(classId as `0x${string}`);
  
  // Ride state
  const [isRiding, setIsRiding] = useState(false);
  const [rideProgress, setRideProgress] = useState(0); // 0-100
  const [elapsedTime, setElapsedTime] = useState(0); // seconds
  const [showHUD, setShowHUD] = useState(true);
  
  // Mock telemetry (in production: from device/sensors)
  const [telemetry, setTelemetry] = useState({
    heartRate: 0,
    power: 0,
    cadence: 0,
    speed: 0,
    effort: 0,
  });

  // Simulate ride progress
  useEffect(() => {
    if (!isRiding || !classData) return;

    const interval = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        const duration = (classData.metadata?.duration || 45) * 60;
        const newProgress = Math.min((newTime / duration) * 100, 100);
        setRideProgress(newProgress);
        
        // Stop at 100%
        if (newProgress >= 100) {
          setIsRiding(false);
        }
        
        return newTime;
      });

      // Simulate telemetry
      setTelemetry({
        heartRate: 120 + Math.floor(Math.random() * 40),
        power: 150 + Math.floor(Math.random() * 100),
        cadence: 80 + Math.floor(Math.random() * 20),
        speed: 25 + Math.random() * 10,
        effort: 140 + Math.floor(Math.random() * 30),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRiding, classData]);

  // Check for story beat triggers
  const currentBeat = classData?.route?.route.storyBeats.find(
    beat => {
      const beatProgress = beat.progress * 100;
      return rideProgress >= beatProgress && rideProgress < beatProgress + 1;
    }
  );

  const startRide = () => {
    setIsRiding(true);
    setRideProgress(0);
    setElapsedTime(0);
  };

  const pauseRide = () => {
    setIsRiding(false);
  };

  const exitRide = () => {
    router.push("/rider");
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="h-16 w-16 mx-auto animate-spin rounded-full border-4 border-white/20 border-t-white mb-4" />
          <p className="text-white/60">Loading route...</p>
        </div>
      </div>
    );
  }

  if (!classData || !classData.route) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">Route not found</p>
          <button
            onClick={exitRide}
            className="mt-4 text-white/60 hover:text-white"
          >
            ← Back to classes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Full-Screen Route Visualization */}
      <div className="absolute inset-0">
        <RouteVisualizer
          elevationProfile={classData.route.route.coordinates.map(c => c.ele || 0)}
          theme={(classData.metadata?.route.theme as any) || "neon"}
          storyBeats={classData.route.route.storyBeats}
          className="h-full w-full"
        />
        
        {/* Progress indicator overlay on visualization */}
        <div className="absolute inset-x-0 bottom-0 h-2 bg-black/50">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
            style={{ width: `${rideProgress}%` }}
          />
        </div>
      </div>

      {/* HUD Overlay */}
      {showHUD && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Top Bar - Class Info */}
          <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent p-6 pointer-events-auto">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">
                  {classData.name}
                </h1>
                <p className="text-sm text-white/60">
                  {classData.instructor} • {classData.metadata?.ai.personality}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowHUD(!showHUD)}
                  className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/20 backdrop-blur"
                >
                  {showHUD ? "Hide" : "Show"} HUD
                </button>
                <button
                  onClick={exitRide}
                  className="rounded-lg bg-white/10 p-2 text-white/70 hover:bg-white/20 backdrop-blur"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Center - Telemetry Grid */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="grid grid-cols-2 gap-6">
              {/* Heart Rate */}
              <div className="rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 p-6 min-w-[180px]">
                <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Heart Rate</p>
                <p className="text-5xl font-bold text-red-400">
                  {telemetry.heartRate}
                  <span className="text-xl text-white/50 ml-2">bpm</span>
                </p>
              </div>

              {/* Power */}
              <div className="rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 p-6 min-w-[180px]">
                <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Power</p>
                <p className="text-5xl font-bold text-yellow-400">
                  {telemetry.power}
                  <span className="text-xl text-white/50 ml-2">W</span>
                </p>
              </div>

              {/* Cadence */}
              <div className="rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 p-6 min-w-[180px]">
                <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Cadence</p>
                <p className="text-5xl font-bold text-blue-400">
                  {telemetry.cadence}
                  <span className="text-xl text-white/50 ml-2">rpm</span>
                </p>
              </div>

              {/* Speed */}
              <div className="rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 p-6 min-w-[180px]">
                <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Speed</p>
                <p className="text-5xl font-bold text-green-400">
                  {telemetry.speed.toFixed(1)}
                  <span className="text-xl text-white/50 ml-2">km/h</span>
                </p>
              </div>
            </div>
          </div>

          {/* Bottom - Controls & Progress */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-6 pointer-events-auto">
            <div className="max-w-7xl mx-auto">
              {/* Progress Info */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-white">
                  <p className="text-sm text-white/50">Progress</p>
                  <p className="text-2xl font-bold">{rideProgress.toFixed(1)}%</p>
                </div>
                <div className="text-white text-center">
                  <p className="text-sm text-white/50">Time</p>
                  <p className="text-2xl font-bold">{formatTime(elapsedTime)}</p>
                </div>
                <div className="text-white text-right">
                  <p className="text-sm text-white/50">Effort Score</p>
                  <p className="text-2xl font-bold text-purple-400">{telemetry.effort}</p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                {!isRiding ? (
                  <button
                    onClick={startRide}
                    className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-500/50 transition hover:scale-105"
                  >
                    {rideProgress > 0 ? "Resume Ride" : "Start Ride"}
                  </button>
                ) : (
                  <button
                    onClick={pauseRide}
                    className="rounded-full bg-white/20 backdrop-blur px-8 py-4 text-lg font-semibold text-white transition hover:bg-white/30"
                  >
                    Pause
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Story Beat Alert */}
      {currentBeat && isRiding && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none">
          <div className="rounded-2xl bg-black/90 backdrop-blur-xl border-2 border-yellow-400 p-8 text-center min-w-[400px]">
            <div className={`h-16 w-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
              currentBeat.type === "climb"
                ? "bg-yellow-500/20 text-yellow-400"
                : currentBeat.type === "sprint"
                ? "bg-red-500/20 text-red-400"
                : "bg-blue-500/20 text-blue-400"
            }`}>
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">{currentBeat.label}</h2>
            <p className="text-lg text-white/70 uppercase tracking-wider">{currentBeat.type}</p>
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {rideProgress >= 100 && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
          <div className="rounded-3xl bg-gradient-to-br from-indigo-900/90 to-purple-900/90 border border-white/20 p-12 text-center max-w-lg backdrop-blur-xl">
            <div className="h-24 w-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 flex items-center justify-center">
              <svg className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h2 className="text-4xl font-bold text-white mb-3">Ride Complete!</h2>
            <p className="text-xl text-white/70 mb-8">
              Total Time: {formatTime(elapsedTime)}
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl bg-white/10 p-4">
                <p className="text-sm text-white/50">Avg HR</p>
                <p className="text-2xl font-bold text-white">{telemetry.heartRate}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4">
                <p className="text-sm text-white/50">Avg Power</p>
                <p className="text-2xl font-bold text-white">{telemetry.power}W</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4">
                <p className="text-sm text-white/50">Effort</p>
                <p className="text-2xl font-bold text-purple-400">{telemetry.effort}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={exitRide}
                className="flex-1 rounded-full border border-white/20 bg-white/10 py-3 text-white font-semibold transition hover:bg-white/20"
              >
                Back to Classes
              </button>
              <button
                className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-3 text-white font-semibold shadow-lg shadow-indigo-500/50 transition hover:scale-105"
              >
                Claim Rewards
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
