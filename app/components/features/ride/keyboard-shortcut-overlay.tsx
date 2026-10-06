"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Z_LAYERS } from "@/app/lib/ui/z-layers";
import { INTENSITY_RAMP } from "@/app/lib/phase-theme";
import { useSensoryStore } from "@/app/stores/sensory-store";

/** Strokes after which the ride-start panel tucks away: the rider has found the keys. */
const AUTO_TUCK_STROKES = 12;

interface KeyboardShortcutOverlayProps {
  /** Whether to show the overlay */
  show: boolean;
  /** Called when overlay dismisses */
  onDismiss?: () => void;
}

/**
 * KeyboardShortcutOverlay - Shows the keyboard controls while a simulator
 * ride is running.
 *
 * It stays up until the rider closes it (button or Esc) or, the first time it
 * opens, until they've pedaled AUTO_TUCK_STROKES strokes — proof they've found
 * the keys, so it stops covering the world. A panel re-opened via "Keys" stays
 * until closed.
 */
function KeyboardShortcutOverlayInternal({ show, onDismiss }: KeyboardShortcutOverlayProps) {
  const [visible, setVisible] = useState(false);

  const hasAutoTucked = useRef(false);
  // Parents pass an inline onDismiss; reading it through a ref keeps the
  // stroke subscription (and its starting count) alive across re-renders.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    setVisible(show);
  }, [show]);

  useEffect(() => {
    if (!visible || hasAutoTucked.current) return;
    const startSeq = useSensoryStore.getState().strokeSeq;
    return useSensoryStore.subscribe((state) => {
      if (hasAutoTucked.current || state.strokeSeq - startSeq < AUTO_TUCK_STROKES) return;
      hasAutoTucked.current = true;
      onDismissRef.current?.();
    });
  }, [visible]);

  // Esc closes the overlay (controls stay discoverable via the Keys button)
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onDismiss]);

  if (!visible) return null;

  const sections: { title: string; keys: { key: string; label: string }[] }[] = [
    {
      title: "Pedal",
      keys: [
        { key: "← → / A D", label: "Left / right leg" },
        { key: "↑ / ↓ / W S", label: "Pedal (auto-alternate)" },
      ],
    },
    {
      title: "View",
      keys: [
        { key: "H", label: "Hide / show HUD" },
        { key: "C", label: "Collapse / expand panels" },
        { key: "V", label: "Toggle 2D / 3D view" },
      ],
    },
  ];

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 sm:left-6 sm:translate-x-0 pointer-events-auto"
      style={{ zIndex: Z_LAYERS.tooltips }}
    >
      <div className="relative rounded-2xl border border-white/15 bg-black/85 backdrop-blur-xl px-5 py-4 shadow-2xl w-[264px]">
        {/* Dismiss */}
        <button
          onClick={onDismiss}
          aria-label="Close keyboard controls"
          className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-3">
          <span className="text-[10px] uppercase tracking-[0.28em] text-white/45">Keyboard Controls</span>
        </div>

        <div className="space-y-3">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1.5">{section.title}</p>
              <div className="space-y-1.5">
                {section.keys.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-white/60">{label}</span>
                    <kbd className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-lg border border-white/20 bg-white/10 px-1.5 text-[11px] font-semibold text-white">
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Intensity legend — the one color language for "how hard am I
            going" (pedal cadence ring, effort signals all use this ramp). */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Intensity</p>
          <div className="flex items-center justify-between gap-1">
            {INTENSITY_RAMP.map((step) => (
              <div key={step.key} className="flex flex-col items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: step.color, boxShadow: `0 0 6px ${step.color}80` }}
                />
                <span className="text-[10px] font-bold text-white/50">{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const KeyboardShortcutOverlay = memo(KeyboardShortcutOverlayInternal);
