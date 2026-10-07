// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RideStartScreen, type RideStartBike } from "../ride-start-screen";
import type { ClassWithRoute } from "@/app/hooks/evm/use-class-data";

const classData = { metadata: { name: "Alpine Challenge (Demo)", duration: 45 } } as unknown as ClassWithRoute;

function renderScreen(bike?: Partial<RideStartBike>, isPracticeMode = true) {
  const full: RideStartBike | undefined = bike && {
    connected: false,
    pending: false,
    failed: false,
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
    ...bike,
  };
  render(
    <RideStartScreen
      classData={classData}
      isPracticeMode={isPracticeMode}
      effectiveIsFocus
      canRender3d
      onToggleViewMode={() => {}}
      onStart={() => {}}
      bike={full}
    />,
  );
  return full;
}

afterEach(cleanup);

describe("RideStartScreen bike pairing", () => {
  it("offers no pairing where the browser has no Bluetooth", () => {
    renderScreen();
    expect(screen.queryByRole("button", { name: "Connect bike" })).toBeNull();
    expect(screen.getByText("Keyboard: ← → / A D")).toBeTruthy();
  });

  it("connects on tap", () => {
    const bike = renderScreen({});
    fireEvent.click(screen.getByRole("button", { name: "Connect bike" }));
    expect(bike!.onConnect).toHaveBeenCalledOnce();
  });

  it("can't be tapped twice while the picker is open", () => {
    renderScreen({ pending: true });
    const button = screen.getByRole("button", { name: "Connect bike" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Searching for bike");
  });

  it("names the connected bike, offers disconnect, and stops teaching the keyboard", () => {
    const bike = renderScreen({ connected: true, name: "KICKR BIKE 1A2B" });
    expect(screen.getByTestId("bike-status").textContent).toBe("KICKR BIKE 1A2B connected");
    expect(screen.getByText("Pedal your bike to ride")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect bike" }));
    expect(bike!.onDisconnect).toHaveBeenCalledOnce();
  });

  it("explains a failed pairing without blocking the practice ride", () => {
    renderScreen({ failed: true });
    expect(screen.getByRole("status").textContent).toMatch(/still pedal with the keyboard/);
    expect(screen.getByRole("button", { name: "Connect bike" })).toBeTruthy();
  });
});
