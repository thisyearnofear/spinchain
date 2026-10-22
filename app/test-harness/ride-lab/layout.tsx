import type { Metadata } from "next";

/**
 * Dev-only experiment route. Never indexed, never linked from product UI.
 */
export const metadata: Metadata = {
  title: "Ride Lab",
  robots: { index: false, follow: false },
};

export default function RideLabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
