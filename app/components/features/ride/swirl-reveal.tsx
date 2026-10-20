"use client";

/**
 * SwirlReveal — Sleepers' threshold-texture reveal, applied to the
 * activation → ride handoff (roadmap P1 #11).
 *
 * The previous handoff was a linear radial-gradient fade; the world simply
 * appeared. This replaces the *texture* of that reveal: a full-screen
 * dissolve driven by a deterministic noise field that is domain-warped into
 * a slow vortex — the veil spirals away with the rider's launch instead of
 * evaporating straight-on. Coverage falls in a soft band so the edge never
 * steps.
 *
 * Kept deliberately cheap and renderer-agnostic:
 *  - it is a **DOM canvas 2D** overlay, not a WebGL pass — it covers both
 *    the 3D canvas and the 2D Focus layer (the crossfade spans both), and
 *    it cannot fail to get a context the WebGL probes already vetted;
 *  - the mask is computed on a ~256×144 buffer, then GPU-scaled to the
 *    viewport — ~37k pixel writes per frame, well under a millisecond;
 *  - geometry and noise are computed once per mount, never per frame;
 *  - prefers-reduced-motion never renders it (the parent's existing quick
 *    fade owns that path).
 */

import { useEffect, useRef } from "react";

const GRID_W = 256;

const DARK = [16, 8, 34] as const; // deep plum veil
const LIGHT = [253, 224, 71] as const; // fallback warm accent centre

export function SwirlReveal({
  accentColor,
  durationMs = 620,
}: {
  /** CSS hex colour from the interval phase — the veil's luminous core. */
  accentColor: string;
  /** Reveal duration; finishes before the parent's 650ms handoff unmounts. */
  durationMs?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = GRID_W;
    const h =
      canvas.clientHeight > 0
        ? Math.max(90, Math.round((GRID_W * canvas.clientHeight) / canvas.clientWidth))
        : 144;
    canvas.width = w;
    canvas.height = h;

    const accent = parseHex(accentColor) ?? LIGHT;
    // One-time per-pixel geometry + deterministic hash noise (stable across
    // Strict Mode remounts — Math.random() would differ each mount).
    const gridX = new Float32Array(w * h);
    const gridY = new Float32Array(w * h);
    const noise = new Float32Array(w * h);
    const radius = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const nx = (x / w) * 2 - 1;
        const ny = (y / h) * 2 - 1;
        gridX[i] = nx;
        gridY[i] = ny;
        const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        noise[i] = s - Math.floor(s);
        // Slight vertical squash: the swirl reads as an ellipse, not a ring.
        radius[i] = Math.sqrt(nx * nx + ny * ny * 0.72) / 1.36;
      }
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(w, h);
    const data = img.data;

    let raf = 0;
    let stopped = false;
    const start = performance.now();
    const ease = (t: number) => t * t * (3 - 2 * t);

    const frame = (now: number) => {
      if (stopped) return;
      const t = Math.min(1, (now - start) / durationMs);
      const p = ease(t);
      const swirlStrength = 2.6 + 2.4 * p;
      for (let i = 0; i < w * h; i++) {
        const nx = gridX[i];
        const ny = gridY[i];
        const r = radius[i];
        const a = Math.atan2(ny, nx);
        // The vortex: the domain warp strengthens as coverage drops, so the
        // veil unwinds outward instead of receding linearly.
        const warped =
          noise[i] * 0.82 +
          Math.sin(a * 3 + r * 9 - p * 7.2 + swirlStrength * r * 0.4) * 0.18;
        const band = 0.22 + p * 0.18;
        const alpha = 1 - smoothstep(p - band, p, warped);
        const o = i * 4;
        const shade = Math.min(1, r * 1.35);
        data[o] = DARK[0] * shade + accent[0] * (1 - shade) * 0.65;
        data[o + 1] = DARK[1] * shade + accent[1] * (1 - shade) * 0.65;
        data[o + 2] = DARK[2] * shade + accent[2] * (1 - shade) * 0.65;
        data[o + 3] = Math.max(0, Math.min(1, alpha)) * 255;
      }
      ctx.putImageData(img, 0, 0);
      canvas.style.opacity = String(1 - p * 0.85);
      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        // Fade the (now nearly empty) canvas fully out — a hard removal of
        // the last vanishing pixels would read as a cut.
        canvas.style.transition = "opacity 240ms ease-out";
        canvas.style.opacity = "0";
        stopped = true;
      }
    };
    canvas.style.transition = "";
    raf = requestAnimationFrame(frame);

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [accentColor, durationMs]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full opacity-0"
      data-swirl-reveal="true"
      aria-hidden
    />
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-5, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function parseHex(hex: string): readonly [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
