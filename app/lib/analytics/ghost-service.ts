/**
 * GhostService - Manage asynchronous racing against previous performances
 *
 * Production Architecture:
 * - Fetches historical ride data from Sui (telemetry blobs)
 * - Falls back to mock ghost for new routes without history
 * - Supports multiple ghost types: personal best, leaderboard, instructor
 */

import type { RideRecordPoint } from "./ride-recorder";
import { SUI_CONFIG } from "@/app/config";

export interface GhostPerformance {
  id: string;
  riderName: string;
  points: RideRecordPoint[];
  totalTime: number;
  source: "personal_best" | "leaderboard" | "instructor" | "mock";
}

export interface GhostState {
  leadLagTime: number; // Seconds (positive = rider leading, negative = ghost leading)
  distanceGap: number; // Meters
  ghostPoint: RideRecordPoint | null;
}

export interface GhostFetchOptions {
  classId: string;
  riderAddress?: string;
  routeBlobId?: string;
  ghostType?: "personal_best" | "leaderboard" | "instructor";
}

/**
 * Calculates the state of the ghost relative to the current rider.
 */
export function calculateGhostState(
  ghostPoints: RideRecordPoint[],
  currentDistance: number,
  currentElapsedTime: number
): GhostState {
  if (ghostPoints.length === 0) {
    return { leadLagTime: 0, distanceGap: 0, ghostPoint: null };
  }

  // 1. Find the ghost's point at the current elapsed time
  const ghostPointAtTime = ghostPoints.find(p => 
    (p.timestamp - ghostPoints[0].timestamp) >= currentElapsedTime * 1000
  ) || ghostPoints[ghostPoints.length - 1];

  // 2. Find the ghost's point at the rider's current distance (to calculate time gap)
  const ghostPointAtDistance = ghostPoints.find(p => p.distance >= currentDistance / 1000) 
    || ghostPoints[ghostPoints.length - 1];

  const ghostTimeAtDistance = (ghostPointAtDistance.timestamp - ghostPoints[0].timestamp) / 1000;
  const leadLagTime = ghostTimeAtDistance - currentElapsedTime;
  const distanceGap = currentDistance - (ghostPointAtTime.distance * 1000);

  return {
    leadLagTime,
    distanceGap,
    ghostPoint: ghostPointAtTime,
  };
}

/**
 * Fetches real historical ghost performance from Sui telemetry data.
 * 
 * Production flow:
 * 1. Query Sui for completed sessions on this route/class
 * 2. Fetch telemetry blob from Walrus
 * 3. Parse into RideRecordPoint format
 * 
 * Falls back to mock if no historical data available.
 */
export async function fetchRealGhost(
  options: GhostFetchOptions
): Promise<GhostPerformance | null> {
  const { classId, riderAddress, routeBlobId, ghostType = "personal_best" } = options;

  try {
    // Query Sui for historical sessions on this route
    // In production, this would use the Sui SDK:
    // const sessions = await suiClient.queryTransactionBlocks({
    //   filter: { MoveFunction: { package: SUI_CONFIG.packageId, module: "spinsession", function: "complete_session" } },
    // });
    
    // For now, attempt to fetch from Walrus if blob ID is provided
    if (routeBlobId && riderAddress) {
      const walrusUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${routeBlobId}`;
      
      const response = await fetch(walrusUrl, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      if (response.ok) {
        const telemetryData = await response.json();
        
        // Validate and transform telemetry data
        if (Array.isArray(telemetryData.points) && telemetryData.points.length > 0) {
          const points: RideRecordPoint[] = telemetryData.points.map((p: Record<string, unknown>) => ({
            timestamp: p.timestamp as number,
            heartRate: p.heartRate as number ?? 150,
            power: p.power as number ?? 200,
            cadence: p.cadence as number ?? 90,
            speed: p.speed as number ?? 25,
            distance: p.distance as number ?? 0,
            latitude: p.latitude as number,
            longitude: p.longitude as number,
            altitude: p.altitude as number,
          }));

          return {
            id: `${classId}-${ghostType}`,
            riderName: ghostType === "personal_best" ? "Your Best" : "Leader",
            points,
            totalTime: telemetryData.totalTime ?? points[points.length - 1]?.distance * 1000 / 7, // fallback calc
            source: ghostType,
          };
        }
      }
    }

    // No historical data available
    return null;
  } catch (error) {
    console.warn("[GhostService] Failed to fetch real ghost data:", error);
    return null;
  }
}

/**
 * Fetches ghost performance with automatic fallback to mock.
 * 
 * Priority:
 * 1. Real historical data from Sui/Walrus
 * 2. Mock ghost based on target speed
 */
export async function fetchGhostWithFallback(
  routeCoordinates: { lat: number; lng: number; ele?: number }[],
  options: GhostFetchOptions,
  targetSpeedKmh: number = 25
): Promise<GhostPerformance> {
  // Try to fetch real data first
  const realGhost = await fetchRealGhost(options);
  
  if (realGhost) {
    return realGhost;
  }

  // Fall back to mock ghost
  return generateMockGhost(routeCoordinates, targetSpeedKmh);
}

/**
 * Generates a mock "Gold Standard" ghost for a route based on target speed.
 * Used as fallback when no historical data is available.
 */
export function generateMockGhost(
  routeCoordinates: { lat: number; lng: number; ele?: number }[],
  targetSpeedKmh: number,
  startTime: number = Date.now()
): GhostPerformance {
  const points: RideRecordPoint[] = [];
  let totalDistance = 0;
  const speedMps = targetSpeedKmh / 3.6;

  routeCoordinates.forEach((coord, i) => {
    if (i > 0) {
      // Haversine distance calculation for accuracy
      const prev = routeCoordinates[i - 1];
      const d = haversineDistance(prev.lat, prev.lng, coord.lat, coord.lng);
      totalDistance += d;
    }

    const elapsedSeconds = (totalDistance * 1000) / speedMps;
    
    points.push({
      timestamp: startTime + (elapsedSeconds * 1000),
      heartRate: 150,
      power: 200,
      cadence: 90,
      speed: targetSpeedKmh,
      distance: totalDistance,
      latitude: coord.lat,
      longitude: coord.lng,
      altitude: coord.ele,
    });
  });

  return {
    id: "gold-standard",
    riderName: "Gold Standard",
    points,
    totalTime: (totalDistance * 1000) / speedMps,
    source: "mock",
  };
}

/**
 * Calculate haversine distance between two lat/lng points (in km)
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
