"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

// Granular telemetry store - each property can be subscribed to independently
// This prevents a power change from re-rendering the heart rate gauge, etc.
interface TelemetryStore {
  // Core metrics (most frequently updated)
  heartRate: number;
  power: number;
  cadence: number;
  speed: number;
  effort: number;
  
  // Derived metrics (updated less frequently)
  wBal: number;
  wBalPercentage: number;
  distance: number;
  
  // Gear state
  currentGear: number;
  gearRatio: number;
  
  // System
  resistance: number;
  timestamp: number;
  
  // Batch update function (called from RAF loop)
  updateMetrics: (metrics: Partial<Omit<TelemetryStore, 'updateMetrics'>>) => void;
}

export const useTelemetryStore = create<TelemetryStore>((set) => ({
  heartRate: 0,
  power: 0,
  cadence: 0,
  speed: 0,
  effort: 0,
  wBal: 20000,
  wBalPercentage: 100,
  distance: 0,
  currentGear: 10,
  gearRatio: 1.0,
  resistance: 0,
  timestamp: Date.now(),
  
  updateMetrics: (metrics) => set(metrics),
}));

// Granular selectors for components to subscribe to only what they need
export const usePower = () => useTelemetryStore((state) => state.power);
export const useHeartRate = () => useTelemetryStore((state) => state.heartRate);
export const useCadence = () => useTelemetryStore((state) => state.cadence);
export const useSpeed = () => useTelemetryStore((state) => state.speed);
export const useEffort = () => useTelemetryStore((state) => state.effort);
export const useWBal = () => useTelemetryStore(useShallow((state) => ({ wBal: state.wBal, wBalPercentage: state.wBalPercentage })));
export const useDistance = () => useTelemetryStore((state) => state.distance);
export const useGear = () => useTelemetryStore(useShallow((state) => ({ currentGear: state.currentGear, gearRatio: state.gearRatio })));

// Composite selector for components that need multiple related values
export const useCoreMetrics = () => useTelemetryStore(
  useShallow((state) => ({
    heartRate: state.heartRate,
    power: state.power,
    cadence: state.cadence,
  })),
);

// Full telemetry for backward compatibility (use sparingly)
export const useFullTelemetry = () => useTelemetryStore(
  useShallow((state) => ({
    heartRate: state.heartRate,
    power: state.power,
    cadence: state.cadence,
    speed: state.speed,
    effort: state.effort,
    wBal: state.wBal,
    wBalPercentage: state.wBalPercentage,
    distance: state.distance,
    currentGear: state.currentGear,
    gearRatio: state.gearRatio,
    resistance: state.resistance,
    timestamp: state.timestamp,
  })),
);
