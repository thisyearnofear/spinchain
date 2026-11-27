"use client";

import { useCallback, useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import {
  clampLensWidth,
  lensKeyTarget,
  pushLensTarget,
  stepLensWidth,
  wheelToLensWidth,
} from "./ride-lens";

export interface RideLensControl {
  /** Eased width, 0..1 — read in the frame loop, never React state. */
  widthRef: MutableRefObject<number>;
  /** What the controls are pushing toward. */
  targetRef: MutableRefObject<number>;
  /** Advance the ease by one frame; returns the width to render this frame. */
  advance: (deltaSeconds: number) => number;
  /** Hold the lens at a fixed width, skipping the ease (harness/inspection). */
  setWidth: (width: number) => void;
}

/**
 * Two inputs, one control.
 *
 * The wheel and the keyboard both write the same *target*; a single eased width
 * is what the camera and the warp pass read. That is deliberate — tracks read
 * the two as competing sources and the lens jitters between them, and a
 * pointer that lands mid-ease must not fight the input still being held.
 *
 * Rebuild-from-target also means the width can never drift: a hundred small
 * wheel events accumulate in the target, not in the camera, so scrolling back
 * to 0 restores the shipped frame exactly.
 *
 * Reduced motion is handled by the caller passing `enabled: false`, which also
 * pulls the target back to 0 instead of freezing it wide.
 */
export function useRideLens(enabled: boolean): RideLensControl {
  const widthRef = useRef(0);
  const targetRef = useRef(0);

  const advance = useCallback((deltaSeconds: number) => {
    const next = stepLensWidth(widthRef.current, targetRef.current, deltaSeconds);
    widthRef.current = next;
    return next;
  }, []);

  const setWidth = useCallback((width: number) => {
    const clamped = clampLensWidth(width);
    widthRef.current = clamped;
    targetRef.current = clamped;
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Walk back to the normal lens rather than snapping, so leaving ride mode
      // does not pop the frame.
      targetRef.current = 0;
      return;
    }

    const onWheel = (event: WheelEvent) => {
      // Modified gestures belong to the browser: ctrl+wheel is page zoom on
      // trackpads, shift+wheel is horizontal scroll.
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const delta = wheelToLensWidth(event.deltaY, event.deltaMode, window.innerHeight);
      if (delta === 0) return;
      // The ride shell is `fixed inset-0`, so the wheel has nothing to scroll —
      // claim it or the gesture is swallowed by the browser.
      event.preventDefault();
      targetRef.current = pushLensTarget(targetRef.current, delta);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const el = event.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      const next = lensKeyTarget(event.code, targetRef.current);
      if (next === null) return;
      event.preventDefault();
      targetRef.current = next;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled]);

  return { widthRef, targetRef, advance, setWidth };
}
