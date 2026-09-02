"use client";

/**
 * SpinChain Test Hooks — adapter for threejs-qa-release visual harness.
 *
 * Exposes window.__THREE_GAME_TEST_HOOKS__ so the Playwright inspector
 * and visual regression specs can drive deterministic states before
 * capturing screenshots. Mirrors the scaffold contract from
 * threejs-game-skills but adapted to SpinChain's Next.js + Zustand
 * architecture (ride-store, telemetry-store, ui-store, coaching-store).
 *
 * States supported:
 * - preview              — route preview before ride (progress 0, not riding)
 * - active-play          — mid-ride, immersive 3D, stats visible
 * - active-play-mobile   — same as active-play but Playwright uses mobile viewport
 * - finished             — rideProgress 100, completion celebration
 * - pause-or-settings    — not yet implemented (placeholder for future HUD menu)
 *
 * The harness is installed only in development/test (not production) and
 * also auto-drives state from URL ?testState=<state>&seed=<n> for direct
 * inspector navigation without needing evaluate().
 */

import { useEffect } from "react";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useUIStore } from "@/app/stores/ui-store";

declare global {
  interface Window {
    __THREE_GAME_TEST_HOOKS__?: {
      seed(value: number): void;
      setState(name: string): void;
      setPausedForScreenshot(paused: boolean): void;
      setReducedMotion(enabled: boolean): void;
      hideDebugUi(hidden: boolean): void;
    };
    __SPINCHAIN_TEST_HOOKS__?: Window["__THREE_GAME_TEST_HOOKS__"];
    __SPINCHAIN_SEED__?: number;
    __SPINCHAIN_PAUSED_FOR_SCREENSHOT__?: boolean;
  }
}

let installed = false;

export function installTestHooks(): void {
  if (typeof window === "undefined") return;
  if (installed) return;
  if (process.env.NODE_ENV === "production") return;

  installed = true;

  const setState = (name: string) => {
    const rideStore = useRideStore.getState();
    const telemetryStore = useTelemetryStore.getState();
    const coachingStore = useCoachingStore.getState();

    switch (name) {
      case "preview":
        useRideStore.setState({ isActive: false, rideProgress: 0 });
        useTelemetryStore.setState({
          snapshot: { heartRate: 0, power: 0, cadence: 0, speed: 0, effort: 0, wBal: 0, wBalPercentage: 0, currentGear: 1, gearRatio: 1, distance: 0, resistance: 0, timestamp: Date.now() },
        });
        break;
      case "active-play":
      case "active-play-desktop":
        useRideStore.setState({ isActive: true, rideProgress: 50 });
        useTelemetryStore.setState({
          snapshot: { heartRate: 165, power: 240, cadence: 90, speed: 28, effort: 750, wBal: 12000, wBalPercentage: 0.6, currentGear: 8, gearRatio: 2.5, distance: 5.2, resistance: 45, timestamp: Date.now() },
          history: {
            power: Array.from({ length: 60 }, (_, i) => 180 + Math.sin(i * 0.2) * 40 + (i > 30 ? 60 : 0)),
            cadence: Array.from({ length: 60 }, () => 88 + Math.random() * 4),
            heartRate: Array.from({ length: 60 }, () => 160 + Math.random() * 10),
          },
          recentPower: Array.from({ length: 30 }, (_, i) => 200 + Math.sin(i * 0.3) * 30),
        });
        useCoachingStore.setState({
          currentInterval: { phase: "interval", targetPower: 250, duration: 120 } as unknown as ReturnType<typeof useCoachingStore.getState>["currentInterval"],
          currentIntervalIndex: 1,
        } as Partial<ReturnType<typeof useCoachingStore.getState>> as never);
        useUIStore.setState({ viewMode: "immersive", hudMode: "full" });
        break;
      case "active-play-mobile":
        // Same as active-play — Playwright handles viewport, not the hook
        setState("active-play");
        break;
      case "finished":
        useRideStore.setState({ isActive: false, rideProgress: 100 });
        useTelemetryStore.setState({
          snapshot: { heartRate: 170, power: 280, cadence: 95, speed: 32, effort: 920, wBal: 8000, wBalPercentage: 0.4, currentGear: 12, gearRatio: 3.2, distance: 12.5, resistance: 60, timestamp: Date.now() },
        });
        break;
      case "pause-or-settings":
        useRideStore.setState({ isActive: true, isPaused: true, rideProgress: 45 });
        break;
      default:
        console.warn(`[TestHooks] Unknown state: ${name}`);
    }
    // Nudge R3F demand loop to render the new state
    window.dispatchEvent(new CustomEvent("spinchain:test-state-changed", { detail: name }));
  };

  const hooks: NonNullable<Window["__THREE_GAME_TEST_HOOKS__"]> = {
    seed(value: number) {
      window.__SPINCHAIN_SEED__ = value;
      // Seed any deterministic RNG used by route generation / particles
      // For now, just store the seed; future: feed to seededRandom in route-visualizer
      document.documentElement.setAttribute("data-test-seed", String(value));
    },
    setState,
    setPausedForScreenshot(paused: boolean) {
      window.__SPINCHAIN_PAUSED_FOR_SCREENSHOT__ = paused;
      document.documentElement.setAttribute("data-paused-for-screenshot", String(paused));
      // Pause/resume R3F frameloop via CSS class that components can check
      if (paused) {
        document.documentElement.classList.add("paused-for-screenshot");
      } else {
        document.documentElement.classList.remove("paused-for-screenshot");
      }
    },
    setReducedMotion(enabled: boolean) {
      useUIStore.setState({ prefersReducedMotion: enabled });
      document.documentElement.setAttribute("data-reduced-motion", String(enabled));
    },
    hideDebugUi(hidden: boolean) {
      document.documentElement.setAttribute("data-hide-debug-ui", String(hidden));
      document.documentElement.style.setProperty("--debug-ui-display", hidden ? "none" : "");
    },
  };

  window.__THREE_GAME_TEST_HOOKS__ = hooks;
  window.__SPINCHAIN_TEST_HOOKS__ = hooks;

  // Auto-drive from URL ?testState=active-play&seed=123&paused=1 for inspector
  // direct navigation without evaluate(). Useful for manual `?testState=` debugging.
  try {
    const params = new URLSearchParams(window.location.search);
    const urlState = params.get("testState") || params.get("state");
    const urlSeed = params.get("seed");
    const urlPaused = params.get("paused");
    if (urlSeed) hooks.seed(Number(urlSeed));
    if (urlState) {
      // Defer to next tick so stores are hydrated
      setTimeout(() => hooks.setState(urlState), 50);
    }
    if (urlPaused === "1" || urlPaused === "true") {
      setTimeout(() => hooks.setPausedForScreenshot(true), 100);
    }
  } catch {
    // ignore URL parse errors
  }
}

export function TestHooksProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    installTestHooks();
  }, []);
  return children as React.ReactElement;
}
