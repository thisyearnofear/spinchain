import type { Metadata } from "next";

/**
 * Dev-only visual regression route. Never indexed, never linked from the app.
 * (Wedge review 2026-10-03: ships in the prod bundle, so keep it uncrawlable.)
 */
export const metadata: Metadata = {
  title: "Test Harness",
  robots: { index: false, follow: false },
};

export default function TestHarnessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
