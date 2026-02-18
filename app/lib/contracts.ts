/**
 * Contract Definitions and Utilities
 *
 * Core Principles:
 * - SINGLE SOURCE OF TRUTH: All contract addresses, ABIs, and network config here
 * - CLEAN: Clear separation between ABIs (blockchain) and metadata (application)
 * - ORGANIZED: Domain-driven exports grouped by concern
 */

import type { RouteResponse } from "./ai-service";

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

export const AVALANCHE_FUJI = {
  id: 43113,
  name: "Avalanche Fuji Testnet",
  rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
  explorerUrl: "https://testnet.snowtrace.io",
  nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
} as const;

export const AVALANCHE_MAINNET = {
  id: 43114,
  name: "Avalanche C-Chain",
  rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
  explorerUrl: "https://snowtrace.io",
  nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
} as const;

// Active network — switch to AVALANCHE_MAINNET for production
export const ACTIVE_NETWORK = AVALANCHE_FUJI;

// ============================================================================
// CONTRACT ADDRESSES
// Populate these after running contracts/DEPLOY_REMIX.md
// ============================================================================

export const CONTRACT_ADDRESSES = {
  /** ERC-20 SPIN reward token */
  SPIN_TOKEN: (process.env.NEXT_PUBLIC_SPIN_TOKEN_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,

  /** Distributes SPIN rewards via ECDSA attestation or ZK proof */
  INCENTIVE_ENGINE: (process.env.NEXT_PUBLIC_INCENTIVE_ENGINE_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,

  /** Factory that deploys per-class SpinClass contracts */
  CLASS_FACTORY: (process.env.NEXT_PUBLIC_CLASS_FACTORY_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,

  /** Noir-generated UltraVerifier (or MockUltraVerifier on testnet) */
  ULTRA_VERIFIER: (process.env.NEXT_PUBLIC_ULTRA_VERIFIER_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,

  /** EffortThresholdVerifier — wraps UltraVerifier with replay protection */
  EFFORT_VERIFIER: (process.env.NEXT_PUBLIC_EFFORT_VERIFIER_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,

  /** Revenue splitter for instructor/platform split */
  TREASURY_SPLITTER: (process.env.NEXT_PUBLIC_TREASURY_SPLITTER_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,

  /** Yellow state channel settlement */
  YELLOW_SETTLEMENT: (process.env.NEXT_PUBLIC_YELLOW_SETTLEMENT_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
} as const;

// Legacy named exports (used throughout the codebase)
export const CLASS_FACTORY_ADDRESS = CONTRACT_ADDRESSES.CLASS_FACTORY;
export const INCENTIVE_ENGINE_ADDRESS = CONTRACT_ADDRESSES.INCENTIVE_ENGINE;
export const SPIN_TOKEN_ADDRESS = CONTRACT_ADDRESSES.SPIN_TOKEN;

// ============================================================================
// CONTRACT ABIs
// ============================================================================

export const SPIN_TOKEN_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "remainingSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const CLASS_FACTORY_ABI = [
  {
    type: "function",
    name: "createClass",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "classMetadata", type: "string" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "maxRiders", type: "uint256" },
      { name: "basePrice", type: "uint128" },
      { name: "maxPrice", type: "uint128" },
      { name: "treasury", type: "address" },
      { name: "incentiveEngine", type: "address" },
      { name: "spinToken", type: "address" },
    ],
    outputs: [{ name: "spinClass", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getClassesByInstructor",
    inputs: [{ name: "instructor", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getClasses",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getClassCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verifyClass",
    inputs: [{ name: "classAddress", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ClassCreated",
    inputs: [
      { indexed: true, name: "instructor", type: "address" },
      { indexed: true, name: "spinClass", type: "address" },
      { indexed: true, name: "classId", type: "bytes32" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "maxRiders", type: "uint256" },
    ],
  },
] as const;

export const SPIN_CLASS_ABI = [
  // ---- Write ----
  {
    type: "function",
    name: "purchaseTicket",
    inputs: [],
    outputs: [{ name: "tokenId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "checkIn",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settleRevenue",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelClass",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimRefund",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ---- Read ----
  {
    type: "function",
    name: "currentPrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "priceForUser",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "basePrice", type: "uint256" },
      { name: "discountedPrice", type: "uint256" },
      { name: "tier", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ticketsSold",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxRiders",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "startTime",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "endTime",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "classMetadata",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasAttended",
    inputs: [{ name: "rider", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "attended",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "cancelled",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  // ---- Events ----
  {
    type: "event",
    name: "TicketPurchased",
    inputs: [
      { indexed: true, name: "rider", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
      { name: "pricePaid", type: "uint256" },
      { name: "tier", type: "uint8" },
    ],
  },
  {
    type: "event",
    name: "CheckedIn",
    inputs: [
      { indexed: true, name: "rider", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
  },
] as const;

export const INCENTIVE_ENGINE_ABI = [
  {
    type: "function",
    name: "submitAttestation",
    inputs: [
      { name: "spinClass", type: "address" },
      { name: "rider", type: "address" },
      { name: "rewardAmount", type: "uint256" },
      { name: "classId", type: "bytes32" },
      { name: "claimHash", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    // rewardAmount removed — calculated on-chain from effortScore
    type: "function",
    name: "submitZKProof",
    inputs: [
      { name: "proof", type: "bytes" },
      { name: "publicInputs", type: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "calculateReward",
    inputs: [{ name: "effortScore", type: "uint16" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "calculateRewardWithTier",
    inputs: [
      { name: "effortScore", type: "uint16" },
      { name: "rider", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserTier",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalClaimed",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ZKRewardClaimed",
    inputs: [
      { indexed: true, name: "rider", type: "address" },
      { indexed: true, name: "classId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "effortScore", type: "uint16" },
    ],
  },
  {
    type: "event",
    name: "RewardClaimed",
    inputs: [
      { indexed: true, name: "rider", type: "address" },
      { indexed: true, name: "spinClass", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "attestationId", type: "bytes32" },
    ],
  },
] as const;

// ============================================================================
// METADATA TYPES (Application Layer)
// ============================================================================

export interface EnhancedClassMetadata {
  version: "2.0";

  // Basic info
  name: string;
  description: string;
  instructor: string;

  // Schedule
  startTime: number;
  endTime: number;
  duration: number; // in minutes

  // Route information
  route: {
    walrusBlobId: string;
    name: string;
    distance: number; // km
    duration: number; // minutes
    elevationGain: number; // meters
    theme: "neon" | "alpine" | "mars";
    checksum: string;
    storyBeatsCount: number;
  };

  // AI configuration
  ai: {
    enabled: boolean;
    personality: "zen" | "drill-sergeant" | "data";
    autoTriggerBeats: boolean;
    adaptiveDifficulty: boolean;
  };

  // Economics
  pricing: {
    basePrice: string; // in ETH
    maxPrice: string; // in ETH
    curveType: string;
  };

  rewards: {
    enabled: boolean;
    threshold: number;
    amount: number;
  };
}

export interface OnChainRouteRef {
  walrusBlobId: string;
  checksum: string;
  deployedAt: number;
}

// ============================================================================
// METADATA UTILITIES
// ============================================================================

export function parseClassMetadata(
  metadataJson: string
): EnhancedClassMetadata | null {
  try {
    const parsed = JSON.parse(metadataJson);
    if (parsed.version !== "2.0") {
      console.warn("Legacy metadata format, route info may be missing");
    }
    return parsed as EnhancedClassMetadata;
  } catch (error) {
    console.error("Failed to parse class metadata:", error);
    return null;
  }
}

export function serializeClassMetadata(
  metadata: EnhancedClassMetadata
): string {
  return JSON.stringify(metadata);
}

export function createClassMetadata(params: {
  name: string;
  description: string;
  instructor: string;
  startTime: number;
  endTime: number;
  basePrice: string;
  maxPrice: string;
  curveType: string;
  rewardThreshold: number;
  rewardAmount: number;
  route: RouteResponse;
  walrusBlobId: string;
  aiEnabled: boolean;
  aiPersonality: "zen" | "drill-sergeant" | "data";
}): EnhancedClassMetadata {
  const duration = Math.floor((params.endTime - params.startTime) / 60);

  return {
    version: "2.0",
    name: params.name,
    description: params.description,
    instructor: params.instructor,
    startTime: params.startTime,
    endTime: params.endTime,
    duration,
    route: {
      walrusBlobId: params.walrusBlobId,
      name: params.route.name,
      distance: params.route.estimatedDistance,
      duration: params.route.estimatedDuration,
      elevationGain: params.route.elevationGain,
      theme: "neon",
      checksum: generateSimpleHash(params.route),
      storyBeatsCount: params.route.storyBeats.length,
    },
    ai: {
      enabled: params.aiEnabled,
      personality: params.aiPersonality,
      autoTriggerBeats: true,
      adaptiveDifficulty: params.aiEnabled,
    },
    pricing: {
      basePrice: params.basePrice,
      maxPrice: params.maxPrice,
      curveType: params.curveType,
    },
    rewards: {
      enabled: params.rewardAmount > 0,
      threshold: params.rewardThreshold,
      amount: params.rewardAmount,
    },
  };
}

export function validateRouteIntegrity(
  metadata: EnhancedClassMetadata,
  walrusRoute: RouteResponse
): boolean {
  const expectedChecksum = generateSimpleHash(walrusRoute);
  return metadata.route.checksum === expectedChecksum;
}

// ============================================================================
// PRIVATE UTILITIES
// ============================================================================

function generateSimpleHash(route: RouteResponse): string {
  const data = JSON.stringify({
    name: route.name,
    distance: route.estimatedDistance,
    elevation: route.elevationGain,
    beats: route.storyBeats.length,
  });

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(36);
}
