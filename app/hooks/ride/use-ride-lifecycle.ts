"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface UseRideLifecycleOptions {
  classData: { metadata?: { duration?: number } } | null;
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
  classDataRef.current = classData;

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
  useEffect(() => {
    if (!isRiding || !classData || bleConnected || useSimulator) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => {
        const newTime = prev + 1;
        const duration = (classData.metadata?.duration || 45) * 60;
        const newProgress = Math.min((newTime / duration) * 100, 100);
        setRideProgress(newProgress);

        if (newProgress >= 100) {
          isRidingRef.current = false;
          setIsRiding(false);
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRiding, classData, bleConnected, useSimulator]);

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