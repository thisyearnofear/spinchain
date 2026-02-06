/**
 * Route Library Component
 * Beautiful, intuitive interface for browsing and managing saved routes
 */

"use client";

import { useState } from "react";
import { useRouteLibrary } from "../../../hooks/use-route-library";
import type { SavedRoute } from "../../../lib/route-library";
import type { GpxSummary } from "../../../routes/builder/gpx-uploader";
import { convertToGpxSummary } from "../../../lib/route-generation";

type RouteLibraryProps = {
  onRouteSelect?: (gpxSummary: GpxSummary) => void;
  onClose?: () => void;
};

export function RouteLibrary({ onRouteSelect, onClose }: RouteLibraryProps) {
  const {
    routes,
    isLoading,
    deleteRoute,
    toggleFavorite,
    searchRoutes,
    getStats,
    exportLibrary,
  } = useRouteLibrary();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null);

  const stats = getStats();

  const displayedRoutes = searchQuery
    ? searchRoutes(searchQuery)
    : filterFavorites
    ? routes.filter((r: SavedRoute) => r.isFavorite)
    : routes;

  const handleSelectRoute = (route: SavedRoute) => {
    if (onRouteSelect) {
      const gpxSummary = convertToGpxSummary(route);
      onRouteSelect(gpxSummary);
      if (onClose) onClose();
    } else {
      setSelectedRoute(route);
    }
  };

  const handleExport = () => {
    const json = exportLibrary();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spinchain-routes-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Route Library</h3>
            <p className="text-sm text-white/60 mt-1">
              {stats.totalRoutes} saved routes • {stats.favoriteRoutes} favorites
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/50">Total Distance</p>
            <p className="text-lg font-semibold text-white mt-1">
              {stats.totalDistance.toFixed(0)}{" "}
              <span className="text-xs font-normal text-white/50">km</span>
            </p>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/50">Total Time</p>
            <p className="text-lg font-semibold text-white mt-1">
              {Math.floor(stats.totalDuration / 60)}
              <span className="text-xs font-normal text-white/50">h </span>
              {stats.totalDuration % 60}
              <span className="text-xs font-normal text-white/50">m</span>
            </p>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/50">Most Used</p>
            <p className="text-sm font-medium text-white mt-1 truncate">
              {stats.mostUsedRoute?.name || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search routes..."
            className="w-full rounded-lg border border-white/10 bg-black/20 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={() => setFilterFavorites(!filterFavorites)}
          className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            filterFavorites
              ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50"
              : "bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          <svg className="h-4 w-4" fill={filterFavorites ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
        <button
          onClick={handleExport}
          className="rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 transition"
          title="Export library"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>

      {/* Routes Grid */}
      {displayedRoutes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-white/20 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <p className="text-white/60">
            {searchQuery ? "No routes match your search" : "No saved routes yet"}
          </p>
          <p className="text-sm text-white/40 mt-2">
            {searchQuery ? "Try a different search term" : "Generate a route to get started"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {displayedRoutes.map((route: SavedRoute) => (
            <button
              key={route.id}
              onClick={() => handleSelectRoute(route)}
              className="group relative rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 text-left transition-all hover:border-white/20 hover:from-white/10 hover:to-white/5 hover:shadow-lg hover:shadow-indigo-500/10"
            >
              {/* Favorite Badge */}
              {route.isFavorite && (
                <div className="absolute top-3 right-3">
                  <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
              )}

              <h4 className="text-base font-semibold text-white pr-8">{route.name}</h4>
              <p className="text-xs text-white/60 mt-1 line-clamp-2">{route.description}</p>

              {/* Stats */}
              <div className="flex gap-3 mt-3 text-xs">
                <span className="text-white/80">
                  {route.estimatedDistance.toFixed(1)} km
                </span>
                <span className="text-white/80">
                  {route.estimatedDuration} min
                </span>
                <span className="text-white/80">
                  +{route.elevationGain}m
                </span>
              </div>

              {/* Tags */}
              {route.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {route.tags.slice(0, 3).map((tag: string) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/50"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(route.id);
                  }}
                  className="text-white/40 hover:text-yellow-400 transition"
                >
                  <svg className="h-4 w-4" fill={route.isFavorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${route.name}"?`)) {
                      deleteRoute(route.id);
                    }
                  }}
                  className="text-white/40 hover:text-red-400 transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <div className="flex-1" />
                <span className="text-[10px] text-white/30">
                  Used {route.timesUsed}x
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
