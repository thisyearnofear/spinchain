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

const hapticMock = vi.fn();
vi.mock("@/app/hooks/use-haptic", () => ({
  haptic: (...args: unknown[]) => hapticMock(...args),
  useHaptic: () => ({ trigger: hapticMock }),
}));

const tickSfxMock = vi.fn();
const goSfxMock = vi.fn();
vi.mock("@/app/lib/ceremony-sfx", () => ({
  playCountdownTickSfx: (...args: unknown[]) => tickSfxMock(...args),
  playGoStingerSfx: (...args: unknown[]) => goSfxMock(...args),
  playFirstHitSfx: vi.fn(),
}));

vi.mock("@/app/stores/sensory-store", () => {
  const setCountdownPhase = vi.fn();
  const resetCountdown = vi.fn();
  const setLatestEvent = vi.fn();
  const store = {
    setCountdownPhase,
    resetCountdown,
    setLatestEvent,
    countdownPhase: "none",
    latestEvent: null,
  };
  const useSensoryStore = Object.assign(
    (selector?: (s: typeof store) => unknown) =>
      typeof selector === "function" ? selector(store) : store,
    { getState: () => store },
  );
  return { useSensoryStore };
});

import { RideTransitionOverlay, routeThumbnailForTheme } from "../ride-transition-overlay";


function renderWithUnstableCallbacks(
  onDone: () => void,
  onSkip: () => void,
  extras: {
    reducedMotion?: boolean;
    routeThumbnailUrl?: string | null;
    routeLabel?: string | null;
  } = {},
) {
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
        reducedMotion={extras.reducedMotion ?? false}
        routeThumbnailUrl={extras.routeThumbnailUrl}
        routeLabel={extras.routeLabel}
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

  it("fires haptic + countdown SFX on each tick and a GO stinger on complete", () => {
    hapticMock.mockClear();
    tickSfxMock.mockClear();
    goSfxMock.mockClear();

    const onDone = vi.fn();
    renderWithUnstableCallbacks(onDone, vi.fn());

    // Initial "3" tick fires on mount
    expect(tickSfxMock).toHaveBeenCalledWith(3);
    expect(hapticMock).toHaveBeenCalledWith("medium");

    act(() => void vi.advanceTimersByTime(700));
    expect(tickSfxMock).toHaveBeenCalledWith(2);

    act(() => void vi.advanceTimersByTime(700));
    expect(tickSfxMock).toHaveBeenCalledWith(1);
    expect(hapticMock).toHaveBeenCalledWith("heavy");

    act(() => void vi.advanceTimersByTime(700));
    expect(goSfxMock).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("renders the route thumbnail behind the countdown when provided", () => {
    renderWithUnstableCallbacks(vi.fn(), vi.fn(), {
      routeThumbnailUrl: "/images/routes/route-city.jpg",
      routeLabel: "Neon Grid Sprint",
    });

    const thumb = screen.getByTestId("activation-route-thumbnail");
    expect(thumb).toBeTruthy();
    expect(screen.getByAltText(/Neon Grid Sprint route preview/)).toBeTruthy();
    expect(screen.getByTestId("activation-countdown-pulse")).toBeTruthy();
    expect(screen.getByText("Neon Grid Sprint")).toBeTruthy();
  });

  it("prefers-reduced-motion: simple GO fade, immediate handoff, no tick SFX/parallax pulse", () => {
    hapticMock.mockClear();
    tickSfxMock.mockClear();
    goSfxMock.mockClear();

    const onDone = vi.fn();
    renderWithUnstableCallbacks(onDone, vi.fn(), {
      reducedMotion: true,
      routeThumbnailUrl: "/images/routes/route-mountain.jpg",
    });

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(tickSfxMock).not.toHaveBeenCalled();
    expect(goSfxMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("activation-countdown-pulse")).toBeNull();
    expect(screen.getByText("GO")).toBeTruthy();
    expect(screen.getByTestId("activation-go-flash")).toBeTruthy();
    expect(
      document.querySelector('[data-reduced-motion="true"]'),
    ).toBeTruthy();
  });

  it("maps route themes to existing public thumbnail assets", () => {
    expect(routeThumbnailForTheme("alpine")).toBe(
      "/images/routes/route-mountain.jpg",
    );
    expect(routeThumbnailForTheme("neon")).toBe(
      "/images/routes/route-city.jpg",
    );
    expect(routeThumbnailForTheme(undefined)).toBe(
      "/images/routes/route-city.jpg",
    );
  });
});
