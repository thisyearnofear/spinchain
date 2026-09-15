"use client";

import { Parallax } from "@/app/components/ui/scroll-animations";
import { Activity, Heart, Pause, Play, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Renders one frame of the sprint → ignition world at time t / phase p.
function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, phase: number) {
      ctx.clearRect(0, 0, w, h);

      // Background: dark road extending to horizon
      const bgGrad = ctx.createLinearGradient(0, h * 0.3, 0, h);
      bgGrad.addColorStop(0, "#0a0a12");
      bgGrad.addColorStop(0.4, "#0f0f1a");
      bgGrad.addColorStop(1, "#1a1020");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Horizon glow — intensifies with phase
      const intensity = 0.15 + phase * 0.45;
      const glowGrad = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, w * 0.7);
      glowGrad.addColorStop(0, `rgba(249, 115, 22, ${intensity})`);
      glowGrad.addColorStop(0.5, `rgba(239, 68, 68, ${intensity * 0.4})`);
      glowGrad.addColorStop(1, "transparent");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);

      // Road: perspective trapezoid
      const roadTop = { x1: w * 0.35, x2: w * 0.65, y: h * 0.32 };
      const roadBot = { x1: w * 0.05, x2: w * 0.95, y: h * 0.88 };
      ctx.beginPath();
      ctx.moveTo(roadTop.x1, roadTop.y);
      ctx.lineTo(roadTop.x2, roadTop.y);
      ctx.lineTo(roadBot.x2, roadBot.y);
      ctx.lineTo(roadBot.x1, roadBot.y);
      ctx.closePath();

      const roadGrad = ctx.createLinearGradient(0, roadTop.y, 0, roadBot.y);
      roadGrad.addColorStop(0, `rgba(30, 20, 40, ${0.7 + phase * 0.3})`);
      roadGrad.addColorStop(1, `rgba(15, 10, 20, 1)`);
      ctx.fillStyle = roadGrad;
      ctx.fill();

      // Road edge glow — accent color pulses with sprint
      const edgeAlpha = 0.2 + phase * 0.5 + Math.sin(t * 3) * 0.08;
      ctx.strokeStyle = `rgba(249, 115, 22, ${edgeAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Lane dashes (perspective): animate toward viewer
      const dashCount = 8;
      for (let i = 0; i < dashCount; i++) {
        const progress = ((i / dashCount) + (t * 0.4) % 1);
        const y = roadTop.y + (roadBot.y - roadTop.y) * progress;
        const xScale = progress;
        const dashW = (roadBot.x2 - roadBot.x1) * xScale * 0.4;
        const dashX = w / 2 - dashW / 2;
        ctx.fillStyle = `rgba(249, 115, 22, ${progress * 0.5 * (0.3 + phase * 0.7)})`;
        ctx.fillRect(dashX, y - 1, dashW, 2);
      }

      // Fog: animated translucent bands at mid-distance
      const fogCount = 3;
      for (let i = 0; i < fogCount; i++) {
        const fogY = h * 0.45 + i * 30;
        const fogAlpha = (0.06 + phase * 0.12) * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 2));
        ctx.fillStyle = `rgba(100, 80, 140, ${fogAlpha})`;
        ctx.fillRect(0, fogY, w, 20 + i * 10);
      }

      // Sprint sparks: small glowing dots near the road edges during sprint/ignition
      if (phase >= 1) {
        const sparkCount = 6;
        for (let i = 0; i < sparkCount; i++) {
          const sparkPhase = ((i / sparkCount) + t * 0.6) % 1;
          const sparkY = h * 0.5 + sparkPhase * (h * 0.3);
          const sparkX = w / 2 + (Math.sin(i * 1.7 + t) * w * 0.25);
          const sparkR = 2 + phase * 2;
          const sparkAlpha = sparkPhase * (phase === 2 ? 0.9 : 0.5);
          const sparkGrad = ctx.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, sparkR * 3);
          sparkGrad.addColorStop(0, `rgba(251, 191, 36, ${sparkAlpha})`);
          sparkGrad.addColorStop(1, "transparent");
          ctx.fillStyle = sparkGrad;
          ctx.fillRect(sparkX - sparkR * 3, sparkY - sparkR * 3, sparkR * 6, sparkR * 6);
        }
      }

      // Ignition burst: radial flash during ignition phase
      if (phase === 2) {
        const burstProgress = (t * 0.5) % 1;
        const burstR = burstProgress * w * 0.8;
        const burstAlpha = (1 - burstProgress) * 0.6;
        const burstGrad = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, burstR);
        burstGrad.addColorStop(0, `rgba(251, 191, 36, ${burstAlpha})`);
        burstGrad.addColorStop(0.5, `rgba(249, 115, 22, ${burstAlpha * 0.5})`);
        burstGrad.addColorStop(1, "transparent");
        ctx.fillStyle = burstGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // HUD overlay: metrics
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(w * 0.05, h * 0.05, 90, 28);
      ctx.fillStyle = "#fb923c";
      ctx.font = "bold 14px monospace";
      ctx.fillText(`${Math.floor(85 + phase * 95)}W`, w * 0.05 + 8, h * 0.05 + 19);

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(w * 0.05, h * 0.05 + 32, 90, 22);
      ctx.fillStyle = "#f87171";
      ctx.font = "11px monospace";
      ctx.fillText(`${Math.floor(140 + phase * 40)} BPM`, w * 0.05 + 8, h * 0.05 + 47);

      // Phase label
      const phaseLabel = phase < 0.5 ? "WARMUP" : phase < 1.5 ? "SPRINT" : "IGNITION";
      const phaseColor = phase < 0.5 ? "#6b7280" : phase < 1.5 ? "#fb923c" : "#fbbf24";
      ctx.fillStyle = phaseColor;
      ctx.font = "bold 11px monospace";
      ctx.letterSpacing = "2px";
      ctx.fillText(phaseLabel, w * 0.05 + 8, h * 0.88);

}

// Sprint → Ignition animated preview — a self-contained canvas that shows
// the reactive world responding to effort. Mirrors what the rider sees:
// calm road → sprint pressure builds → ignition reward pulse.
// WCAG 2.2.2: offers a pause control; prefers-reduced-motion gets a static frame.
function SprintIgnitionPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef(0); // 0=rest, 1=sprint, 2=ignition
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduced || paused) {
      // Static mid-sprint frame — no loop, no phase cycling.
      phaseRef.current = 1;
      drawFrame(ctx, canvas.width, canvas.height, 2.5, phaseRef.current);
      return;
    }

    let t = 0;
    const draw = () => {
      drawFrame(ctx, canvas.width, canvas.height, t, phaseRef.current);
      t += 0.016;
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    // Phase progression: 0=rest(3s) → 1=sprint(4s) → 2=ignition(2s) → repeat
    let phaseTimer = 0;
    const phaseDurations = [3, 4, 2];
    let phaseIdx = 0;
    const tick = setInterval(() => {
      phaseTimer += 0.1;
      if (phaseTimer >= phaseDurations[phaseIdx]) {
        phaseTimer = 0;
        phaseIdx = (phaseIdx + 1) % 3;
      }
      phaseRef.current = phaseIdx;
    }, 100);

    return () => {
      cancelAnimationFrame(animRef.current);
      clearInterval(tick);
    };
  }, [paused]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={480}
        height={280}
        className="w-full h-full rounded-xl"
        aria-label="Animated preview of the reactive sprint-to-ignition ride world"
      />
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? "Play preview animation" : "Pause preview animation"}
        className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 backdrop-blur transition-colors hover:text-white"
      >
        {paused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
      </button>
    </>
  );
}

const liveMetrics = [
  { icon: Heart, label: "Heart rate zone", color: "text-rose-400" },
  { icon: Zap, label: "Power output", color: "text-amber-400" },
  { icon: Activity, label: "Flow state", color: "text-emerald-400" },
];

export function LivePreviewSection() {
  return (
    <Parallax speed={0.3}>
      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 md:p-8" aria-label="In-ride experience">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--foreground)] md:text-3xl">
              Your effort becomes the world
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted)] md:text-base">
              Power, heart rate, and cadence feed the scene in real time. Hit a
              sprint and the road glows hotter. Settle into a climb and the fog
              thickens around you.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 md:mt-6 md:gap-3">
              {liveMetrics.map((metric) => (
                <span
                  key={metric.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--foreground)]"
                >
                  <metric.icon className={`h-3.5 w-3.5 ${metric.color}`} />
                  {metric.label}
                </span>
              ))}
            </div>
          </div>

          {/* Sprint → Ignition live preview — self-contained canvas animation */}
          <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)]">
            <SprintIgnitionPreview />
          </div>
        </div>
      </section>
    </Parallax>
  );
}
