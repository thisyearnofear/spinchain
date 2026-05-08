"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface UseRideLifecycleOptions {
  classData: { metadata?: { duration?: number } | null } | null;
  bleConnected: boolean;
  useSimulator: boolean;
}

export function useRideLifecycle({
  classData,
  bleConnected,
  useSimulator,
}: UseRideLifecycleOptions) {
  const [isRiding, setIsRiding] = useState(false);
  const isRidingRef = useRef(false);
  const classDataRef = useRef(classData);
  useEffect(() => {
    classDataRef.current = classData;
  }, [classData]);

  const [isStarting, setIsStarting] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [rideProgress, setRideProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  const startRide = useCallback(() => {
    isRidingRef.current = true;
    setIsRiding(true);
    setIsStarting(false);
    setRideProgress(0);
    setElapsedTime(0);
  }, []);

  const pauseRide = useCallback(() => {
    isRidingRef.current = false;
    setIsRiding(false);
  }, []);

  const resetRide = useCallback(() => {
    isRidingRef.current = false;
    setIsRiding(false);
    setIsStarting(false);
    setIsExiting(false);
    setRideProgress(0);
    setElapsedTime(0);
  }, []);

  // Simulate ride progress (only when BLE not connected and not using simulator)
  // IMPORTANT: Do NOT call other setState inside setElapsedTime updater —
  // this causes React #185 (Maximum update depth exceeded) because React
  // re-invokes updaters when concurrent state changes are detected.
  useEffect(() => {
    if (!isRiding || !classData || bleConnected || useSimulator) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRiding, classData, bleConnected, useSimulator]);

  // Derive ride progress and auto-stop from elapsed time (separate effect)
  useEffect(() => {
    if (!isRiding || !classData) return;
    const duration = (classData.metadata?.duration || 45) * 60;
    const newProgress = Math.min((elapsedTime / duration) * 100, 100);
    setRideProgress(newProgress);

    if (newProgress >= 100) {
      isRidingRef.current = false;
      setIsRiding(false);
    }
  }, [isRiding, classData, elapsedTime]);

  return {
    isRiding,
    setIsRiding,
    isRidingRef,
    classDataRef,
    isStarting,
    setIsStarting,
    isExiting,
    setIsExiting,
    rideProgress,
    setRideProgress,
    elapsedTime,
    setElapsedTime,
    startRide,
    pauseRide,
    resetRide,
  };
}
