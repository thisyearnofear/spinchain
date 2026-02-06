/**
 * Route Library
 * Local storage management for saved AI-generated routes
 */

import type { RouteResponse } from "./ai-service";

export type SavedRoute = RouteResponse & {
  id: string;
  savedAt: string;
  author: string;
  tags: string[];
  isFavorite: boolean;
  timesUsed: number;
};

const STORAGE_KEY = "spinchain-route-library";
const MAX_SAVED_ROUTES = 50;

/**
 * Get all saved routes from local storage
 */
export function getSavedRoutes(): SavedRoute[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const routes = JSON.parse(stored) as SavedRoute[];
    return routes.sort((a, b) => 
      new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
  } catch (error) {
    console.error("Failed to load saved routes:", error);
    return [];
  }
}

/**
 * Save a new route to library
 */
export function saveRoute(
  route: RouteResponse,
  metadata: { author?: string; tags?: string[] } = {}
): SavedRoute {
  const routes = getSavedRoutes();

  // Check if we're at capacity
  if (routes.length >= MAX_SAVED_ROUTES) {
    // Remove oldest non-favorite route
    const nonFavorites = routes.filter((r) => !r.isFavorite);
    if (nonFavorites.length > 0) {
      deleteRoute(nonFavorites[nonFavorites.length - 1].id);
    } else {
      throw new Error(
        `Route library is full (${MAX_SAVED_ROUTES} routes). Remove some routes to save new ones.`
      );
    }
  }

  const savedRoute: SavedRoute = {
    ...route,
    id: generateRouteId(),
    savedAt: new Date().toISOString(),
    author: metadata.author || "Anonymous",
    tags: metadata.tags || [],
    isFavorite: false,
    timesUsed: 0,
  };

  const updated = [savedRoute, ...routes];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  return savedRoute;
}

/**
 * Update an existing route
 */
export function updateRoute(
  id: string,
  updates: Partial<Omit<SavedRoute, "id" | "savedAt">>
): SavedRoute | null {
  const routes = getSavedRoutes();
  const index = routes.findIndex((r) => r.id === id);

  if (index === -1) return null;

  const updated = { ...routes[index], ...updates };
  routes[index] = updated;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  return updated;
}

/**
 * Delete a route from library
 */
export function deleteRoute(id: string): boolean {
  const routes = getSavedRoutes();
  const filtered = routes.filter((r) => r.id !== id);

  if (filtered.length === routes.length) return false;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * Toggle favorite status
 */
export function toggleFavorite(id: string): boolean {
  const routes = getSavedRoutes();
  const route = routes.find((r) => r.id === id);

  if (!route) return false;

  route.isFavorite = !route.isFavorite;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));

  return route.isFavorite;
}

/**
 * Increment usage count
 */
export function incrementUsage(id: string): void {
  const routes = getSavedRoutes();
  const route = routes.find((r) => r.id === id);

  if (route) {
    route.timesUsed += 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
  }
}

/**
 * Search routes by name, description, or tags
 */
export function searchRoutes(query: string): SavedRoute[] {
  const routes = getSavedRoutes();
  const lowerQuery = query.toLowerCase();

  return routes.filter(
    (route) =>
      route.name.toLowerCase().includes(lowerQuery) ||
      route.description.toLowerCase().includes(lowerQuery) ||
      route.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Filter routes by criteria
 */
export function filterRoutes(filters: {
  favorites?: boolean;
  minDistance?: number;
  maxDistance?: number;
  minDuration?: number;
  maxDuration?: number;
  tags?: string[];
}): SavedRoute[] {
  let routes = getSavedRoutes();

  if (filters.favorites) {
    routes = routes.filter((r) => r.isFavorite);
  }

  if (filters.minDistance !== undefined) {
    routes = routes.filter((r) => r.estimatedDistance >= filters.minDistance!);
  }

  if (filters.maxDistance !== undefined) {
    routes = routes.filter((r) => r.estimatedDistance <= filters.maxDistance!);
  }

  if (filters.minDuration !== undefined) {
    routes = routes.filter((r) => r.estimatedDuration >= filters.minDuration!);
  }

  if (filters.maxDuration !== undefined) {
    routes = routes.filter((r) => r.estimatedDuration <= filters.maxDuration!);
  }

  if (filters.tags && filters.tags.length > 0) {
    routes = routes.filter((r) =>
      filters.tags!.some((tag) => r.tags.includes(tag))
    );
  }

  return routes;
}

/**
 * Get popular tags from all saved routes
 */
export function getPopularTags(limit: number = 10): Array<{ tag: string; count: number }> {
  const routes = getSavedRoutes();
  const tagCounts = new Map<string, number>();

  routes.forEach((route) => {
    route.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Export library as JSON
 */
export function exportLibrary(): string {
  const routes = getSavedRoutes();
  return JSON.stringify(routes, null, 2);
}

/**
 * Import library from JSON
 */
export function importLibrary(json: string, merge: boolean = false): number {
  try {
    const imported = JSON.parse(json) as SavedRoute[];
    
    if (!Array.isArray(imported)) {
      throw new Error("Invalid library format");
    }

    let routes = merge ? getSavedRoutes() : [];
    
    // Add imported routes (skip duplicates by name)
    const existingNames = new Set(routes.map((r) => r.name));
    const newRoutes = imported.filter((r) => !existingNames.has(r.name));
    
    routes = [...routes, ...newRoutes];
    
    // Enforce max limit
    if (routes.length > MAX_SAVED_ROUTES) {
      routes = routes.slice(0, MAX_SAVED_ROUTES);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
    return newRoutes.length;
  } catch (error) {
    console.error("Failed to import library:", error);
    throw new Error("Failed to import library. Please check the file format.");
  }
}

/**
 * Clear all saved routes
 */
export function clearLibrary(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Generate unique route ID
 */
function generateRouteId(): string {
  return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get library statistics
 */
export function getLibraryStats() {
  const routes = getSavedRoutes();
  
  return {
    totalRoutes: routes.length,
    favoriteRoutes: routes.filter((r) => r.isFavorite).length,
    totalDistance: routes.reduce((sum, r) => sum + r.estimatedDistance, 0),
    totalDuration: routes.reduce((sum, r) => sum + r.estimatedDuration, 0),
    mostUsedRoute: routes.sort((a, b) => b.timesUsed - a.timesUsed)[0] || null,
    recentRoutes: routes.slice(0, 5),
  };
}
