"use client";

import { useState, useRef } from "react";

export type StoryBeatType = "climb" | "sprint" | "drop" | "rest" | "scenery" | "push";

export type StoryBeat = {
  progress: number;
  label: string;
  type: StoryBeatType;
  description?: string;
  intensity: number;
};

export type GpxSummary = {
  trackPoints: number;
  minElevation: number | null;
  maxElevation: number | null;
  distanceKm: number | null;
  segments: Array<{ label: string; minutes: number; zone: string }>;
  elevationProfile: number[];
  storyBeats: StoryBeat[];
};

type TrackPoint = {
  lat: number;
  lon: number;
  ele: number | null;
  time: number | null;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineKm(a: TrackPoint, b: TrackPoint) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function detectBeats(points: TrackPoint[], distanceKm: number): StoryBeat[] {
  const beats: StoryBeat[] = [];
  if (points.length < 10) return beats;

  // Detect steep gradients (> 8%)
  for (let i = 5; i < points.length - 5; i += 20) {
    const p1 = points[i - 5];
    const p2 = points[i + 5];
    const dist = haversineKm(p1, p2);
    if (dist > 0.05 && p1.ele !== null && p2.ele !== null) {
      const rise = p2.ele - p1.ele;
      const gradient = (rise / (dist * 1000)) * 100;

      if (gradient > 8) {
        beats.push({
          progress: i / points.length,
          label: "Steep Climb",
          type: "climb",
          intensity: Math.min(10, Math.round(gradient)),
        });
      } else if (gradient < -8) {
        beats.push({
          progress: i / points.length,
          label: "Fast Descent",
          type: "drop",
          intensity: Math.min(10, Math.round(Math.abs(gradient))),
        });
      }
    }
  }

  // Filter to keep only 3-4 interesting beats
  return beats
    .filter((_, i) => i % 2 === 0)
    .slice(0, 4)
    .sort((a, b) => a.progress - b.progress);
}

function estimateSegments(totalMinutes: number) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return [
      { label: "Warm-up", minutes: 8, zone: "Zone 2" },
      { label: "Climb", minutes: 12, zone: "Zone 4" },
      { label: "Sprint", minutes: 4, zone: "Zone 5" },
    ];
  }
  const warmup = Math.max(6, Math.round(totalMinutes * 0.2));
  const climb = Math.max(8, Math.round(totalMinutes * 0.3));
  const sprint = Math.max(4, Math.round(totalMinutes * 0.1));
  const steady = Math.max(6, totalMinutes - warmup - climb - sprint);
  return [
    { label: "Warm-up", minutes: warmup, zone: "Zone 2" },
    { label: "Steady", minutes: steady, zone: "Zone 3" },
    { label: "Climb", minutes: climb, zone: "Zone 4" },
    { label: "Sprint", minutes: sprint, zone: "Zone 5" },
  ];
}

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
        elevations[lower] * (1 - weight) + elevations[upper] * weight,
      );
    }
  }

  return result;
}

type GpxUploaderProps = {
  onUpload?: (summary: GpxSummary) => void;
};

