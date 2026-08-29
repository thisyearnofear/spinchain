/**
 * SpinDripChip — ambient SPIN reward presence during the ride.
 *
 * SPIN earning is the product's differentiator, but before this chip the
 * token was invisible until the completion screen. Shows a live-dripping
 * reward value: the real accrual when the rewards engine is active
 * (wallet rides), or the simulator's preview accrual in training/guest
 * simulation. Renders nothing when there's nothing to show.
 */
"use client";

import { useRewardsStore } from "@/app/stores/rewards-store";

export function SpinDripChip({ className = "" }: { className?: string }) {
  const isActive = useRewardsStore((s) => s.isActive);
  const isSimulating = useRewardsStore((s) => s.isSimulating);
  const formattedReward = useRewardsStore((s) => s.formattedReward);
  const simulatedReward = useRewardsStore((s) => s.simulatedReward);

  const show = isActive || isSimulating;
  const value = isActive ? formattedReward : simulatedReward;
  if (!show) return null;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 backdrop-blur ${className}`}
      title="SPIN earned this ride"
      role="status"
      aria-label={`SPIN earned this ride: ${value}`}
    >
      {/* Live drip dot */}
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
      </span>
      <span className="text-[10px] font-black tabular-nums text-amber-300">{value}</span>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/60">SPIN</span>
    </div>
  );
}
