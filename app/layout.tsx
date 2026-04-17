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

const reactLoopDetectorScript = `
  (function() {
    if (window.__SPINCHAIN_REACT_LOOP_DETECTOR__) return;
    window.__SPINCHAIN_REACT_LOOP_DETECTOR__ = true;

    const LOOP_WINDOW_MS = 2500;
    const LOOP_THRESHOLD = 18;
    const recent = [];

    function recordRenderLoopSignal(source, payload) {
      const now = Date.now();
      recent.push(now);
      while (recent.length && now - recent[0] > LOOP_WINDOW_MS) {
        recent.shift();
      }

      if (recent.length >= LOOP_THRESHOLD) {
        const error = new Error('[ReactLoopDetector] probable update loop');
        console.groupCollapsed('[ReactLoopDetector] probable update loop detected');
        console.log('source:', source);
        console.log('signalsInWindow:', recent.length);
        console.log('windowMs:', LOOP_WINDOW_MS);
        console.log('payload:', payload);
        console.log('stack:', error.stack);
        console.groupEnd();

        window.dispatchEvent(new CustomEvent('spinchain:react-loop-detected', {
          detail: {
            source,
            payload,
            signalsInWindow: recent.length,
            windowMs: LOOP_WINDOW_MS,
            timestamp: now,
            stack: error.stack,
          },
        }));
      }
    }

    const originalConsoleError = console.error;
    console.error = function patchedConsoleError(...args) {
      try {
        const first = args[0];
        const text = typeof first === 'string'
          ? first
          : (first && typeof first.message === 'string' ? first.message : '');
        if (
          text.includes('Maximum update depth exceeded') ||
          text.includes('Minified React error #185')
        ) {
          recordRenderLoopSignal('console.error', args);
        }
      } catch {
        // no-op
      }
      return originalConsoleError.apply(console, args);
    };

    window.addEventListener('error', function(ev) {
      try {
        const message = (ev && ev.message) || '';
        if (
          message.includes('Maximum update depth exceeded') ||
          message.includes('Minified React error #185')
        ) {
          recordRenderLoopSignal('window.error', {
            message,
            filename: ev.filename,
            lineno: ev.lineno,
            colno: ev.colno,
          });
        }
      } catch {
        // no-op
      }
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
        {process.env.NEXT_PUBLIC_REACT_LOOP_DETECTOR === "1" && (
          <script dangerouslySetInnerHTML={{ __html: reactLoopDetectorScript }} />
        )}
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
