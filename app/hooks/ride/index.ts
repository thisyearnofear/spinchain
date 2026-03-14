/**
 * Ride Hooks
 * 
 * Core Principles:
 * - DRY: Single source of truth for ride logic
 * - MODULAR: Each hook is independently testable
 * - PERFORMANT: Buffered telemetry, adaptive UI rates
 */

export { useRideTelemetry, type TelemetryState } from "./use-ride-telemetry";
export { useRideCoach } from "./use-ride-coach";
export { useSimulatedRewards } from "./use-simulated-rewards";
