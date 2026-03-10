/**
 * GhostService - Manage asynchronous racing against previous performances
 */

import type { RideRecordPoint } from "./ride-recorder";

export interface GhostPerformance {
  id: string;
  riderName: string;
  points: RideRecordPoint[];
  totalTime: number;
}

export interface GhostState {
  leadLagTime: number; // Seconds (positive = rider leading, negative = ghost leading)
  distanceGap: number; // Meters
  ghostPoint: RideRecordPoint | null;
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
 * Mocks a "Gold Standard" ghost for a route based on target speed.
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
      // Very rough distance estimation between lat/lng for mock
      const d = 0.05; // 50m intervals roughly
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
  };
}
