import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";
import { SmoothScrollProvider } from "@/app/components/ui/smooth-scroll";
import { ErrorBoundary } from "@/app/components/layout/error-boundary";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
  // 300 (light) has zero usages in markup or CSS — don't ship the file.
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "SpinChain — Indoor Cycling That Reacts to You",
  description:
    "Immersive indoor cycling where the 3D world transforms with your effort. Ride alone or with friends. Your data stays yours.",

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SpinChain",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Script to prevent flash of wrong theme
const themeScript = `
  (function() {
    function getTheme() {
      const saved = localStorage.getItem('spinchain-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (saved === 'system' || !saved) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'dark';
    }
    document.documentElement.classList.add(getTheme());
    document.documentElement.classList.add('no-transitions');
    window.addEventListener('load', () => {
      document.documentElement.classList.remove('no-transitions');
    });
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Rive wasm is ~1.9 MB and was fetched only when a ride mounted.
            Prefetch (not preload): it lands in cache at idle priority so a
            ride start is still warm, without competing with the landing
            page's critical resources on every first visit. */}
        <link rel="prefetch" href="/rive/rive.wasm" as="fetch" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${outfit.variable} ${jetbrainsMono.variable} antialiased`}>
        <ErrorBoundary>
          <Providers>
            <SmoothScrollProvider>{children}</SmoothScrollProvider>
          </Providers>
        </ErrorBoundary>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
