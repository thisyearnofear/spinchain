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
  // Deployed Sui Move Package ID (Testnet)
  packageId:
    "0x9f693e5143b4c80e7acb4f5fb4e2c62648f036c8fe70044fdcd5688fb9f8681d",
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
