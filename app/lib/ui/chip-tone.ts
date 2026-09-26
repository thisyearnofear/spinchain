/**
 * Chip tones — the one place that maps a status/phase key to the
 * {text, bg, border} classes of a small status chip.
 *
 * Previously two hand-rolled maps did this job (journey status tones and
 * the Agent Studio phase chips). Any new chip should read from here so the
 * status color language stays single-sourced.
 */

export interface ChipTone {
  text: string;
  bg: string;
  border: string;
}

export const CHIP_TONES = {
  // Journey status tones (reward / anchoring state)
  neutral: { text: "text-white/60", bg: "bg-white/5", border: "border-white/10" },
  cyan: { text: "text-cyan-200", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
  emerald: { text: "text-emerald-200", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  amber: { text: "text-amber-200", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  red: { text: "text-red-200", bg: "bg-red-500/10", border: "border-red-500/30" },
  // Workout phase tones (Agent Studio interval chips)
  warmup: { text: "text-sky-300", bg: "bg-sky-500/15", border: "border-sky-500/20" },
  endurance: { text: "text-emerald-300", bg: "bg-emerald-500/15", border: "border-emerald-500/20" },
  interval: { text: "text-amber-300", bg: "bg-amber-500/15", border: "border-amber-500/20" },
  sprint: { text: "text-rose-300", bg: "bg-rose-500/15", border: "border-rose-500/20" },
  recovery: { text: "text-indigo-300", bg: "bg-indigo-500/15", border: "border-indigo-500/20" },
  cooldown: { text: "text-slate-300", bg: "bg-slate-500/15", border: "border-slate-500/20" },
} as const satisfies Record<string, ChipTone>;

export type ChipToneKey = keyof typeof CHIP_TONES;

/**
 * Compose the class string for a chip. `withBorder` includes the `border`
 * width utility — chips that already set `border` in their base classes
 * should pass `false` and only take the color.
 */
export function chipToneClasses(
  key: string,
  fallback: ChipToneKey = "neutral",
  { withBorder = true }: { withBorder?: boolean } = {},
): string {
  const tone = CHIP_TONES[key as ChipToneKey] ?? CHIP_TONES[fallback];
  return withBorder
    ? `border ${tone.border} ${tone.bg} ${tone.text}`
    : `${tone.bg} ${tone.text} ${tone.border}`;
}
