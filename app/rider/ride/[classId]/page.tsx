"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useClass } from "../../../hooks/use-class-data";
import RouteVisualizer from "../../../components/route-visualizer";
import { useDeviceType, useOrientation, useActualViewportHeight } from "../../../lib/responsive";

/**
 * Mobile-Optimized Live Ride Page
 * ENHANCEMENT FIRST: Enhances existing live ride with responsive layout
 * PERFORMANT: Adaptive rendering based on device
 */

export default function LiveRidePage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;
  
  const { classData, isLoading } = useClass(classId as `0x${string}`);
  const deviceType = useDeviceType();
  const orientation = useOrientation();
  const viewportHeight = useActualViewportHeight();
  
  // Ride state
  const [isRiding, setIsRiding] = useState(false);
  const [rideProgress, setRideProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showHUD, setShowHUD] = useState(true);
  const [hudMode, setHudMode] = useState<"full" | "compact" | "minimal">("full");
  
  // Telemetry
  const [telemetry, setTelemetry] = useState({
    heartRate: 0,
    power: 0,
    cadence: 0,
    speed: 0,
    effort: 0,
  });

  // Auto-adjust HUD based on device
  useEffect(() => {
    if (deviceType === "mobile") {
      setHudMode("compact");
    } else if (deviceType === "tablet") {
      setHudMode(orientation === "portrait" ? "compact" : "full");
    } else {
      setHudMode("full");
    }
  }, [deviceType, orientation]);

  // Simulate ride progress
  useEffect(() => {
    if (!isRiding || !classData) return;

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

  const pauseRide = () => setIsRiding(false);
  const exitRide = () => router.push("/rider");

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
      {/* Full-Screen Route Visualization */}
      <div className="absolute inset-0">
        <RouteVisualizer
          elevationProfile={classData.route.route.coordinates.map(c => c.ele || 0)}
          theme={(classData.metadata?.route.theme as any) || "neon"}
          storyBeats={classData.route.route.storyBeats}
          className="h-full w-full"
        />
        
        {/* Progress Bar */}
        <div className="absolute inset-x-0 bottom-0 h-1 sm:h-2 bg-black/50">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
            style={{ width: `${rideProgress}%` }}
          />
        </div>
      </div>

      {/* HUD Overlay */}
      {showHUD && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Top Bar - Mobile Optimized */}
          <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/90 to-transparent p-3 sm:p-6 pointer-events-auto safe-top">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-white mb-0.5 sm:mb-1 truncate">
                  {classData.name}
                </h1>
                <p className="text-xs sm:text-sm text-white/60 truncate">
                  {classData.instructor}
                </p>
              </div>
              
              <div className="flex items-center gap-2 ml-2">
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
                  className="rounded-lg bg-white/10 p-2 sm:p-2.5 text-white/70 hover:bg-white/20 backdrop-blur active:scale-95 transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Exit ride"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Center - Telemetry (Responsive Layout) */}
          {hudMode !== "minimal" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-3 sm:p-6">
              {/* Mobile: Single Column */}
              {deviceType === "mobile" && hudMode === "compact" && (
                <div className="flex flex-col gap-2 w-full max-w-[200px]">
                  {/* Primary Metric - Large */}
                  <div className="rounded-xl bg-black/70 backdrop-blur-xl border border-white/20 p-4 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Heart Rate</p>
                    <p className="text-4xl font-bold text-red-400">
                      {telemetry.heartRate}
                    </p>
                  </div>
                  
                  {/* Secondary Metrics - Small */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-black/60 backdrop-blur-xl border border-white/10 p-2 text-center">
                      <p className="text-[9px] uppercase text-white/40">Power</p>
                      <p className="text-xl font-bold text-yellow-400">{telemetry.power}</p>
                    </div>
                    <div className="rounded-lg bg-black/60 backdrop-blur-xl border border-white/10 p-2 text-center">
                      <p className="text-[9px] uppercase text-white/40">RPM</p>
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

              {/* Desktop/Tablet Landscape: 2x2 Grid */}
              {(deviceType === "desktop" || (deviceType === "tablet" && orientation === "landscape")) && hudMode === "full" && (
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
              )}
            </div>
          )}

          {/* Bottom - Controls (Mobile Optimized) */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-3 sm:p-6 pointer-events-auto safe-bottom">
            <div className="max-w-7xl mx-auto">
              {/* Progress Info - Compact on Mobile */}
              {hudMode !== "minimal" && (
                <div className="flex items-center justify-between mb-3 sm:mb-4 text-white">
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
              )}

              {/* Controls - Touch Optimized */}
              <div className="flex items-center justify-center gap-3">
                {!isRiding ? (
                  <button
                    onClick={startRide}
                    className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white shadow-lg shadow-indigo-500/50 transition-all active:scale-95 touch-manipulation min-h-[56px]"
                  >
                    {rideProgress > 0 ? "Resume" : "Start Ride"}
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
            </div>
          </div>
        </div>
      )}

      {/* Story Beat Alert - Mobile Optimized */}
      {currentBeat && isRiding && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none px-4 w-full max-w-[90%] sm:max-w-md">
          <div className="rounded-2xl bg-black/95 backdrop-blur-xl border-2 border-yellow-400 p-6 sm:p-8 text-center">
            <div className={`h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center ${
              currentBeat.type === "climb" ? "bg-yellow-500/20 text-yellow-400" :
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
            
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 sm:mb-3">Ride Complete!</h2>
            <p className="text-lg sm:text-xl text-white/70 mb-6 sm:mb-8">
              Total Time: {formatTime(elapsedTime)}
            </p>
            
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
              <div className="rounded-xl bg-white/10 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-white/50">Avg HR</p>
                <p className="text-xl sm:text-2xl font-bold text-white">{telemetry.heartRate}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-white/50">Avg Power</p>
                <p className="text-xl sm:text-2xl font-bold text-white">{telemetry.power}W</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-white/50">Effort</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-400">{telemetry.effort}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={exitRide}
                className="flex-1 rounded-full border border-white/20 bg-white/10 py-3 text-white font-semibold transition-all active:scale-95 touch-manipulation min-h-[56px]"
              >
                Back to Classes
              </button>
              <button
                className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-3 text-white font-semibold shadow-lg shadow-indigo-500/50 transition-all active:scale-95 touch-manipulation min-h-[56px]"
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
