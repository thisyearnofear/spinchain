// @vitest-environment jsdom
/**
 * When WebGL can't run, the ride must land on 2D Focus instead of a dead
 * canvas: no WebGL at probe time never mounts the 3D layer, and a 3D layer
 * that fails to start (or loses its context for good) hands over to 2D and
 * pins the view there for the rest of the page session.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { GpuCapability } from "@/app/lib/gpu-probe";

const probe = vi.hoisted(() => ({ webgl: true }));

vi.mock("@/app/lib/gpu-probe", () => ({
  probeGpu: (): GpuCapability => ({
    webgl: probe.webgl,
    webgl2: probe.webgl,
    webgpu: false,
    renderer: "",
    vendor: "unknown",
    maxTextureSize: probe.webgl ? 16384 : 0,
    cores: 8,
    memoryGb: 8,
    recommendedMode: probe.webgl ? "tron-3d" : "focus-2d",
    isLowEnd: false,
    canPostProcess: probe.webgl,
  }),
  getQualitySettings: () => ({
    pixelRatio: 1,
    shadows: false,
    antialiasing: false,
    particleCount: 50,
    meshDetail: "low",
    fps: 30,
    enableBloom: false,
    enableSSAO: false,
  }),
}));

vi.mock("framer-motion", () => ({
  m: {
    div: ({ initial: _i, animate: _a, transition: _t, ...rest }: Record<string, unknown>) =>
      React.createElement("div", rest),
  },
}));

vi.mock("@/app/components/features/renderers/focus-renderer", () => ({
  FocusRenderer: ({ active }: { active?: boolean }) => (
    <div data-testid="focus" data-active={String(active ?? true)} />
  ),
}));

vi.mock("@/app/components/features/renderers/tron-renderer", () => ({
  TronRenderer: ({ onWebglUnavailable }: { onWebglUnavailable?: (r: string) => void }) => (
    <button data-testid="tron" onClick={() => onWebglUnavailable?.("init-failed")} />
  ),
}));

vi.mock("@/app/components/features/route/route-visualizer", () => ({ default: () => null }));
vi.mock("@/app/components/features/route/focus-route-visualizer", () => ({ default: () => null }));

import { RideVisualization } from "../ride-visualization";
import { useUIStore } from "@/app/stores/ui-store";

type Props = React.ComponentProps<typeof RideVisualization>;
const noop = () => {};
const props = {
  routeElevationProfile: [0, 1, 2],
  routeCoordinates: [],
  currentRouteCoordinate: null,
  classData: { name: "Test ride" },
  routeTheme: "neon",
  searchParams: new URLSearchParams(),
  panelState: {},
  panelPositions: {},
  onTogglePanel: noop,
  onSetPanelPosition: noop,
  onSnapPanel: noop,
  onTrackWidgetInteraction: noop,
  onExpandOne: noop,
} as unknown as Props;

beforeEach(() => {
  probe.webgl = true;
  useUIStore.setState({ viewMode: "immersive", webglUnavailable: null });
});

afterEach(cleanup);

describe("WebGL → 2D Focus fallback", () => {
  it("never mounts the 3D layer when the probe finds no WebGL", async () => {
    probe.webgl = false;
    await act(async () => {
      render(<RideVisualization {...props} />);
    });
    expect(screen.queryByTestId("tron")).toBeNull();
    expect(screen.getByTestId("focus").dataset.active).toBe("true");
    expect(useUIStore.getState()).toMatchObject({ viewMode: "focus", webglUnavailable: "no-webgl" });
  });

  it("keeps the 3D layer when WebGL works and the rider chose immersive", async () => {
    await act(async () => {
      render(<RideVisualization {...props} />);
    });
    expect(screen.getByTestId("tron")).toBeTruthy();
    expect(screen.getByTestId("focus").dataset.active).toBe("false");
    expect(useUIStore.getState().webglUnavailable).toBeNull();
  });

  it("hands over to 2D when the 3D layer can't start", async () => {
    await act(async () => {
      render(<RideVisualization {...props} />);
    });
    await act(async () => {
      screen.getByTestId("tron").click();
    });
    expect(screen.queryByTestId("tron")).toBeNull();
    expect(screen.getByTestId("focus").dataset.active).toBe("true");
    expect(useUIStore.getState()).toMatchObject({ viewMode: "focus", webglUnavailable: "init-failed" });
  });

  it("refuses immersive for the rest of the session once 3D is unavailable", () => {
    const store = useUIStore.getState();
    store.markWebglUnavailable("context-lost");
    store.setViewMode("immersive");
    expect(useUIStore.getState().viewMode).toBe("focus");
    useUIStore.getState().toggleViewMode();
    expect(useUIStore.getState().viewMode).toBe("focus");
    useUIStore.getState().markWebglUnavailable("init-failed");
    expect(useUIStore.getState().webglUnavailable).toBe("context-lost");
  });

  it("does not persist the unavailable flag", () => {
    useUIStore.getState().markWebglUnavailable("no-webgl");
    const saved = JSON.parse(window.localStorage.getItem("spinchain-ride-ui") ?? "{}");
    expect(saved.state).not.toHaveProperty("webglUnavailable");
  });
});
