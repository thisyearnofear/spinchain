"use client";

import { useState, useEffect, useRef } from "react";
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

  // Use refs for rapidly-changing distance/elapsedTime to prevent the useMemo
  // from recalculating on every telemetry update (which would create a new array
  // reference and cascade into child component re-renders, React #185).
  const currentDistanceRef = useRef(currentDistance);
  currentDistanceRef.current = currentDistance;
  const currentElapsedTimeRef = useRef(currentElapsedTime);
  currentElapsedTimeRef.current = currentElapsedTime;

  // Update ghost state at low frequency via interval instead of useMemo
  const [multiGhostState, setMultiGhostState] = useState<MultiGhostState[]>([]);
  useEffect(() => {
    if (!isRiding || ghosts.length === 0) {
      if (ghosts.length > 0 && !isRiding) setMultiGhostState([]);
      return;
    }
    const id = setInterval(() => {
      const dist = currentDistanceRef.current;
      const elapsed = currentElapsedTimeRef.current;
      setMultiGhostState(
        ghosts.map((ghost) => {
          const ghostPoint = ghost.points.find(p =>
            (p.timestamp - ghost.points[0].timestamp) >= elapsed * 1000
          ) || ghost.points[ghost.points.length - 1];

          const ghostTimeAtDistance = ghost.points.find(p => p.distance >= dist / 1000)
            ? (ghost.points.find(p => p.distance >= dist / 1000)!.timestamp - ghost.points[0].timestamp) / 1000
            : elapsed;

          return {
            id: ghost.id,
            name: ghost.riderName,
            leadLagTime: ghostTimeAtDistance - elapsed,
            distanceGap: dist - (ghostPoint.distance * 1000),
            active: true,
            power: ghostPoint.power,
          };
        }),
      );
    }, 1000); // Update at 1Hz — smooth enough for ghost comparison
    return () => clearInterval(id);
  }, [ghosts, isRiding]);

  return {
    multiGhostState,
    isLoading
  };
}
