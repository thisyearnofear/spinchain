'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from './wagmi';
import { SuiProvider } from './sui-provider';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';

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

// Wrapper for client-only providers
function ClientProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial hydration, render without RainbowKit
  // This prevents hydration mismatches and QueryClient issues
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <RainbowKitProvider
      theme={darkTheme({
        accentColor: "#6d7cff",
        accentColorForeground: "white",
        borderRadius: "medium",
        overlayBlur: "small",
      })}
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  // IMPORTANT: QueryClientProvider must wrap SuiProvider because
  // @mysten/dapp-kit uses @tanstack/react-query internally
  return (
    <QueryClientProvider client={queryClient}>
      <SuiProvider>
        <WagmiProvider config={config}>
          <ClientProviders>
            {children}
          </ClientProviders>
        </WagmiProvider>
      </SuiProvider>
    </QueryClientProvider>
  );
}
