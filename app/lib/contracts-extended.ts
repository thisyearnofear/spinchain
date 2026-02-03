/**
 * Extended Contract Types with Route Support
 * Enhances existing contract ABIs with route metadata
 */

import type { GeneratedRoute } from "./ai-service";
import type { StoryBeat } from "../routes/builder/gpx-uploader";

/**
 * Enhanced class metadata with route information
 * Stored as JSON string in SpinClass.classMetadata
 */
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
  
  // Route information (NEW)
  route: {
    walrusBlobId: string;      // Primary storage reference
    name: string;
    distance: number;          // km
    duration: number;          // minutes
    elevationGain: number;     // meters
    theme: "neon" | "alpine" | "mars";
    checksum: string;          // Integrity verification
    storyBeatsCount: number;   // For quick preview
  };
  
  // AI configuration (NEW)
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
    threshold: number;         // Effort threshold
    amount: number;            // SPIN tokens
  };
}

/**
 * Route reference stored in contract
 * Minimal data on-chain, full route on Walrus
 */
export interface OnChainRouteRef {
  walrusBlobId: string;
  checksum: string;
  deployedAt: number;
}

/**
 * Parse metadata from contract
 */
export function parseClassMetadata(
  metadataJson: string
): EnhancedClassMetadata | null {
  try {
    const parsed = JSON.parse(metadataJson);
    
    // Validate version
    if (parsed.version !== "2.0") {
      console.warn("Legacy metadata format, route info may be missing");
    }
    
    return parsed as EnhancedClassMetadata;
  } catch (error) {
    console.error("Failed to parse class metadata:", error);
    return null;
  }
}

/**
 * Serialize metadata for contract storage
 */
export function serializeClassMetadata(
  metadata: EnhancedClassMetadata
): string {
  return JSON.stringify(metadata);
}

/**
 * Create metadata from class form + route
 */
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
      theme: "neon", // Could be derived from route
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

/**
 * Simple hash for integrity checking
 */
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

/**
 * Validate route metadata matches Walrus data
 */
export function validateRouteIntegrity(
  metadata: EnhancedClassMetadata,
  walrusRoute: GeneratedRoute
): boolean {
  const expectedChecksum = generateSimpleHash(walrusRoute);
  return metadata.route.checksum === expectedChecksum;
}
