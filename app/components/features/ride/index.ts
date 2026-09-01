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
export { RideTopBar } from "./ride-top-bar";
export { RideBottomPanel } from "./ride-bottom-panel";
export { RideTutorialOverlay, useRideTutorial } from "./ride-tutorial";
export { RideLoading, RideNotFound } from "./ride-loading";
// RewardClaimStatus moved to @/app/lib/rewards (was in ride-completion.tsx)
export type { RewardClaimStatus } from "@/app/lib/rewards";

// ─── Ride experience v2 (delight upgrades) ─────────────────────────
export { RideActivationSequence } from "./ride-activation";
export { RideHUDOverlayV2 } from "./ride-hud-overlay-v2";
export { RideCompletionV2 } from "./ride-completion-v2";
export { EnhancedFlowBackground } from "./enhanced-flow-background";
export { RideTransitionOverlay } from "./ride-transition-overlay";
export { CoachChannel } from "./coach-channel";
export { ModalStack } from "./modal-stack";

// ─── Sensory sync ──────────────────────────────────────────────────
export { useSensorySync } from "@/app/hooks/ride/use-sensory-sync";
export { useSwipeGesture } from "@/app/hooks/ride/use-swipe-gesture";

// Re-export types for convenience
export type { TelemetryData } from "./ride-hud";
