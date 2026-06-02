/**
 * Ride Hooks
 * 
 * Core Principles:
 * - DRY: Single source of truth for ride logic
 * - MODULAR: Each hook is independently testable
 * - PERFORMANT: Buffered telemetry, adaptive UI rates
 * 
 * Note: useRideLifecycle, useRideCoach, useSimulatedRewards, useMultiGhost
 * have been replaced by engines + Zustand store. See app/stores/ride-store.ts
 * and app/engines/ for the new architecture.
 */

export { useRideTelemetry, type TelemetryState } from "./use-ride-telemetry";
