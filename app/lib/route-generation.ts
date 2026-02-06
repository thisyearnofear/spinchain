/**
 * Route Generation Utilities
 * Converts AI-generated routes to GPX-compatible format and integrates with existing visualization
 */

import type { RouteResponse } from "./ai-service";
import type { GpxSummary, StoryBeat } from "../routes/builder/gpx-uploader";

/**
 * Haversine distance calculation
 */
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Sample elevation data to a fixed number of points
 */
function sampleElevation(elevations: number[], samples: number): number[] {
  if (elevations.length === 0) return [];
  if (elevations.length <= samples) return elevations;

  const step = (elevations.length - 1) / (samples - 1);
  const result = [];

  for (let i = 0; i < samples; i++) {
    const index = i * step;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (upper >= elevations.length) {
      result.push(elevations[elevations.length - 1]);
    } else {
      result.push(
        elevations[lower] * (1 - weight) + elevations[upper] * weight
      );
    }
  }

  return result;
}

/**
 * Estimate workout segments based on duration and elevation
 */
function estimateSegments(
  totalMinutes: number,
  elevationGain: number
): Array<{ label: string; minutes: number; zone: string }> {
  const hasSignificantClimb = elevationGain > 200;

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return [
      { label: "Warm-up", minutes: 8, zone: "Zone 2" },
      { label: "Climb", minutes: 12, zone: "Zone 4" },
      { label: "Sprint", minutes: 4, zone: "Zone 5" },
    ];
  }

  const warmup = Math.max(6, Math.round(totalMinutes * 0.2));
  const cooldown = Math.max(5, Math.round(totalMinutes * 0.15));

  if (hasSignificantClimb) {
    const climb = Math.max(10, Math.round(totalMinutes * 0.4));
    const steady = Math.max(
      5,
      totalMinutes - warmup - climb - cooldown
    );
    return [
      { label: "Warm-up", minutes: warmup, zone: "Zone 2" },
      { label: "Steady", minutes: steady, zone: "Zone 3" },
      { label: "Climb", minutes: climb, zone: "Zone 4" },
      { label: "Cool-down", minutes: cooldown, zone: "Zone 2" },
    ];
  } else {
    const sprint = Math.max(4, Math.round(totalMinutes * 0.15));
    const steady = Math.max(
      5,
      totalMinutes - warmup - sprint - cooldown
    );
    return [
      { label: "Warm-up", minutes: warmup, zone: "Zone 2" },
      { label: "Steady", minutes: steady, zone: "Zone 3" },
      { label: "Sprint Intervals", minutes: sprint, zone: "Zone 5" },
      { label: "Cool-down", minutes: cooldown, zone: "Zone 2" },
    ];
  }
}

/**
 * Convert AI-generated route to GPX summary format
 */
export function convertToGpxSummary(route: RouteResponse): GpxSummary {
  const coordinates = route.coordinates;
  const elevations = coordinates
    .map((c) => c.ele)
    .filter((e): e is number => e !== undefined && Number.isFinite(e));

  const minElevation =
    elevations.length > 0 ? Math.min(...elevations) : null;
  const maxElevation =
    elevations.length > 0 ? Math.max(...elevations) : null;

  // Calculate actual distance if not provided
  let distanceKm = route.estimatedDistance;
  if (!distanceKm && coordinates.length > 1) {
    distanceKm = 0;
    for (let i = 1; i < coordinates.length; i++) {
      distanceKm += haversineKm(
        coordinates[i - 1].lat,
        coordinates[i - 1].lng,
        coordinates[i].lat,
        coordinates[i].lng
      );
    }
  }

  const elevationProfile = sampleElevation(elevations, 100);

  return {
    trackPoints: coordinates.length,
    minElevation,
    maxElevation,
    distanceKm: distanceKm || null,
    segments: estimateSegments(
      route.estimatedDuration,
      route.elevationGain
    ),
    elevationProfile,
    storyBeats: route.storyBeats,
  };
}

/**
 * Convert GPX summary to GPX XML format for export
 */
export function exportToGPX(
  route: RouteResponse,
  metadata?: { name?: string; author?: string }
): string {
  const name = metadata?.name || route.name;
  const author = metadata?.author || "SpinChain";
  const timestamp = new Date().toISOString();

  const trackPoints = route.coordinates
    .map(
      (coord) =>
        `    <trkpt lat="${coord.lat}" lon="${coord.lng}">
      ${coord.ele !== undefined ? `<ele>${coord.ele}</ele>` : ""}
    </trkpt>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${author}" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <desc>${route.description}</desc>
    <time>${timestamp}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Download GPX file to user's device
 */
export function downloadGPX(
  route: RouteResponse,
  metadata?: { name?: string; author?: string }
): void {
  const gpxContent = exportToGPX(route, metadata);
  const blob = new Blob([gpxContent], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${route.name.replace(/\s+/g, "_")}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
