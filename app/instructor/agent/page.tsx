"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryNav } from "@/app/components/layout/nav";
import { SurfaceCard, Tag } from "@/app/components/ui/ui";
import {
  CLASS_GOALS,
  COACH_PERSONALITIES,
  GOAL_LABELS,
  composeClass,
  validateComposedClass,
  type ClassGoal,
  type CoachPersonality,
} from "@/app/lib/agent/class-composer";
import { saveAgentClass } from "@/app/lib/agent/agent-class-store";
import { saveClassRemote } from "@/app/lib/classes/class-store";
import { getTheme, getThemeNames } from "@/app/lib/themes/registry";
import { saveInstructorClassDraftFormData } from "@/app/hooks/instructor/use-class-draft";
import { chipToneClasses } from "@/app/lib/ui/chip-tone";

const DURATION_OPTIONS = [20, 30, 45, 60];

const PERSONALITY_LABELS: Record<CoachPersonality, string> = {
  zen: "Calm",
  "drill-sergeant": "High energy",
  data: "Analytical",
};

// Interval-phase chip classes come from the shared chip-tone map
// (app/lib/ui/chip-tone.ts). The base chip markup already sets `border`,
// so only the tone colors are composed here.
const phaseChipClasses = (phase: string) =>
  chipToneClasses(phase, "endurance", { withBorder: false });

