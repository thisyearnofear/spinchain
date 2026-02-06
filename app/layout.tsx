import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";
import { SmoothScrollProvider } from "./components/smooth-scroll";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpinChain — Your Workout, Rewarded",
  description:
    "Join immersive indoor cycling classes. Earn SPIN tokens for hitting your effort goals. Your data stays private.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚴</text></svg>",
  },
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
        </Providers>
      </body>
    </html>
  );
}
