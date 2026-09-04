// @vitest-environment jsdom
/**
 * Regression tests for the activation countdown (PR #19).
 *
 * The ride page re-renders ~10x/sec (useFlowState ticks every 100ms) and
 * passed fresh onActivationComplete/onSkipActivation callbacks each render.
 * The countdown interval and skip timer used to key on callback identity, so
 * they were torn down and restarted on every render: the countdown froze on
 * "3" and the Skip button never appeared.
 *
 * The overlay now reads callbacks through refs, so timers survive parent
 * re-renders. These tests reproduce the 10Hz re-rendering parent with unstable
 * callbacks and assert the countdown runs to completion.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";

// Replace framer-motion with plain elements so assertions are deterministic
// under fake timers (no rAF-driven enter/exit animations to wait out).
vi.mock("framer-motion", async () => {
  const ReactActual = await vi.importActual<typeof import("react")>("react");
  const strip = (tag: string) => {
    const Component = ReactActual.forwardRef<HTMLElement, Record<string, unknown>>(
      ({ initial, animate, exit, transition, ...rest }, ref) =>
        ReactActual.createElement(tag, { ...rest, ref }),
    );
    return Component;
  };
  const motion = new Proxy({} as Record<string, React.ComponentType<never>>, {
    get: (_target, prop) => strip(String(prop)),
  });
  return {
    motion,
    m: motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children ?? null,
    LazyMotion: ({ children }: { children?: React.ReactNode }) => children ?? null,
    domAnimation: {},
    MotionConfig: ({ children }: { children?: React.ReactNode }) => children ?? null,
  };
});

import { RideTransitionOverlay } from "../ride-transition-overlay";

function renderWithUnstableCallbacks(onDone: () => void, onSkip: () => void) {
  // Mimics the ride page: re-renders every 100ms and passes brand-new
  // callback identities each time (the pre-fix condition).
  function UnstableParent() {
    const [, forceRender] = React.useReducer((x: number) => x + 1, 0);
    React.useEffect(() => {
      const id = setInterval(forceRender, 100);
      return () => clearInterval(id);
    }, []);
    return (
      <RideTransitionOverlay
        state="activation"
        onActivationComplete={() => onDone()}
        onSkipActivation={() => onSkip()}
        hasData={true}
        loadProgress={1}
        loadTotal={1}
        reducedMotion={false}
      />
    );
  }
  return render(<UnstableParent />);
}

describe("RideTransitionOverlay activation countdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("counts 3 → 2 → 1 while the parent re-renders at 10Hz with unstable callbacks", () => {
    const onDone = vi.fn();
    renderWithUnstableCallbacks(onDone, vi.fn());

    expect(screen.getByText("3")).toBeTruthy();

    act(() => void vi.advanceTimersByTime(700));
    expect(screen.getByText("2")).toBeTruthy();

    act(() => void vi.advanceTimersByTime(700));
    expect(screen.getByText("1")).toBeTruthy();

    expect(onDone).not.toHaveBeenCalled();
  });

  it("fires onActivationComplete after the countdown finishes despite constant re-renders", () => {
    const onDone = vi.fn();
    renderWithUnstableCallbacks(onDone, vi.fn());

    // 3 interval ticks at 700ms bring the countdown to 0 (3→2, 2→1, 1→0).
    // Handoff fires immediately on GO so pedals/isActive work without a
    // second post-activation delay.
    act(() => void vi.advanceTimersByTime(2000));
    expect(onDone).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(200));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("shows the Skip button after 1.5s and starts the ride when clicked", () => {
    const onSkip = vi.fn();
    renderWithUnstableCallbacks(vi.fn(), onSkip);

    expect(screen.queryByText(/Skip/)).toBeNull();

    act(() => void vi.advanceTimersByTime(1500));
    const skipButton = screen.getByText(/Skip/);
    expect(skipButton).toBeTruthy();

    act(() => {
      (skipButton.closest("button") ?? skipButton).dispatchEvent(
        new window.MouseEvent("click", { bubbles: true }),
      );
    });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