function OptionButton({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-all ${
        selected
          ? "border-amber-400/60 bg-amber-400/10 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-strong)]/40 hover:border-[color:var(--accent)]/40"
      }`}
    >
      <div className="text-sm font-semibold text-[color:var(--foreground)]">{title}</div>
      {subtitle ? <div className="mt-0.5 text-xs text-[color:var(--muted)]">{subtitle}</div> : null}
    </button>
  );
}

export default function CoachBuiltClassPage() {
  const router = useRouter();
  const [goal, setGoal] = useState<ClassGoal>("endurance");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [personality, setPersonality] = useState<CoachPersonality>("zen");
  const [themeName, setThemeName] = useState<string | null>(null);
  const [coachName, setCoachName] = useState("");

  const composed = useMemo(
    () =>
      composeClass({
        goal,
        durationMinutes,
        personality,
        themeName: themeName ?? undefined,
        coachName: coachName || undefined,
      }),
    [goal, durationMinutes, personality, themeName, coachName],
  );
  const problems = useMemo(() => validateComposedClass(composed), [composed]);
  const theme = getTheme(composed.themeName);

  const rideItNow = () => {
    const classId = `agent-${Date.now()}`;
    saveAgentClass({
      version: 1,
      classId,
      createdAt: Date.now(),
      name: composed.name,
      goal: composed.goal,
      personality: composed.personality,
      coachName: composed.coachName,
      themeName: composed.themeName,
      plan: composed.plan,
    });
    // Durable copy (Supabase classes table) so the class survives browsers
    // and devices. Best-effort: localStorage above remains the instant path.
    void saveClassRemote({
      id: classId,
      source: "agentic",
      author: "guest",
      name: composed.name,
      description: composed.description,
      goal: composed.goal,
      personality: composed.personality,
      coachName: composed.coachName,
      themeName: composed.themeName,
      durationMinutes,
      plan: composed.plan,
      route: {
        name: composed.route.name,
        distance: composed.route.distance,
        duration: composed.route.duration,
        elevationGain: composed.route.elevationGain,
      },
    });
    const params = new URLSearchParams({
      mode: "practice",
      name: composed.name,
      date: new Date().toISOString(),
      instructor: composed.coachName,
      capacity: "20",
      basePrice: "0",
      maxPrice: "0",
      curveType: "linear",
      rewardThreshold: "150",
      rewardAmount: "10",
      aiEnabled: "true",
      aiPersonality: composed.personality,
      routeName: composed.route.name,
      routeDistance: String(composed.route.distance),
      routeDuration: String(composed.route.duration),
      routeElevation: String(composed.route.elevationGain),
      theme: composed.themeName,
    });
    router.push(`/rider/ride/${classId}?${params.toString()}`);
  };

  const openInBuilder = () => {
    saveInstructorClassDraftFormData({
      name: composed.name,
      description: composed.description,
      duration: durationMinutes,
      maxRiders: 20,
      basePrice: "0.01",
      mode: "agentic",
      personality: composed.personality,
      enableDynamicPricing: false,
      useAI: true,
    });
    router.push("/instructor/builder");
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)] relative">
      <PrimaryNav />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-24">
        <header className="mb-8">
          <Tag color="amber">Coach-built class</Tag>
          <h1 className="mt-3 text-3xl font-bold text-[color:var(--foreground)]">
            Pick a goal. Your coach builds the class.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted)]">
            Route, intervals, power targets, and cues — composed in your
            coach&apos;s voice and ready to ride in under a minute.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          {/* Intent pickers */}
          <div className="space-y-6">
            <SurfaceCard eyebrow="Step 1" title="What's the goal?">
              <div className="grid grid-cols-2 gap-2">
                {CLASS_GOALS.map((g) => (
                  <OptionButton
                    key={g}
                    selected={goal === g}
                    onClick={() => setGoal(g)}
                    title={GOAL_LABELS[g]}
                  />
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard eyebrow="Step 2" title="How long?">
              <div className="grid grid-cols-4 gap-2">
                {DURATION_OPTIONS.map((minutes) => (
                  <OptionButton
                    key={minutes}
                    selected={durationMinutes === minutes}
                    onClick={() => setDurationMinutes(minutes)}
                    title={`${minutes} min`}
                  />
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard eyebrow="Step 3" title="Who's coaching?">
              <div className="grid grid-cols-3 gap-2">
                {COACH_PERSONALITIES.map((p) => (
                  <OptionButton
                    key={p}
                    selected={personality === p}
                    onClick={() => setPersonality(p)}
                    title={PERSONALITY_LABELS[p]}
                  />
                ))}
              </div>
              <input
                type="text"
                value={coachName}
                onChange={(event) => setCoachName(event.target.value)}
                placeholder={`Coach name (default: ${composed.coachName})`}
                className="mt-3 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)]/40 px-4 py-2.5 text-sm text-[color:var(--foreground)] placeholder-[color:var(--muted)] outline-none focus:border-amber-400/50"
              />
            </SurfaceCard>

            <SurfaceCard eyebrow="Step 4" title="Which world?">
              <div className="grid grid-cols-3 gap-2">
                {getThemeNames().map((name) => (
                  <OptionButton
                    key={name}
                    selected={composed.themeName === name}
                    onClick={() => setThemeName(name)}
                    title={getTheme(name).worldLabel}
                    subtitle={name}
                  />
                ))}
              </div>
            </SurfaceCard>
          </div>

          {/* Preview */}
          <SurfaceCard
            eyebrow="Your class"
            title={composed.name}
            description={composed.description}
            className="h-fit"
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <Tag color="indigo">{composed.coachName}</Tag>
              <Tag color="green">{theme.worldLabel}</Tag>
              <Tag color="blue">{durationMinutes} min</Tag>
              <Tag color="amber">{composed.plan.difficulty}</Tag>
            </div>

            <ul className="space-y-2">
              {composed.plan.intervals.map((interval, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)]/40 px-3 py-2"
                >
                  <span
                    className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${phaseChipClasses(interval.phase)}`}
                  >
                    {interval.phase}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-[color:var(--muted)]">
                      {Math.round(interval.durationSeconds / 60)} min
                      {interval.targetPower
                        ? ` · ${interval.targetPower[0]}–${interval.targetPower[1]} W`
                        : ""}
                    </div>
                    <div className="truncate text-sm text-[color:var(--foreground)]">
                      {interval.coachCue}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {problems.length > 0 && (
              <p className="mt-3 text-xs text-rose-400">
                {problems.join(" · ")}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={rideItNow}
                disabled={problems.length > 0}
                className="flex-1 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-amber-300 disabled:opacity-40"
              >
                Ride it now
              </button>
              <button
                type="button"
                onClick={openInBuilder}
                className="flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)]/40 px-5 py-3 text-sm font-semibold text-[color:var(--foreground)] transition-colors hover:border-[color:var(--accent)]/40"
              >
                Open in class builder
              </button>
            </div>
            <p className="mt-3 text-xs text-[color:var(--muted)]">
              Ride it now starts a practice ride instantly. The class builder
              takes you through scheduling and publishing.
            </p>
          </SurfaceCard>
        </div>
      </main>
    </div>
  );
}