export function GpxUploader({ onUpload }: GpxUploaderProps) {
  const [status, setStatus] = useState("No GPX uploaded yet.");
  const [summary, setSummary] = useState<GpxSummary | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    setStatus("Parsing GPX...");
    setSummary(null);

    try {
      const text = await file.text();
      const parser = new DOMParser();
      const document = parser.parseFromString(text, "application/xml");
      const trackPoints = Array.from(document.getElementsByTagName("trkpt"));
      const points: TrackPoint[] = trackPoints
        .map((point) => {
          const lat = Number(point.getAttribute("lat"));
          const lon = Number(point.getAttribute("lon"));
          const eleValue = point.getElementsByTagName("ele")[0]?.textContent;
          const timeValue = point.getElementsByTagName("time")[0]?.textContent;
          return {
            lat,
            lon,
            ele: eleValue ? Number(eleValue) : null,
            time: timeValue ? Date.parse(timeValue) : null,
          };
        })
        .filter(
          (point) =>
            Number.isFinite(point.lat) &&
            Number.isFinite(point.lon) &&
            !Number.isNaN(point.lat) &&
            !Number.isNaN(point.lon),
        );

      const elevations = points
        .map((point) => point.ele)
        .filter(
          (value): value is number => value !== null && Number.isFinite(value),
        );

      const minElevation =
        elevations.length > 0 ? Math.min(...elevations) : null;
      const maxElevation =
        elevations.length > 0 ? Math.max(...elevations) : null;

      let distanceKm = 0;
      for (let i = 1; i < points.length; i += 1) {
        distanceKm += haversineKm(points[i - 1], points[i]);
      }

      const validTimes = points
        .map((point) => point.time)
        .filter(
          (value): value is number => value !== null && Number.isFinite(value),
        );
      const totalMinutes =
        validTimes.length >= 2
          ? Math.round(
            (Math.max(...validTimes) - Math.min(...validTimes)) / 60000,
          )
          : Math.round(distanceKm * 2); // Fallback estimation

      const elevationProfile = sampleElevation(elevations, 100);

      const newSummary: GpxSummary = {
        trackPoints: points.length,
        minElevation,
        maxElevation,
        distanceKm: distanceKm > 0 ? distanceKm : null,
        segments: estimateSegments(totalMinutes),
        elevationProfile,
        storyBeats: detectBeats(points, distanceKm),
      };

      setSummary(newSummary);
      setStatus("GPX parsed successfully.");

      if (onUpload) {
        onUpload(newSummary);
      }
    } catch (error) {
      setStatus("Could not parse this GPX file.");
      console.error(error);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 transition-all ${isDragging
          ? "border-indigo-500 bg-indigo-500/10"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
          }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-2xl text-white group-hover:scale-110 transition-transform">
          ↑
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-white">
            Click to upload or drag and drop
          </p>
          <p className="mt-1 text-xs text-white/50">
            GPX files only (max 10MB)
          </p>
        </div>

        {summary && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-green-500/50" />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between px-2">
        <p
          className={`text-xs ${status.includes("Could not") ? "text-red-400" : "text-white/50"}`}
        >
          {status}
        </p>
        {summary && <span className="text-xs text-green-400">Ready</span>}
      </div>

      {summary && (
        <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-white/5 p-3 border border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-white/50">
                Distance
              </p>
              <p className="text-lg font-semibold text-white">
                {summary.distanceKm !== null
                  ? summary.distanceKm.toFixed(1)
                  : "—"}{" "}
                <span className="text-xs font-normal text-white/50">km</span>
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-3 border border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-white/50">
                Elevation
              </p>
              <p className="text-lg font-semibold text-white">
                {summary.maxElevation !== null && summary.minElevation !== null
                  ? (summary.maxElevation - summary.minElevation).toFixed(0)
                  : "—"}{" "}
                <span className="text-xs font-normal text-white/50">m</span>
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-3 border border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-white/50">
                Points
              </p>
              <p className="text-lg font-semibold text-white">
                {summary.trackPoints}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Effort Segments
            </p>
            <div className="space-y-2">
              {summary.segments.map((segment, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2 w-2 rounded-full ${segment.zone === "Zone 5" ? "bg-red-500" : segment.zone === "Zone 4" ? "bg-orange-500" : "bg-blue-500"}`}
                    />
                    <span className="text-white/80">{segment.label}</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-white font-medium">
                      {segment.minutes} min
                    </span>
                    <span className="text-white/50 w-16 text-right">
                      {segment.zone}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {summary.elevationProfile.length > 0 && (
            <div className="h-24 w-full overflow-hidden rounded-lg bg-white/5 border border-white/10 p-2 flex items-end justify-between gap-px">
              {summary.elevationProfile.map((ele, i) => {
                const min = summary.minElevation || 0;
                const max = summary.maxElevation || 100;
                const range = max - min;
                const normalized = (ele - min) / (range || 1);
                return (
                  <div
                    key={i}
                    style={{ height: `${Math.max(10, normalized * 100)}%` }}
                    className="w-full bg-indigo-500/40 hover:bg-indigo-500/80 transition-colors rounded-sm"
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
