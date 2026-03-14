"use client";

import { memo, useEffect, useState } from "react";

interface KeyboardShortcutOverlayProps {
  /** Whether to show the overlay */
  show: boolean;
  /** Auto-dismiss after this many ms (default 5000) */
  duration?: number;
  /** Called when overlay dismisses */
  onDismiss?: () => void;
}

/**
 * KeyboardShortcutOverlay - Briefly shows keyboard bindings when simulator mode activates.
 * Auto-dismisses after a few seconds, similar to how games show controls on first play.
 */
function KeyboardShortcutOverlayInternal({ show, duration = 5000, onDismiss }: KeyboardShortcutOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setFading(false);

      const fadeTimer = setTimeout(() => setFading(true), duration - 400);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        setFading(false);
        onDismiss?.();
      }, duration);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [show, duration, onDismiss]);

  if (!visible) return null;

  const keys = [
    { key: "↑", label: "Increase Power" },
    { key: "↓", label: "Decrease Power" },
    { key: "←", label: "Decrease Cadence" },
    { key: "→", label: "Increase Cadence" },
  ];

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-[55] pointer-events-none transition-opacity duration-400 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="rounded-2xl border border-white/15 bg-black/85 backdrop-blur-xl px-5 py-4 shadow-2xl">
        <div className="text-center mb-3">
          <span className="text-[10px] uppercase tracking-[0.28em] text-white/45">Keyboard Controls</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {keys.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <kbd className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-sm font-semibold text-white">
                {key}
              </kbd>
              <span className="text-xs text-white/60">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const KeyboardShortcutOverlay = memo(KeyboardShortcutOverlayInternal);
