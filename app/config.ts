export const CONTRACTS = {
  // Avalanche Fuji Testnet Addresses
  // Replace these with your actual deployed addresses from Remix/Hardhat
  avalanche: {
    spinToken: "0x0000000000000000000000000000000000000000",
    incentiveEngine: "0x0000000000000000000000000000000000000000",
    classFactory: "0x0000000000000000000000000000000000000000",
    biometricOracle: "0x0000000000000000000000000000000000000000",
    // Stablecoin addresses (Avalanche Fuji Testnet)
    usdc: "0x5425890298aed601595a70AB815c96711a31Bc65", // Fuji USDC
    usdt: "0x0000000000000000000000000000000000000000", // Deploy mock or use bridge
  },
} as const;

export const CHAIN_CONFIG = {
  defaultChainId: 43113, // Avalanche Fuji
  explorerUrl: "https://testnet.snowtrace.io",
} as const;

export const SUI_CONFIG = {
  // Deployed Sui Move Package ID (Testnet) - UPDATED 2025-04-02
  // Contains: spinsession (telemetry, sessions, coaches) + spin_token (SPIN rewards)
  packageId:
    process.env.NEXT_PUBLIC_SUI_PACKAGE_ID ||
    "0x98144f86c83bf486d90232833a6ed467aa3d853d237126537241a6e147f2b3f6",
  network: "testnet" as const,
  // Optional: Gas station for sponsored transactions (gasless onboarding)
  gasStationUrl: process.env.NEXT_PUBLIC_SUI_GAS_STATION_URL,
  // SPIN Token Treasury Cap (for minting rewards)
  treasuryCapId: process.env.NEXT_PUBLIC_SUI_TREASURY_CAP_ID,
} as const;

export const ZK_CONFIG = {
  // Noir verifier contract address for effort threshold proofs
  verifierAddress:
    process.env.NEXT_PUBLIC_NOIR_VERIFIER_ADDRESS || "0x0000000000000000000000000000000000000000",
  // Circuit type: "effort_threshold" | "composite"
  defaultCircuit: "effort_threshold" as const,
} as const;

export const CHAINLINK_CONFIG = {
  // Chainlink Functions configuration for biometric oracle
  router: process.env.NEXT_PUBLIC_CHAINLINK_ROUTER || "0x0000000000000000000000000000000000000000",
  donId: process.env.NEXT_PUBLIC_CHAINLINK_DON_ID || "",
  subscriptionId: process.env.NEXT_PUBLIC_CHAINLINK_SUBSCRIPTION_ID || "0",
  gasLimit: 300000,
} as const;

export const PAYMENT_CONFIG = {
  // Default payment method: "native" (AVAX) | "usdc" | "usdt"
  defaultMethod: (process.env.NEXT_PUBLIC_DEFAULT_PAYMENT_METHOD || "usdc") as "native" | "usdc" | "usdt",
  // Instructor revenue share (70-90%)
  defaultInstructorShare: 8000, // 80%
  // Protocol fee (10-30%)
  defaultProtocolFee: 2000, // 20%
} as const;

export const AI_SERVICE_CONFIG = {
  // Venice AI for agent reasoning (preferred for real-time coach decisions)
  venice: {
    apiKey: process.env.VENICE_API_KEY,
    enabled: !!process.env.VENICE_API_KEY,
  },
  // Gemini as fallback for route generation and chat
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    enabled: !!process.env.GEMINI_API_KEY,
  },
} as const;

export const AI_CONFIG = {
  provider: "gemini" as const,
  model: "gemini-2.0-flash-exp", // Fallback / current stable
  experimentalModel: "gemini-3.0-flash-preview", // New frontier model
  features: {
    voiceInput: true,
    routeLibrary: true,
    advancedPrompts: true,
  },
  limits: {
    maxRouteLength: 200, // km
    maxDuration: 180, // minutes
    maxPromptLength: 500,
  },
} as const;
