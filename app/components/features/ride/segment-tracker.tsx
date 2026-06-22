"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * SegmentTracker — Tracks and displays time per route segment.
 *
 * Uses storyBeats (progress 0-1, label, type) and rideProgress (0-1)
 * to show which segment the rider is in and segment times.
 */

interface StoryBeat {
  progress: number;
  label: string;
  type: string;
  intensity: number;
}

export interface SegmentTime {
  label: string;
  type: string;
  intensity: number;
  enteredAt: number | null;
  exitedAt: number | null;
  durationSec: number | null;
  isCurrent: boolean;
  isCompleted: boolean;
}

export function SegmentTracker({
  storyBeats,
  rideProgress,
  elapsedTime,
  isActive,
}: {
  storyBeats: StoryBeat[];
  rideProgress: number;
  elapsedTime: number;
  isActive: boolean;
}) {
  const segments = useMemo(() => {
    if (storyBeats.length === 0) return [];

    const sorted = [...storyBeats].sort((a, b) => a.progress - b.progress);
    const result: SegmentTime[] = sorted.map((beat, i) => {
      const nextProgress = i < sorted.length - 1 ? sorted[i + 1].progress : 1.0;
      const isCompleted = rideProgress >= nextProgress;
      const isCurrent = rideProgress >= beat.progress && !isCompleted;

      return {
        label: beat.label,
        type: beat.type,
        intensity: beat.intensity,
        enteredAt: null,
        exitedAt: null,
        durationSec: null,
        isCurrent,
        isCompleted,
      };
    });

    return result;
  }, [storyBeats, rideProgress]);

  // Track elapsed time at segment boundaries
  const segmentTimesRef = useRef<Map<number, { entered: number; exited: number | null }>>(new Map());
  const [segmentTimes, setSegmentTimes] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    if (!isActive || storyBeats.length === 0) return;

    const sorted = [...storyBeats].sort((a, b) => a.progress - b.progress);
    const newTimes = new Map<number, number>();

    sorted.forEach((beat, i) => {
      const nextProgress = i < sorted.length - 1 ? sorted[i + 1].progress : 1.0;
      const ref = segmentTimesRef.current.get(i);

      if (rideProgress >= beat.progress) {
        if (!ref) {
          // Just entered this segment
          segmentTimesRef.current.set(i, { entered: elapsedTime, exited: null });
        }

        if (rideProgress >= nextProgress) {
          // Completed this segment
          const existing = segmentTimesRef.current.get(i);
          if (existing && existing.exited === null) {
            segmentTimesRef.current.set(i, { entered: existing.entered, exited: elapsedTime });
          }
          const final = segmentTimesRef.current.get(i);
          if (final && final.exited !== null) {
            newTimes.set(i, final.exited - final.entered);
          }
        }
      }
    });

    setSegmentTimes(newTimes);
  }, [rideProgress, elapsedTime, isActive, storyBeats]);

  // Reset on ride end
  useEffect(() => {
    if (!isActive) {
      segmentTimesRef.current.clear();
      setSegmentTimes(new Map());
    }
  }, [isActive]);

  if (segments.length === 0) return null;

  const completedCount = segments.filter((s) => s.isCompleted).length;
  const currentSegment = segments.find((s) => s.isCurrent);

  const typeIcon = (type: string) => {
    switch (type) {
      case "climb": return "⛰️";
      case "sprint": return "⚡";
      case "drop": return "💥";
      case "rest": return "🌊";
      case "scenery": return "🏔️";
      case "push": return "🔥";
      default: return "📍";
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case "climb": return "text-orange-400";
      case "sprint": return "text-rose-400";
      case "drop": return "text-purple-400";
      case "rest": return "text-sky-400";
      case "scenery": return "text-emerald-400";
      case "push": return "text-amber-400";
      default: return "text-white/60";
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
          Segments
        </span>
        <span className="text-[10px] font-bold text-white/30">
          {completedCount}/{segments.length} done
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 mb-3">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              seg.isCompleted
                ? "bg-emerald-500/60"
                : seg.isCurrent
                  ? "bg-indigo-500/80 animate-pulse"
                  : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* Current segment highlight */}
      <AnimatePresence mode="wait">
        {currentSegment && (
          <motion.div
            key={currentSegment.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 mb-2"
          >
            <span className="text-base">{typeIcon(currentSegment.type)}</span>
            <span className={`text-sm font-bold ${typeColor(currentSegment.type)}`}>
              {currentSegment.label}
            </span>
            <span className="text-[10px] text-white/30 ml-auto">
              Intensity {currentSegment.intensity}/10
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Segment list */}
      <div className="space-y-1">
        {segments.map((seg, i) => {
          const time = segmentTimes.get(i);
          return (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs transition-opacity ${
                seg.isCompleted ? "opacity-60" : seg.isCurrent ? "opacity-100" : "opacity-30"
              }`}
            >
              <span className="text-xs">{typeIcon(seg.type)}</span>
              <span className={`flex-1 truncate ${seg.isCurrent ? typeColor(seg.type) : "text-white/60"}`}>
                {seg.label}
              </span>
              {seg.isCompleted && time && (
                <span className="text-[10px] font-mono text-white/40">
                  {formatSegmentTime(time)}
                </span>
              )}
              {seg.isCompleted && (
                <span className="text-emerald-400 text-[10px]">✓</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatSegmentTime(sec: number): string {
  if (sec < 60) return `${sec.toFixed(0)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
