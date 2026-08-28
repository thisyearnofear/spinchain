"use client";

import { memo, useEffect, useState } from "react";
import { Z_LAYERS } from "@/app/lib/ui/z-layers";

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
 * Unlike before, this no longer auto-dismisses after a few seconds: it stays
 * visible until the rider closes it (button or Esc), and can be re-opened via
 * the "Keys" control, so the controls are never "hidden" mid-ride.
 */
function KeyboardShortcutOverlayInternal({ show, onDismiss }: KeyboardShortcutOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(show);
  }, [show]);

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
        { key: "← / →", label: "Left / right leg" },
        { key: "↑ / ↓", label: "Pedal (auto-alternate)" },
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
      </div>
    </div>
  );
}

export const KeyboardShortcutOverlay = memo(KeyboardShortcutOverlayInternal);
