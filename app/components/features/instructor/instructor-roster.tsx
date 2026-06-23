"use client";

import { useState } from "react";
import { useInstructorRoster, useProgressDelta, type RosterEntry } from "@/app/hooks/common/use-roster";
import { useInstructorHomework } from "@/app/hooks/common/use-homework";
import { isSupabaseConfigured } from "@/app/lib/supabase/client";
import { Users, TrendingUp, TrendingDown, Minus, ClipboardList, X } from "lucide-react";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function DeltaBadge({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[color:var(--text-muted)]">
        <Minus className="h-3 w-3" /> 0{suffix}
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${positive ? "text-emerald-400" : "text-red-400"}`}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}{value}{suffix}
    </span>
  );
}

function RosterRow({ entry, onAssign }: { entry: RosterEntry; onAssign: (addr: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { delta, isLoading: deltaLoading } = useProgressDelta(entry.address);

  return (
    <div className="border-b border-[color:var(--border)] last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-[color:var(--surface)]/50"
      >
        <div className="flex-1">
          <p className="font-mono text-sm">{shortAddr(entry.address)}</p>
          <p className="text-xs text-[color:var(--text-muted)]">
            {entry.ride_count} rides · {entry.classes_attended.length} classes
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-0.5">
          <span className="text-sm font-medium">{entry.avg_effort}</span>
          <span className="text-xs text-[color:var(--text-muted)]">avg effort</span>
        </div>
        <div className="hidden md:flex flex-col items-end gap-0.5">
          <span className="text-sm font-medium">{entry.avg_power || "—"}</span>
          <span className="text-xs text-[color:var(--text-muted)]">avg W</span>
        </div>
        <div className="hidden md:flex flex-col items-end gap-0.5">
          <span className="text-sm font-medium">{entry.avg_heart_rate || "—"}</span>
          <span className="text-xs text-[color:var(--text-muted)]">avg bpm</span>
        </div>
        <span className="text-xs text-[color:var(--text-muted)]">
          {new Date(entry.last_ride_at).toLocaleDateString()}
        </span>
      </button>

      {expanded && (
        <div className="bg-[color:var(--surface)]/30 px-4 py-3">
          {deltaLoading ? (
            <p className="text-sm text-[color:var(--text-muted)]">Loading progress...</p>
          ) : delta?.deltas ? (
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[color:var(--text-muted)]">Power change</span>
                <DeltaBadge value={delta.deltas.power} suffix="W" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[color:var(--text-muted)]">Effort change</span>
                <DeltaBadge value={delta.deltas.effort} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[color:var(--text-muted)]">HR change</span>
                <DeltaBadge value={delta.deltas.heart_rate} suffix=" bpm" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[color:var(--text-muted)]">Total rides</span>
                <span className="text-sm font-medium">{delta.total_rides}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[color:var(--text-muted)]">Not enough data for progress comparison.</p>
          )}

          <button
            onClick={() => onAssign(entry.address)}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-300 transition hover:bg-blue-500/30"
          >
            <ClipboardList className="h-4 w-4" />
            Assign homework
          </button>
        </div>
      )}
    </div>
  );
}

function AssignModal({ riderAddress, onClose }: { riderAddress: string; onClose: () => void }) {
  const { assignHomework } = useInstructorHomework();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("20");
  const [dueDays, setDueDays] = useState("3");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const dueAt = dueDays ? new Date(Date.now() + Number(dueDays) * 86400000).toISOString() : null;
    await assignHomework(riderAddress, null, {
      name: name || "Practice ride",
      description,
      duration: Number(duration) || 20,
    }, dueAt);
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Assign homework to {shortAddr(riderAddress)}</h3>
          <button onClick={onClose} className="text-[color:var(--text-muted)] hover:text-[color:var(--text)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-[color:var(--text-muted)]">Workout name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Endurance intervals"
              className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[color:var(--text-muted)]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions for the rider..."
              rows={3}
              className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-[color:var(--text-muted)]">Duration (min)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-[color:var(--text-muted)]">Due in (days)</label>
              <input
                type="number"
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting ? "Assigning..." : "Assign homework"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function InstructorRoster() {
  const { roster, isLoading } = useInstructorRoster();
  const [assignTarget, setAssignTarget] = useState<string | null>(null);

  if (!isSupabaseConfigured()) return null;
  if (isLoading && roster.length === 0) {
    return (
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-8 text-center">
        <p className="text-[color:var(--text-muted)]">Loading roster...</p>
      </div>
    );
  }

  if (roster.length === 0) {
    return (
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-8 text-center">
        <Users className="mx-auto mb-3 h-8 w-8 text-[color:var(--text-muted)]" />
        <p className="text-[color:var(--text-muted)]">No riders have completed your classes yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-4 py-3">
        <Users className="h-5 w-5 text-blue-400" />
        <h2 className="text-lg font-semibold">Your riders</h2>
        <span className="ml-auto text-sm text-[color:var(--text-muted)]">{roster.length} riders</span>
      </div>

      <div className="flex items-center gap-4 border-b border-[color:var(--border)] px-4 py-2 text-xs text-[color:var(--text-muted)]">
        <span className="flex-1">Rider</span>
        <span className="hidden sm:block w-20 text-right">Effort</span>
        <span className="hidden md:block w-16 text-right">Power</span>
        <span className="hidden md:block w-16 text-right">HR</span>
        <span className="w-24 text-right">Last ride</span>
      </div>

      {roster.map((entry) => (
        <RosterRow key={entry.address} entry={entry} onAssign={setAssignTarget} />
      ))}

      {assignTarget && (
        <AssignModal riderAddress={assignTarget} onClose={() => setAssignTarget(null)} />
      )}
    </div>
  );
}
