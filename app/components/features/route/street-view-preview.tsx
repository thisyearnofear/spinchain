"use client";

/**
 * StreetViewPreview - Real-world route preview using Google Maps Static API
 *
 * Core Principles:
 * - PERFORMANT: Static image only — zero JS bundle cost, no SDK loaded
 * - MODULAR: Drop-in component, accepts lat/lng or GPX start point
 * - CLEAN: No side effects, pure props → img URL mapping
 *
 * Setup: Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in environment.
 * Without a key the component renders a graceful placeholder.
 */

interface StreetViewPreviewProps {
  lat: number;
  lng: number;
  heading?: number;   // 0-360, compass direction the camera faces
  pitch?: number;     // -90 to 90, camera tilt
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
}

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function buildStreetViewUrl({
  lat,
  lng,
  heading = 0,
  pitch = 0,
  width = 640,
  height = 320,
}: Omit<StreetViewPreviewProps, 'className' | 'alt'>): string {
  const params = new URLSearchParams({
    size: `${width}x${height}`,
    location: `${lat},${lng}`,
    heading: String(heading),
    pitch: String(pitch),
    key: MAPS_API_KEY,
    source: 'outdoor',
  });
  return `https://maps.googleapis.com/maps/api/streetview?${params}`;
}

export function StreetViewPreview({
  lat,
  lng,
  heading = 0,
  pitch = 0,
  width = 640,
  height = 320,
  className = '',
  alt = 'Street view of route start',
}: StreetViewPreviewProps) {
  if (!MAPS_API_KEY) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/30 text-xs ${className}`}
        style={{ width, height }}
        aria-label="Street view unavailable"
      >
        🗺 Street view — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      </div>
    );
  }

  const src = buildStreetViewUrl({ lat, lng, heading, pitch, width, height });

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={`rounded-xl object-cover ${className}`}
    />
  );
}
