/**
 * Ride Feature Components
 * 
 * Core Principles:
 * - ORGANIZED: Domain-driven exports
 * - CLEAN: Single public API for ride components
 * - MODULAR: Each component is independently usable
 */

export { RideHeader } from "./ride-header";
export { RideHUD } from "./ride-hud";
export { RideControls } from "./ride-controls";
export { RideProgress } from "./ride-progress";
export { RideCompletion } from "./ride-completion";

// Re-export types for convenience
export type { TelemetryData } from "./ride-hud";
