/**
 * Route Storage Integration
 * Manages route storage across LocalStorage (library) and Walrus (deployed classes)
 * DRY: Single source of truth for route persistence
 */

import type { GeneratedRoute } from "./ai-service";
import type { SavedRoute } from "./route-library";
import { getAssetManager, getWalrusClient } from "./walrus/client";
import type { StoreResult, RetrieveResult } from "./walrus/types";

/**
 * Route deployment record
 * Links a route from the library to a deployed class
 */
export interface RouteDeployment {
  routeId: string;           // Local library ID
  walrusBlobId: string;      // Decentralized storage reference
  classId: string;           // SpinClass contract address
  chainId: number;           // 43113 (Avalanche Fuji)
  instructor: string;        // Instructor address
  deployedAt: string;        // ISO timestamp
  checksum: string;          // Route data integrity check
}

/**
 * Route metadata stored on Walrus
 * Complete route data for class execution
 */
export interface WalrusRouteData {
  version: "1.0";
  route: GeneratedRoute;
  deployment: {
    classId: string;
    instructor: string;
    deployedAt: string;
  };
  checksum: string;
}

/**
 * Upload route to Walrus
 * Returns blob ID for storage in smart contract
 */
export async function uploadRouteToWalrus(
  route: GeneratedRoute,
  metadata: {
    classId: string;
    instructor: string;
  }
): Promise<StoreResult> {
  const assetManager = getAssetManager();

  // Prepare route data with metadata
  const routeData: WalrusRouteData = {
    version: "1.0",
    route,
    deployment: {
      classId: metadata.classId,
      instructor: metadata.instructor,
      deployedAt: new Date().toISOString(),
    },
    checksum: generateChecksum(route),
  };

  try {
    // Convert to JSON and encode
    const jsonString = JSON.stringify(routeData);
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);

    // Store on Walrus
    const result = await assetManager.storeWorld(
      {
        ...routeData,
        metadata: {
          name: route.name,
          description: route.description,
          createdAt: Date.now(),
          owner: metadata.instructor,
          classId: metadata.classId,
        },
      },
      {
        name: route.name,
        classId: metadata.classId,
        owner: metadata.instructor,
      }
    );

    if (!result) {
      throw new Error("Failed to upload route to Walrus");
    }

    console.log("✓ Route uploaded to Walrus:", result.blobId);
    return {
      success: true,
      blobId: result.blobId,
      urls: {
        primary: result.urls.primary,
        walrusUri: `walrus://${result.blobId}`,
      },
    };
  } catch (error) {
    console.error("Failed to upload route:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Retrieve route from Walrus
 * Used by riders to load class route data
 */
export async function retrieveRouteFromWalrus(
  blobId: string
): Promise<WalrusRouteData | null> {
  const client = getWalrusClient();

  try {
    const result = await client.retrieveJSON<WalrusRouteData>(blobId);

    if (!result.success) {
      throw new Error(result.error || "Failed to retrieve route");
    }

    const routeData = result.data;

    // Verify checksum
    const calculatedChecksum = generateChecksum(routeData.route);
    if (calculatedChecksum !== routeData.checksum) {
      throw new Error("Route data corrupted (checksum mismatch)");
    }

    console.log("✓ Route retrieved from Walrus:", routeData.route.name);
    return routeData;
  } catch (error) {
    console.error("Failed to retrieve route:", error);
    return null;
  }
}

/**
 * Record route deployment
 * Track which routes have been deployed to which classes
 */
export function recordDeployment(
  routeId: string,
  deployment: Omit<RouteDeployment, "routeId">
): void {
  const key = `route-deployments`;
  const stored = localStorage.getItem(key);
  const deployments: RouteDeployment[] = stored ? JSON.parse(stored) : [];

  deployments.push({
    routeId,
    ...deployment,
  });

  localStorage.setItem(key, JSON.stringify(deployments));
  console.log("✓ Deployment recorded:", deployment.classId);
}

/**
 * Get all deployments for a route
 */
export function getRouteDeployments(routeId: string): RouteDeployment[] {
  const key = `route-deployments`;
  const stored = localStorage.getItem(key);
  if (!stored) return [];

  const deployments: RouteDeployment[] = JSON.parse(stored);
  return deployments.filter((d) => d.routeId === routeId);
}

/**
 * Get deployment by class ID
 */
export function getDeploymentByClassId(
  classId: string
): RouteDeployment | null {
  const key = `route-deployments`;
  const stored = localStorage.getItem(key);
  if (!stored) return null;

  const deployments: RouteDeployment[] = JSON.parse(stored);
  return deployments.find((d) => d.classId === classId) || null;
}

/**
 * Generate checksum for route integrity
 */
function generateChecksum(route: GeneratedRoute): string {
  const data = JSON.stringify({
    name: route.name,
    coordinates: route.coordinates,
    storyBeats: route.storyBeats,
    estimatedDistance: route.estimatedDistance,
    elevationGain: route.elevationGain,
  });

  // Simple hash (in production, use crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Cache route locally for offline access
 * Riders download route data after purchasing ticket
 */
export function cacheRouteLocally(
  classId: string,
  routeData: WalrusRouteData
): void {
  const key = `cached-route-${classId}`;
  localStorage.setItem(key, JSON.stringify(routeData));
  console.log("✓ Route cached locally for class:", classId);
}

/**
 * Get cached route
 */
export function getCachedRoute(classId: string): WalrusRouteData | null {
  const key = `cached-route-${classId}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
}

/**
 * Clear old cached routes (keep last 5)
 */
export function clearOldCaches(): void {
  const prefix = "cached-route-";
  const caches: Array<{ key: string; timestamp: number }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        caches.push({
          key,
          timestamp: new Date(parsed.deployment.deployedAt).getTime(),
        });
      }
    }
  }

  // Sort by timestamp and keep newest 5
  caches.sort((a, b) => b.timestamp - a.timestamp);
  caches.slice(5).forEach((cache) => {
    localStorage.removeItem(cache.key);
  });

  console.log(`✓ Cleared ${Math.max(0, caches.length - 5)} old route caches`);
}
