// @vitest-environment jsdom
// PrimaryCTA routing regression tests.

import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrimaryCTA } from "../primary-cta";

vi.mock("@rainbow-me/rainbowkit", () => ({
  ConnectButton: {
    Custom: ({
      children,
    }: {
      children: (props: {
        openConnectModal: () => void;
        mounted: boolean;
      }) => React.ReactNode;
    }) =>
      children({ openConnectModal: () => {}, mounted: true }),
  },
}));

const CLASS = {
  name: "Sunrise Sprint",
  address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
};

function html(ui: React.ReactElement) {
  return renderToStaticMarkup(ui);
}

describe("PrimaryCTA", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("routes to the class ADDRESS, displaying the class NAME", () => {
    const out = html(
      <PrimaryCTA isConnected={true} nextClass={CLASS} />,
    );
    expect(out).toContain(`href="/rider/ride/${CLASS.address}"`);
    expect(out).toContain("Ride: Sunrise Sprint");
    expect(out).not.toContain(encodeURIComponent(CLASS.name));
  });

  it("falls back to the demo ride when the address is missing or invalid", () => {
    const missing = html(<PrimaryCTA isConnected={true} />);
    expect(missing).toContain('href="/rider/ride/demo');

    const invalid = html(
      <PrimaryCTA
        isConnected={true}
        nextClass={{
          name: "Sunrise Sprint",
          address: "Sunrise Sprint" as `0x${string}`,
        }}
      />,
    );
    expect(invalid).toContain('href="/rider/ride/demo');
    expect(invalid).not.toContain("Ride: Sunrise Sprint");
  });

  it("guests still get the frictionless demo path", () => {
    const out = html(<PrimaryCTA isConnected={false} />);
    expect(out).toContain('href="/rider/ride/demo');
  });

  it("guests with ride history still get the demo path by default", () => {
    const out = html(
      <PrimaryCTA isConnected={false} hasRides={true} />,
    );
    expect(out).toContain('href="/rider/ride/demo');
    expect(out).not.toContain("Connect wallet to keep your rewards");
  });

  it("guests with ride history are asked to connect when legacy rewards are enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_LEGACY_REWARD_CLAIMS", "true");
    const out = html(
      <PrimaryCTA isConnected={false} hasRides={true} />,
    );
    expect(out).toContain("Connect wallet to keep your rewards");
  });
});
