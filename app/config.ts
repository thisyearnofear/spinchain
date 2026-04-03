import { 
  CONTRACT_ADDRESSES, 
  ACTIVE_NETWORK,
  BIOMETRIC_ORACLE_ADDRESS,
  isZeroAddress,
} from "@/app/lib/contracts";

type PaymentMethod = "native" | "usdc" | "usdt";
type RewardVerificationMode = "zk" | "chainlink";

function configuredAddress(address?: string | null): `0x${string}` | null {
  return isZeroAddress(address) ? null : (address as `0x${string}`);
}

function configuredWorkflowId(value?: string | null): `0x${string}` | null {
  if (!value) return null;
  return /^0x0{64}$/i.test(value) ? null : (value as `0x${string}`);
}

function resolveDefaultPaymentMethod(): PaymentMethod {
  const requested = process.env.NEXT_PUBLIC_DEFAULT_PAYMENT_METHOD;
  if (requested === "native" || requested === "usdc" || requested === "usdt") {
    return requested === "usdt" && !configuredAddress(process.env.NEXT_PUBLIC_USDT_ADDRESS)
      ? "usdc"
      : requested;
  }

  return configuredAddress(process.env.NEXT_PUBLIC_USDT_ADDRESS) ? "usdt" : "usdc";
}

function resolveRewardVerificationMode(): RewardVerificationMode {
  const requested = process.env.NEXT_PUBLIC_REWARD_VERIFICATION_MODE;
  if (requested === "zk" || requested === "chainlink") {
    return requested;
  }

  return configuredAddress(CONTRACT_ADDRESSES.EFFORT_VERIFIER)
    ? "zk"
    : "chainlink";
}

export const CONTRACTS = {
  // Avalanche Fuji Testnet Addresses
  avalanche: {
    spinToken: CONTRACT_ADDRESSES.SPIN_TOKEN,
    incentiveEngine: CONTRACT_ADDRESSES.INCENTIVE_ENGINE,
    classFactory: CONTRACT_ADDRESSES.CLASS_FACTORY,
    biometricOracle: BIOMETRIC_ORACLE_ADDRESS,
    // Stablecoin addresses (Avalanche Fuji Testnet)
    usdc: "0x5425890298aed601595a70AB815c96711a31Bc65", // Fuji USDC
    usdt: configuredAddress(process.env.NEXT_PUBLIC_USDT_ADDRESS),
  },
} as const;

export const CHAIN_CONFIG = {
  defaultChainId: ACTIVE_NETWORK.id,
  explorerUrl: ACTIVE_NETWORK.explorerUrl,
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
  // Uses ULTRA_VERIFIER from deployed contracts (with fallback to env)
  verifierAddress:
    configuredAddress(process.env.NEXT_PUBLIC_NOIR_VERIFIER_ADDRESS) ??
    configuredAddress(CONTRACT_ADDRESSES.ULTRA_VERIFIER),
  // Circuit type: "effort_threshold" | "composite"
  defaultCircuit: "effort_threshold" as const,
} as const;

export const CHAINLINK_CONFIG = {
  // Chainlink Runtime Environment (CRE) configuration for biometric oracle
  // Uses CRE_FORWARDER from deployed contracts (with fallback to env)
  forwarder:
    configuredAddress(process.env.NEXT_PUBLIC_CHAINLINK_FORWARDER) ??
    configuredAddress(CONTRACT_ADDRESSES.CRE_FORWARDER),
  workflowId: configuredWorkflowId(process.env.NEXT_PUBLIC_CHAINLINK_WORKFLOW_ID),
  gasLimit: 300000,
} as const;

export const REWARD_VERIFICATION = {
  mode: resolveRewardVerificationMode(),
  zkEnabled: configuredAddress(CONTRACT_ADDRESSES.EFFORT_VERIFIER) !== null,
  chainlinkEnabled: configuredAddress(BIOMETRIC_ORACLE_ADDRESS) !== null,
} as const;

export const PAYMENT_CONFIG = {
  // Default payment method: "native" (AVAX) | "usdc" | "usdt"
  defaultMethod: resolveDefaultPaymentMethod(),
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
  provider: "venice" as const,
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
