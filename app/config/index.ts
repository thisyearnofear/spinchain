/**
 * Centralized Configuration
 * 
 * Core Principles:
 * - DRY: Single source of truth for all config values
 * - ORGANIZED: Domain-driven config structure
 * - TYPE-SAFE: Full TypeScript coverage
 * - ENVIRONMENT-AWARE: Different values for dev/staging/prod
 */

// Environment detection
const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";

// ============================================================================
// APP CONFIG
// ============================================================================

export const APP_CONFIG = {
  name: "SpinChain",
  version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://spinchain.xyz",
  description: "Your workout, rewarded. Transform any spin bike into an immersive experience.",
} as const;

// ============================================================================
// BLOCKCHAIN CONFIG
// ============================================================================

export const EVM_CONFIG = {
  // Chain IDs
  chains: {
    avalanche: 43114,
    avalancheFuji: 43113,
    mainnet: 1,
  },
  
  // Contract addresses (from environment)
  contracts: {
    spinToken: process.env.NEXT_PUBLIC_SPIN_TOKEN_ADDRESS || "0x",
    incentiveEngine: process.env.NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS || "0x",
    classFactory: process.env.NEXT_PUBLIC_CLASS_FACTORY_ADDRESS || "0x",
    yellowSettlement: process.env.NEXT_PUBLIC_YELLOW_SETTLEMENT_ADDRESS || "0x",
  },
  
  // RPC URLs
  rpcUrls: {
    avalanche: "https://api.avax.network/ext/bc/C/rpc",
    avalancheFuji: "https://api.avax-test.network/ext/bc/C/rpc",
  },
  
  // Block explorers
  explorers: {
    avalanche: "https://snowtrace.io",
    avalancheFuji: "https://testnet.snowtrace.io",
  },
} as const;

export const SUI_CONFIG = {
  // Network
  network: (process.env.NEXT_PUBLIC_SUI_NETWORK as "mainnet" | "testnet" | "devnet") || "testnet",
  
  // Package ID
  packageId: process.env.NEXT_PUBLIC_SUI_PACKAGE_ID || "0x",
  
  // Treasury cap for minting
  treasuryCapId: process.env.NEXT_PUBLIC_SUI_TREASURY_CAP_ID || "0x",
  
  // RPC URLs
  rpcUrls: {
    mainnet: "https://fullnode.mainnet.sui.io",
    testnet: "https://fullnode.testnet.sui.io",
    devnet: "https://fullnode.devnet.sui.io",
  },
  
  // Explorers
  explorers: {
    mainnet: "https://suiscan.xyz/mainnet",
    testnet: "https://suiscan.xyz/testnet",
    devnet: "https://suiscan.xyz/devnet",
  },
} as const;

// ============================================================================
// AI CONFIG
// ============================================================================

export const AI_CONFIG = {
  // Default provider
  defaultProvider: (process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER as "venice" | "gemini") || "venice",
  
  // Provider settings
  providers: {
    venice: {
      name: "Venice AI",
      baseUrl: "https://api.venice.ai",
      features: ["route-generation", "chat", "coaching"],
    },
    gemini: {
      name: "Google Gemini",
      baseUrl: "https://generativelanguage.googleapis.com",
      features: ["route-generation", "chat", "coaching", "streaming"],
    },
  },
  
  // Request settings
  requestTimeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
} as const;

// ============================================================================
// API CONFIG
// ============================================================================

export const API_CONFIG = {
  baseUrl: "/api",
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
} as const;

// ============================================================================
// STORAGE CONFIG
// ============================================================================

export const STORAGE_CONFIG = {
  // LocalStorage keys
  keys: {
    theme: "spinchain-theme",
    aiPreferences: "spinchain-ai-prefs",
    rideHudMode: "spinchain:ride:hudMode",
    rideViewMode: "spinchain:ride:viewMode",
  },
  
  // Cache durations (ms)
  cacheDuration: {
    profile: 5 * 60 * 1000, // 5 minutes
    routes: 10 * 60 * 1000, // 10 minutes
    classes: 5 * 60 * 1000, // 5 minutes
  },
} as const;

// ============================================================================
// RIDE CONFIG
// ============================================================================

export const RIDE_CONFIG = {
  // Telemetry
  telemetry: {
    sampleRate: {
      mobile: 2, // Hz
      desktop: 4, // Hz
    },
    maxHistory: 300, // Keep last 5 minutes at 1Hz
  },
  
  // Rewards
  rewards: {
    minEffortThreshold: 150,
    defaultRewardAmount: 20,
    recordingInterval: {
      mobile: 500, // ms
      desktop: 250, // ms
    },
  },
  
  // UI
  ui: {
    defaultHudMode: "full" as const,
    defaultViewMode: "immersive" as const,
    mobileHudMode: "compact" as const,
    mobileViewMode: "focus" as const,
  },
} as const;

// ============================================================================
// WALRUS CONFIG
// ============================================================================

export const WALRUS_CONFIG = {
  publisherUrl: process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL || "https://publisher.walrus-testnet.walrus.space",
  aggregatorUrl: process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL || "https://aggregator.walrus-testnet.walrus.space",
} as const;

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FEATURE_FLAGS = {
  enableDebugMode: isDev,
  enableMockData: isDev && process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === "true",
  enableYellowRewards: true,
  enableZkProofs: true,
  enableAiCoaching: true,
  enableSuiPerformance: true,
} as const;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function isValidChainId(chainId: number): boolean {
  return Object.values(EVM_CONFIG.chains).includes(chainId as 43113 | 1 | 43114);
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  const baseUrl = chainId === EVM_CONFIG.chains.avalanche 
    ? EVM_CONFIG.explorers.avalanche
    : EVM_CONFIG.explorers.avalancheFuji;
  return `${baseUrl}/tx/${txHash}`;
}
