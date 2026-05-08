"use client";

/**
 * Ride Page — re-exports the refactored RidePage orchestrator.
 *
 * The original 1750-line God Component has been decomposed into:
 * - ride-store.ts: centralized Zustand store
 * - ride-page.tsx: orchestrator (hook initialization, effects)
 * - ride-scene.tsx: 3D visualization (subscribes to route + telemetry)
 * - ride-controls.tsx: HUD overlay + modals (subscribes to ride state)
 * - ride-overlays.tsx: social, coach, settlement (subscribes to social state)
 *
 * This eliminates the React #185 cascading re-render loop by ensuring
 * each component only re-renders when its own subscribed state changes.
 */

export { default } from "./ride-page";
