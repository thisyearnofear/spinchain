import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";
import { SmoothScrollProvider } from "@/app/components/ui/smooth-scroll";
import { ErrorBoundary } from "@/app/components/layout/error-boundary";

export const metadata: Metadata = {
  title: "SpinChain — Your Workout, Rewarded",
  description:
    "Join immersive indoor cycling classes. Earn SPIN tokens for hitting your effort goals. Your data stays private.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚴</text></svg>",
    apple: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚴</text></svg>",
  },
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
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ErrorBoundary>
          <Providers>
            <SmoothScrollProvider>{children}</SmoothScrollProvider>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
