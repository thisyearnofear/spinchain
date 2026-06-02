/**
 * Engines — Barrel file for the SpinChain engine architecture.
 *
 * Import pattern:
 *   import { RideCoordinator, EventBus, TelemetryEngine } from "@/app/engines";
 *   import type { TelemetrySnapshot, RideStartConfig } from "@/app/engines";
 */

export { EventBus } from "./event-bus";
export type { RideEvents } from "./event-bus";

export { RideCoordinator } from "./coordinator";
export { TelemetryEngine } from "./telemetry-engine";
export { CoachingEngine } from "./coaching-engine";
export { VisualizationEngine } from "./visualization-engine";
export { DeviceEngine } from "./device-engine";
export type { TelemetryCallback } from "./device-engine";

export { useRideCoordinator } from "./use-ride-coordinator";

// Re-export all types
export type * from "./types";
