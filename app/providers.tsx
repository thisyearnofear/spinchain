'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from './wagmi';
import { SuiProvider } from './sui-provider';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { ThemeProvider, useTheme } from './components/theme-provider';
import { ToastProvider } from './components/toast';

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

// RainbowKit wrapper that responds to theme changes
function RainbowKitThemeWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <RainbowKitProvider theme={rainbowTheme}>
      {mounted ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
    </RainbowKitProvider>
  );
}

// Inner providers that need theme context
function InnerProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SuiProvider>
        <WagmiProvider config={config}>
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
