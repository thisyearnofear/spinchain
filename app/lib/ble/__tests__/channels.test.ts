import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { observeChannels } from "../channels";
import type { ChannelPresence } from "../types";

const NONE: ChannelPresence = { power: false, cadence: false, heartRate: false, speed: false };

describe("observeChannels", () => {
  it("reports only what the first notification actually carried", () => {
    // An FTMS Indoor Bike Data notification with watts, cadence and speed but
    // no heart-rate field — the common "bike only, no strap" case.
    const seen = observeChannels(undefined, { power: 210, cadence: 88, speed: 31.4, distance: 1.2 });

    expect(seen).toEqual({ power: true, cadence: true, speed: true, heartRate: false });
  });

  it("treats a reported zero as a live channel", () => {
    // The whole point: a rider who has stopped pedaling still has a watts
    // channel, and the effort model must not read that as "no hardware".
    expect(observeChannels(undefined, { power: 0, cadence: 0, speed: 0 }).power).toBe(true);
  });

  it("keeps an absent channel absent when it is undefined", () => {
    const seen = observeChannels(NONE, { heartRate: 142 });

    expect(seen).toEqual({ power: false, cadence: false, heartRate: true, speed: false });
  });

  it("accumulates across notifications, because the characteristics tick separately", () => {
    const afterBike = observeChannels(undefined, { power: 205, cadence: 90, speed: 29 });
    const afterStrap = observeChannels(afterBike, { heartRate: 151 });

    expect(afterStrap).toEqual({ power: true, cadence: true, speed: true, heartRate: true });
  });

  it("never forgets a channel that has already been seen", () => {
    // A dropped or partial later notification must not demote a channel: the
    // zero-fill downstream would then look like the hardware vanished.
    const seen = observeChannels({ power: true, cadence: true, heartRate: true, speed: true }, {});

    expect(seen).toEqual({ power: true, cadence: true, heartRate: true, speed: true });
  });

  it("ignores fields that are not effort channels", () => {
    const seen = observeChannels(undefined, {
      resistance: 45,
      distance: 3.2,
      wBal: 9000,
      wBalPercentage: 40,
      currentGear: 6,
      gearRatio: 2.1,
    });

    expect(seen).toEqual(NONE);
  });
});

// Advisory, in the spirit of the "no useFrame" checks: it guards the structural
// fact that both transports answer channel presence the same way. Two private
// copies of this logic is exactly how the native build ended up reporting no
// channels at all, so a rider on a real bike got a frozen world while every
// web-side test stayed green.
describe("BLE transports share one channel-presence contract", () => {
  const TRANSPORTS = ["app/lib/ble/service.ts", "app/lib/mobile-bridge/ble.ts"];

  it.each(TRANSPORTS)("derives channels in %s", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(source).toMatch(/channels:\s*observeChannels\(/);
    expect(source).toMatch(/import\s*\{[^}]*observeChannels[^}]*\}\s*from\s*["'][^"']*channels["']/s);
  });

  it("leaves no transport with its own private copy", () => {
    for (const file of TRANSPORTS) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/private observeChannels\s*\(/);
    }
  });
});
