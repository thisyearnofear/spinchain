"use client";

import { useState, useEffect, useMemo } from "react";
import { fetchGhostWithFallback, type GhostPerformance } from "@/app/lib/analytics/ghost-service";

export interface MultiGhostState {
  id: string;
  name: string;
  leadLagTime: number;
  distanceGap: number;
  active: boolean;
  power: number;
}

/**
 * useMultiGhost - Fetches and manages multiple ghosts for a class
 * 
 * Provides a "multiplayer" experience by racing against:
 * 1. Personal Best (if available)
 * 2. Gold Standard (mock)
 * 3. Recent Leaderboard entries (from ghosts)
 */
export function useMultiGhost(
  classId: string,
  routeCoordinates: { lat: number; lng: number; ele?: number }[],
  currentDistance: number,
  currentElapsedTime: number,
  isRiding: boolean
) {
  const [ghosts, setGhosts] = useState<GhostPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isRiding || routeCoordinates.length === 0) return;

    const loadGhosts = async () => {
      setIsLoading(true);
      try {
        // Fetch 3 types of ghosts for a "crowded" leaderboard
        const ghostPromises = [
          // 1. Personal Best / Top Performer
          fetchGhostWithFallback(routeCoordinates, { classId, ghostType: "personal_best" }, 30),
          // 2. Average Rider
          fetchGhostWithFallback(routeCoordinates, { classId, ghostType: "leaderboard" }, 25),
          // 3. Steady Pacer
          fetchGhostWithFallback(routeCoordinates, { classId, ghostType: "instructor" }, 22),
        ];

        const results = await Promise.all(ghostPromises);
        setGhosts(results);
      } catch (err) {
        console.error("Failed to load multi-ghosts:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadGhosts();
  }, [classId, isRiding, routeCoordinates.length]);

  const multiGhostState = useMemo(() => {
    return ghosts.map((ghost) => {
      // Find the ghost's point at current time to get lead/lag and power
      const ghostPoint = ghost.points.find(p => 
        (p.timestamp - ghost.points[0].timestamp) >= currentElapsedTime * 1000
      ) || ghost.points[ghost.points.length - 1];

      const ghostTimeAtDistance = ghost.points.find(p => p.distance >= currentDistance / 1000) 
        ? (ghost.points.find(p => p.distance >= currentDistance / 1000)!.timestamp - ghost.points[0].timestamp) / 1000
        : currentElapsedTime;

      return {
        id: ghost.id,
        name: ghost.riderName,
        leadLagTime: ghostTimeAtDistance - currentElapsedTime,
        distanceGap: currentDistance - (ghostPoint.distance * 1000),
        active: true,
        power: ghostPoint.power,
      };
    });
  }, [ghosts, currentDistance, currentElapsedTime]);

  return {
    multiGhostState,
    isLoading
  };
}
