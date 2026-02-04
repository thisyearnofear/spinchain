export const CONTRACTS = {
  // Avalanche Fuji Testnet Addresses
  // Replace these with your actual deployed addresses from Remix/Hardhat
  avalanche: {
    spinToken: "0x0000000000000000000000000000000000000000",
    incentiveEngine: "0x0000000000000000000000000000000000000000",
    classFactory: "0x0000000000000000000000000000000000000000",
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
