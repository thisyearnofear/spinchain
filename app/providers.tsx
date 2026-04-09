'use client';

import React, { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, useAccount, type Config } from 'wagmi';
import { createBrowserWagmiConfig } from './wagmi';
import { SuiProvider } from './sui-provider';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { ThemeProvider, useTheme } from './components/layout/theme-provider';
import { ToastProvider } from './components/ui/toast';

// Stable RainbowKit theme objects (created once, never re-allocated)
const RAINBOWKIT_DARK_THEME = darkTheme({
  accentColor: "#6d7cff",
  accentColorForeground: "white",
  borderRadius: "medium",
  overlayBlur: "small",
});

const RAINBOWKIT_LIGHT_THEME = lightTheme({
  accentColor: "#4f46e5",
  accentColorForeground: "white",
  borderRadius: "medium",
  overlayBlur: "small",
});

const RAINBOWKIT_APP_INFO = {
  appName: "SpinChain",
  learnMoreUrl: "https://spinchain.xyz",
};

// Create a stable query client for SSR
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: typeof window === 'undefined' ? false : 3,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

import { backgroundManager } from './lib/mobile-bridge/background';
import { flushAnalytics } from './lib/analytics/events';

// ... (existing code)

// Hook to handle wallet reconnection on mobile
function useWalletReconnection() {
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const hasAttemptedReconnectRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && typeof window !== 'undefined') {
      initializedRef.current = true;
      backgroundManager.initialize();
    }
  }, []);

  useEffect(() => {
    if (!hasAttemptedReconnectRef.current && !isConnected && !isConnecting && !isReconnecting) {
      hasAttemptedReconnectRef.current = true;
    }
  }, [isConnected, isConnecting, isReconnecting]);
}

// Isolated component so useAccount re-renders don't propagate to RainbowKitProvider
function WalletReconnectionManager() {
  useWalletReconnection();
  return null;
}

// RainbowKit wrapper that responds to theme changes
function RainbowKitThemeWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const rainbowTheme = resolvedTheme === 'dark' 
    ? RAINBOWKIT_DARK_THEME
    : RAINBOWKIT_LIGHT_THEME;

  return (
    <RainbowKitProvider theme={rainbowTheme} appInfo={RAINBOWKIT_APP_INFO}>
      {mounted ? children : <div style={{ visibility: 'hidden' }} />}
    </RainbowKitProvider>
  );
}

// Inner providers that need theme context
function InnerProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(() => getQueryClient());
  const [wagmiConfig, setWagmiConfig] = useState<Config | null>(null);

  useEffect(() => {
    setWagmiConfig(createBrowserWagmiConfig());
    setMounted(true);
  }, []);

  if (!mounted || !wagmiConfig) {
    return (
      <QueryClientProvider client={queryClient}>
        <SuiProvider>
          <div style={{ visibility: 'hidden' }} />
        </SuiProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SuiProvider>
        <WagmiProvider config={wagmiConfig} reconnectOnMount={true}>
          <WalletReconnectionManager />
          <RainbowKitThemeWrapper>
            {children}
          </RainbowKitThemeWrapper>
        </WagmiProvider>
      </SuiProvider>
    </QueryClientProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Flush analytics when page is being unloaded
  useEffect(() => {
    const handleUnload = () => {
      flushAnalytics();
    };
    
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushAnalytics();
      }
    });
    
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);
  
  return (
    <ThemeProvider>
      <ToastProvider>
        <InnerProviders>
          {children}
        </InnerProviders>
      </ToastProvider>
    </ThemeProvider>
  );
}
