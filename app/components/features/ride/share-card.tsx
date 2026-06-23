"use client";

import { useCallback, useRef, useState } from "react";
import { Share2, Download, X } from "lucide-react";
import { formatTime } from "@/app/lib/formatters";

interface ShareCardProps {
  className?: string;
  effortScore: number;
  avgPower: number;
  avgHeartRate: number;
  durationSec: number;
  spinEarned: string;
  agentName: string;
  riderName?: string;
  walrusBlobId?: string;
}

export function ShareCardButton({
  effortScore,
  avgPower,
  avgHeartRate,
  durationSec,
  spinEarned,
  agentName,
  riderName = "Rider",
  walrusBlobId,
}: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const generateCard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 640;
    const H = 360;
    canvas.width = W;
    canvas.height = H;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(0.5, "#1a1a3a");
    bgGrad.addColorStop(1, "#0a0a1a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Accent glow
    const glowGrad = ctx.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, 300);
    glowGrad.addColorStop(0, "rgba(99, 102, 241, 0.15)");
    glowGrad.addColorStop(1, "rgba(99, 102, 241, 0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    // Brand
    ctx.fillStyle = "#6366f1";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("SPINCHAIN", 24, 28);

    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "10px sans-serif";
    ctx.fillText("On-chain cycling", 24, 42);

    // Effort score — hero number
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px sans-serif";
    ctx.fillText("EFFORT SCORE", W / 2, 80);

    const effortColor = effortScore >= 800 ? "#818cf8" : effortScore >= 500 ? "#6366f1" : "#4f46e5";
    ctx.fillStyle = effortColor;
    ctx.font = "bold 56px sans-serif";
    ctx.fillText(`${effortScore}`, W / 2, 130);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "12px sans-serif";
    ctx.fillText("/ 1000", W / 2, 148);

    // Stats row
    const stats = [
      { label: "POWER", value: `${avgPower}W` },
      { label: "HR", value: `${avgHeartRate}` },
      { label: "DURATION", value: formatTime(durationSec) },
      { label: "SPIN", value: spinEarned },
    ];
    const statW = W / stats.length;
    stats.forEach((stat, i) => {
      const x = statW * i + statW / 2;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "9px sans-serif";
      ctx.fillText(stat.label, x, 195);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(stat.value, x, 218);
    });

    // Divider
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(24, 245);
    ctx.lineTo(W - 24, 245);
    ctx.stroke();

    // Rider + coach info
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px sans-serif";
    ctx.fillText("RIDER", 24, 270);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(riderName, 24, 288);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px sans-serif";
    ctx.fillText("COACH", W - 24, 270);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(agentName, W - 24, 288);

    // Walrus badge
    if (walrusBlobId) {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
      ctx.fillRect(W / 2 - 80, 305, 160, 24);
      ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
      ctx.strokeRect(W / 2 - 80, 305, 160, 24);
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText("✓ Anchored on Walrus", W / 2, 321);
    }

    // Footer
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Verified on-chain • Powered by Sui, Walrus & Avalanche", W / 2, H - 16);

    const url = canvas.toDataURL("image/png");
    setDataUrl(url);
    setShowPreview(true);
  }, [effortScore, avgPower, avgHeartRate, durationSec, spinEarned, agentName, riderName, walrusBlobId]);

  const download = () => {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = `spinchain-ride-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  const copyShareLink = () => {
    const text = `🚴 Just scored ${effortScore}/1000 effort on SpinChain! ${avgPower}W avg power, ${formatTime(durationSec)} session. Earned ${spinEarned} SPIN. Verified on-chain.`;
    navigator.clipboard.writeText(text);
  };

  return (
    <>
      <button
        onClick={generateCard}
        className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold text-fuchsia-200 transition-[transform,background-color] duration-150 active:scale-95 hover:bg-fuchsia-500/20"
      >
        <Share2 className="w-3.5 h-3.5" />
        Share Card
      </button>

      <canvas ref={canvasRef} className="hidden" />

      {showPreview && dataUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="relative max-w-md w-full rounded-3xl border border-white/10 bg-[color:var(--surface)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPreview(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">Your Share Card</h3>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt="SpinChain ride share card"
              className="w-full rounded-2xl border border-white/10"
            />

            <div className="mt-4 flex gap-2">
              <button
                onClick={download}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white transition-[transform,opacity] duration-150 active:scale-95 hover:opacity-90"
              >
                <Download className="w-4 h-4" />
                Download PNG
              </button>
              <button
                onClick={copyShareLink}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-[transform,background-color] duration-150 active:scale-95 hover:bg-white/20"
              >
                <Share2 className="w-4 h-4" />
                Copy Text
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
