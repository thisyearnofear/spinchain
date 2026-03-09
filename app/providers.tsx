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

// ... (existing code)

// Hook to handle wallet reconnection on mobile
function useWalletReconnection() {
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const hasAttemptedReconnectRef = useRef(false);

  useEffect(() => {
    // Initialize background manager for native session persistence
    backgroundManager.initialize();
    
    // On mobile, wallet connections can be flaky after page navigation
    // This ensures we attempt reconnection once on mount
    if (!hasAttemptedReconnectRef.current && !isConnected && !isConnecting && !isReconnecting) {
      hasAttemptedReconnectRef.current = true;
    }
  }, [isConnected, isConnecting, isReconnecting]);
}

// RainbowKit wrapper that responds to theme changes
function RainbowKitThemeWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Handle mobile wallet reconnection
  useWalletReconnection();

  const rainbowTheme = resolvedTheme === 'dark' 
    ? darkTheme({
        accentColor: "#6d7cff",
        accentColorForeground: "white",
        borderRadius: "medium",
        overlayBlur: "small",
      })
    : lightTheme({
        accentColor: "#4f46e5",
        accentColorForeground: "white",
        borderRadius: "medium",
        overlayBlur: "small",
      });

  return (
    <RainbowKitProvider 
      theme={rainbowTheme}
      appInfo={{
        appName: "SpinChain",
        learnMoreUrl: "https://spinchain.xyz",
      }}
    >
      {mounted ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
    </RainbowKitProvider>
  );
}

// Inner providers that need theme context
function InnerProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());
  const [wagmiConfig] = useState(() => createBrowserWagmiConfig());

  return (
    <QueryClientProvider client={queryClient}>
      <SuiProvider>
        <WagmiProvider config={wagmiConfig} reconnectOnMount={true}>
          <RainbowKitThemeWrapper>
            <ToastProvider>
              {children}
            </ToastProvider>
          </RainbowKitThemeWrapper>
        </WagmiProvider>
      </SuiProvider>
    </QueryClientProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <InnerProviders>
        {children}
      </InnerProviders>
    </ThemeProvider>
  );
}
