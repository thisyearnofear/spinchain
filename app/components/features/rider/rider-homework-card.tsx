"use client";

import { useRiderHomework, type HomeworkAssignment } from "@/app/hooks/common/use-homework";
import { isSupabaseConfigured } from "@/app/lib/supabase/client";
import { ClipboardList, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";

function statusIcon(status: HomeworkAssignment["status"]) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "in_progress":
      return <Clock className="h-4 w-4 text-amber-400" />;
    case "expired":
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    default:
      return <ClipboardList className="h-4 w-4 text-blue-400" />;
  }
}

function formatDueDate(dueAt: string | null): string | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays} days`;
}

export function RiderHomeworkCard() {
  const { homework, isLoading } = useRiderHomework();

  if (!isSupabaseConfigured()) return null;
  if (isLoading && homework.length === 0) return null;
  if (homework.length === 0) return null;

  const active = homework.filter((h) => h.status === "assigned" || h.status === "in_progress");
  const completed = homework.filter((h) => h.status === "completed");

  return (
    <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-blue-400" />
        <h2 className="text-lg font-semibold">Homework from your coach</h2>
        {active.length > 0 && (
          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300">
            {active.length} active
          </span>
        )}
      </div>

      <div className="space-y-3">
        {active.map((hw) => {
          const due = formatDueDate(hw.due_at);
          const config = hw.workout_config as { name?: string; duration?: number; description?: string } | null;
          return (
            <div
              key={hw.id}
              className="flex items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
            >
              <div className="mt-0.5">{statusIcon(hw.status)}</div>
              <div className="flex-1">
                <p className="font-medium">
                  {config?.name || "Practice ride"}
                </p>
                {config?.description && (
                  <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                    {config.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs text-[color:var(--text-muted)]">
                  {config?.duration && <span>{config.duration} min</span>}
                  {due && (
                    <span className={due === "Overdue" ? "text-red-400" : ""}>{due}</span>
                  )}
                </div>
              </div>
              <Link
                href={`/rider/ride/practice?homework=${hw.id}`}
                className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-300 transition hover:bg-blue-500/30"
              >
                Start
              </Link>
            </div>
          );
        })}

        {completed.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text)]">
              Completed homework ({completed.length})
            </summary>
            <div className="mt-2 space-y-2">
              {completed.slice(0, 5).map((hw) => {
                const config = hw.workout_config as { name?: string } | null;
                return (
                  <div key={hw.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[color:var(--text-muted)]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{config?.name || "Practice ride"}</span>
                    {hw.completed_at && (
                      <span className="ml-auto text-xs">
                        {new Date(hw.completed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
