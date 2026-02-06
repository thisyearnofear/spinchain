/**
 * Contract Definitions and Utilities
 * 
 * Core Principles:
 * - SINGLE SOURCE OF TRUTH: All contract-related code in one place
 * - CLEAN: Clear separation between ABIs (blockchain) and metadata (application)
 * - ORGANIZED: Domain-driven exports grouped by concern
 */

import type { GeneratedRoute } from "./ai-service";

// ============================================================================
// CONTRACT ADDRESSES
// ============================================================================

export const CLASS_FACTORY_ADDRESS = "0x0000000000000000000000000000000000000000"; // Replace with actual
export const INCENTIVE_ENGINE_ADDRESS = "0x0000000000000000000000000000000000000000"; // Replace with actual
export const SPIN_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000"; // Replace with actual

// ============================================================================
// CONTRACT ABIs
// ============================================================================

export const CLASS_FACTORY_ABI = [
  {
    "type": "function",
    "name": "createClass",
    "inputs": [
      { "name": "name", "type": "string" },
      { "name": "symbol", "type": "string" },
      { "name": "classMetadata", "type": "string" },
      { "name": "startTime", "type": "uint256" },
      { "name": "endTime", "type": "uint256" },
      { "name": "maxRiders", "type": "uint256" },
      { "name": "basePrice", "type": "uint256" },
      { "name": "maxPrice", "type": "uint256" },
      { "name": "treasury", "type": "address" },
      { "name": "incentiveEngine", "type": "address" }
    ],
    "outputs": [{ "name": "spinClass", "type": "address" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "ClassCreated",
    "inputs": [
      { "indexed": true, "name": "instructor", "type": "address" },
      { "indexed": true, "name": "spinClass", "type": "address" },
      { "indexed": true, "name": "classId", "type": "bytes32" },
      { "name": "startTime", "type": "uint256" },
      { "name": "endTime", "type": "uint256" },
      { "name": "maxRiders", "type": "uint256" }
    ]
  }
] as const;

export const SPIN_CLASS_ABI = [
  {
    "type": "function",
    "name": "purchaseTicket",
    "inputs": [],
    "outputs": [{ "name": "tokenId", "type": "uint256" }],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "checkIn",
    "inputs": [{ "name": "tokenId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "currentPrice",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ticketsSold",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "attended",
    "inputs": [{ "name": "", "type": "address" }],
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "settleRevenue",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
] as const;

export const INCENTIVE_ENGINE_ABI = [
  {
    "type": "function",
    "name": "submitAttestation",
    "inputs": [
      { "name": "spinClass", "type": "address" },
      { "name": "rider", "type": "address" },
      { "name": "rewardAmount", "type": "uint256" },
      { "name": "classId", "type": "bytes32" },
      { "name": "claimHash", "type": "bytes32" },
      { "name": "timestamp", "type": "uint256" },
      { "name": "signature", "type": "bytes" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
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
    distance: number;          // km
    duration: number;          // minutes
    elevationGain: number;     // meters
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
    basePrice: string;         // in ETH
    maxPrice: string;          // in ETH
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
  route: GeneratedRoute;
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
  walrusRoute: GeneratedRoute
): boolean {
  const expectedChecksum = generateSimpleHash(walrusRoute);
  return metadata.route.checksum === expectedChecksum;
}

// ============================================================================
// PRIVATE UTILITIES
// ============================================================================

function generateSimpleHash(route: GeneratedRoute): string {
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
