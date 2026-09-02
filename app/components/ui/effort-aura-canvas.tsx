"use client";

import { useEffect, useRef } from "react";

/**
 * EffortAuraCanvas — Maxima's fixed pattern + Lottie-as-mask via globalCompositeOperation.
 *
 * Offscreen canvas holds a repeating dot pattern (the "fixed pattern").
 * On-screen canvas draws that pattern, then uses a radial gradient (stand-in for
 * Lottie's alpha mask) with `source-in` to reveal the pattern only where the
 * effort aura is. Scroll or prop `intensity` drives the mask radius/opacity.
 *
 * For SpinChain, this can wrap any Lottie: render Lottie to a canvas, use that
 * canvas as the mask instead of the gradient.
 */
export function EffortAuraCanvas({
  intensity = 0.5,
  className = "",
}: {
  intensity?: number; // 0 → 1, e.g. scrubProgress or effort
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const patternRef = useRef<HTMLCanvasElement | null>(null);

  // Build offscreen pattern once
  useEffect(() => {
    const patternCanvas = document.createElement("canvas");
    patternCanvas.width = 80;
    patternCanvas.height = 80;
    const pctx = patternCanvas.getContext("2d");
    if (pctx) {
      pctx.fillStyle = "#0a0a0f";
      pctx.fillRect(0, 0, 80, 80);
      pctx.fillStyle = "rgba(109,124,255,0.12)";
      for (let y = 0; y < 80; y += 16) {
        for (let x = 0; x < 80; x += 16) {
          pctx.beginPath();
          pctx.arc(x + 8, y + 8, 1.2, 0, Math.PI * 2);
          pctx.fill();
        }
      }
    }
    patternRef.current = patternCanvas;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const patternCanvas = patternRef.current;
    if (!canvas || !patternCanvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Step 1: draw fixed pattern (stretched to fill)
    const pattern = ctx.createPattern(patternCanvas, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, rect.width, rect.height);
    }

    // Step 2: use mask — here a radial gradient standing in for Lottie's alpha.
    // In production, replace this gradient with `ctx.drawImage(lottieCanvas, 0, 0)`
    // and keep `globalCompositeOperation = "source-in"` to mask the pattern.
    ctx.globalCompositeOperation = "source-in";
    const cx = rect.width * (0.5 + Math.sin(intensity * Math.PI) * 0.08);
    const cy = rect.height * 0.5;
    const radius = 40 + intensity * 120;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(109,124,255,${0.15 + intensity * 0.25})`);
    grad.addColorStop(0.5, `rgba(124,92,255,${0.1 + intensity * 0.15})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Reset for next frame if intensity changes
    ctx.globalCompositeOperation = "source-over";
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    />
  );
}
