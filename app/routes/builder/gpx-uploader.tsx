"use client";

import { useState } from "react";

type GpxSummary = {
  trackPoints: number;
  minElevation: number | null;
  maxElevation: number | null;
};

export function GpxUploader() {
  const [status, setStatus] = useState("No GPX uploaded yet.");
  const [summary, setSummary] = useState<GpxSummary | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setStatus("Parsing GPX...");
    setSummary(null);

    try {
      const text = await file.text();
      const parser = new DOMParser();
      const document = parser.parseFromString(text, "application/xml");
      const trackPoints = Array.from(document.getElementsByTagName("trkpt"));
      const elevations = trackPoints
        .map((point) => point.getElementsByTagName("ele")[0]?.textContent)
        .filter((value): value is string => Boolean(value))
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

      const minElevation =
        elevations.length > 0 ? Math.min(...elevations) : null;
      const maxElevation =
        elevations.length > 0 ? Math.max(...elevations) : null;

      setSummary({
        trackPoints: trackPoints.length,
        minElevation,
        maxElevation,
      });
      setStatus("GPX parsed successfully.");
    } catch (error) {
      setStatus("Could not parse this GPX file.");
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-center text-sm text-white/70">
      <label className="flex cursor-pointer flex-col items-center gap-2">
        <span className="text-white">Drop GPX here or click to upload</span>
        <input
          type="file"
          accept=".gpx,application/gpx+xml"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>
      <p className="mt-3 text-xs text-white/60">{status}</p>
      {summary ? (
        <div className="mt-4 grid gap-2 text-xs text-white/70">
          <span>Track points: {summary.trackPoints}</span>
          <span>
            Elevation range:{" "}
            {summary.minElevation !== null ? summary.minElevation.toFixed(0) : "—"}m
            {" — "}
            {summary.maxElevation !== null ? summary.maxElevation.toFixed(0) : "—"}m
          </span>
        </div>
      ) : null}
    </div>
  );
}
