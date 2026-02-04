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
  // Contains complete implementation: create_coach, create_session, join_session,
  // update_telemetry, trigger_beat, close_session, and view functions
  packageId:
    "0xc42b32ab25566a6f43db001e6f2c2fd6b2ccc7232e2af3cfca0b9beca824d7dc",
  network: "testnet" as const,
};

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
