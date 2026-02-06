/**
 * Route Library Hook
 * React hook for managing saved routes
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { RouteResponse } from "../lib/ai-service";
import type { SavedRoute } from "../lib/route-library";
import * as RouteLibrary from "../lib/route-library";

export function useRouteLibrary() {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load routes on mount
  useEffect(() => {
    // Use a microtask to defer the state update
    Promise.resolve().then(() => {
      setRoutes(RouteLibrary.getSavedRoutes());
      setIsLoading(false);
    });
  }, []);

  /**
   * Save a new route
   */
  const saveRoute = useCallback(
    (route: RouteResponse, metadata?: { author?: string; tags?: string[] }) => {
      try {
        const saved = RouteLibrary.saveRoute(route, metadata);
        setRoutes((prev) => [saved, ...prev]);
        return saved;
      } catch (error) {
        console.error("Failed to save route:", error);
        throw error;
      }
    },
    []
  );

  /**
   * Delete a route
   */
  const deleteRoute = useCallback((id: string) => {
    const success = RouteLibrary.deleteRoute(id);
    if (success) {
      setRoutes((prev) => prev.filter((r) => r.id !== id));
    }
    return success;
  }, []);

  /**
   * Toggle favorite status
   */
  const toggleFavorite = useCallback((id: string) => {
    const newStatus = RouteLibrary.toggleFavorite(id);
    setRoutes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isFavorite: newStatus } : r))
    );
    return newStatus;
  }, []);

  /**
   * Update route metadata
   */
  const updateRoute = useCallback(
    (id: string, updates: Partial<Omit<SavedRoute, "id" | "savedAt">>) => {
      const updated = RouteLibrary.updateRoute(id, updates);
      if (updated) {
        setRoutes((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
      return updated;
    },
    []
  );

  /**
   * Search routes
   */
  const searchRoutes = useCallback((query: string) => {
    return RouteLibrary.searchRoutes(query);
  }, []);

  /**
   * Filter routes
   */
  const filterRoutes = useCallback((filters: Parameters<typeof RouteLibrary.filterRoutes>[0]) => {
    return RouteLibrary.filterRoutes(filters);
  }, []);

  /**
   * Get popular tags
   */
  const getPopularTags = useCallback(() => {
    return RouteLibrary.getPopularTags();
  }, []);

  /**
   * Export library
   */
  const exportLibrary = useCallback(() => {
    return RouteLibrary.exportLibrary();
  }, []);

  /**
   * Import library
   */
  const importLibrary = useCallback((json: string, merge: boolean = false) => {
    const count = RouteLibrary.importLibrary(json, merge);
    setRoutes(RouteLibrary.getSavedRoutes());
    return count;
  }, []);

  /**
   * Clear library
   */
  const clearLibrary = useCallback(() => {
    RouteLibrary.clearLibrary();
    setRoutes([]);
  }, []);

  /**
   * Get library stats
   */
  const getStats = useCallback(() => {
    return RouteLibrary.getLibraryStats();
  }, []);

  return {
    routes,
    isLoading,
    saveRoute,
    deleteRoute,
    toggleFavorite,
    updateRoute,
    searchRoutes,
    filterRoutes,
    getPopularTags,
    exportLibrary,
    importLibrary,
    clearLibrary,
    getStats,
  };
}
