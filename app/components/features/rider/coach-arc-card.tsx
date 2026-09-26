"use client";

/**
 * CoachArcCard — the between-ride act of the character loop on the
 * journey page. The coach acknowledges the rider's arc from real signals
 * (composeCoachArc): PRs and recovery alike, never a readiness score.
 */

import dynamic from "next/dynamic";
import type { CoachArc } from "@/app/lib/journey/coach-arc";
import type { CharacterState } from "@/app/lib/character-state";
import type { CoachEmotion } from "../ride/rive-coach-orb";

const RiveCoachOrb = dynamic(
  () => import("../ride/rive-coach-orb").then((mod) => mod.RiveCoachOrb),
  { ssr: false },
);

const STATE_TO_EMOTION: Record<CharacterState, CoachEmotion> = {
  idle: "calm",
  ready: "focused",
  riding: "focused",
  flow: "intense",
  recovery: "calm",
  celebrate: "celebratory",
  fatigued: "calm",
};

const STATE_CHIP_CLASSES: Record<CharacterState, string> = {
  idle: "border-sky-400/30 bg-sky-500/10 text-sky-300",
  ready: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  riding: "border-indigo-400/30 bg-indigo-500/10 text-indigo-300",
  flow: "border-indigo-400/30 bg-indigo-500/10 text-indigo-300",
  recovery: "border-sky-400/30 bg-sky-500/10 text-sky-300",
  celebrate: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  fatigued: "border-rose-400/30 bg-rose-500/10 text-rose-300",
};

export function CoachArcCard({ arc }: { arc: CoachArc }) {
  return (
    <section
      aria-label="A note from your coach"
      className="rounded-[2rem] border border-white/10 bg-[color:var(--surface)]/70 p-6 backdrop-blur"
    >
      <div className="flex items-start gap-5">
        <RiveCoachOrb
          emotion={STATE_TO_EMOTION[arc.state]}
          size={72}
          fallback={
            <div className="flex h-full w-full items-center justify-center rounded-full bg-indigo-500/20 text-lg font-black text-indigo-200">
              {arc.coachName.replace(/^Coach\s+/, "").slice(0, 1) || "C"}
            </div>
          }
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">
              {arc.coachName}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATE_CHIP_CLASSES[arc.state]}`}
            >
              {arc.stateLabel}
            </span>
            {arc.streakLine && (
              <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-orange-300">
                {arc.streakLine}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-lg font-bold text-white">{arc.headline}</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/70">{arc.message}</p>
        </div>
      </div>
    </section>
  );
}

export default CoachArcCard;
