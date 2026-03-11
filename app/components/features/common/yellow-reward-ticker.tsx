/**
 * Yellow Reward Ticker
 * 
 * Displays real-time reward accumulation during workouts
 * Integrates into the existing ride HUD
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Adds to existing HUD without replacing
 * - CLEAN: Minimal, focused component
 * - MODULAR: Can be used standalone or integrated
 */

"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RewardStreamState, RewardMode } from "../../../lib/rewards";
import { formatReward, getStreamingStatus, calculateStreamingRate } from "../../../lib/rewards";

// ============================================================================
// Types
// ============================================================================

interface YellowRewardTickerProps {
  /** Current stream state from useRewards */
  streamState: RewardStreamState;
  /** Reward mode */
  mode: RewardMode;
  /** Token symbol (SPIN, USDC, etc) */
  symbol?: string;
  /** Token decimals */
  decimals?: number;
  /** Compact mode for small screens */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function YellowRewardTicker({
  streamState,
  mode,
  symbol = "SPIN",
  decimals = 18,
  compact = false,
  className = "",
}: YellowRewardTickerProps) {
  // Only show for Yellow streaming mode
  if (mode !== "yellow-stream") {
    return null;
  }

  const status = getStreamingStatus(streamState);
  const rate = calculateStreamingRate(streamState);
  const formattedAmount = formatReward(streamState.accumulated, decimals, 2);
  const formattedRate = formatReward(rate, decimals, 1);

  if (compact) {
    return (
      <CompactTicker
        amount={formattedAmount}
        symbol={symbol}
        status={status}
        updateCount={streamState.updateCount}
        className={className}
      />
    );
  }

  return (
    <FullTicker
      amount={formattedAmount}
      rate={formattedRate}
      symbol={symbol}
      status={status}
      updateCount={streamState.updateCount}
      lastUpdate={streamState.lastUpdate}
      className={className}
    />
  );
}

// ============================================================================
// Compact View (for mobile HUD)
// ============================================================================

interface CompactTickerProps {
  amount: string;
  symbol: string;
  status: { label: string; color: string; icon: string };
  updateCount: number;
  className?: string;
}

function CompactTicker({ amount, symbol, status, className }: CompactTickerProps) {
  return (
    <div
      className={`
        flex items-center gap-3
        rounded-xl bg-black/40 backdrop-blur-2xl 
        border border-white/10 px-4 py-2.5
        shadow-2xl relative overflow-hidden group
        ${className}
      `}
    >
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent" />

      {/* Status indicator */}
      <div className="relative">
        <span className={`text-sm ${status.color} relative z-10`}>{status.icon}</span>
        <span className="absolute inset-0 bg-white/20 blur-md rounded-full animate-pulse" />
      </div>

      {/* Amount */}
      <div className="flex items-baseline gap-1.5">
        <motion.span
          key={amount}
          initial={{ opacity: 0.5, y: -5, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="text-xl font-black text-white tracking-tighter"
        >
          {amount}
        </motion.span>
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{symbol}</span>
      </div>

      {/* State Badge */}
      <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
        <div className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
        <span className="text-[9px] font-black text-yellow-400/80 uppercase tracking-tighter">
          STREAMING
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Full View (for desktop/tablet HUD)
// ============================================================================

interface FullTickerProps {
  amount: string;
  rate: string;
  symbol: string;
  status: { label: string; color: string; icon: string };
  updateCount: number;
  lastUpdate: number;
  className?: string;
}

function FullTicker({
  amount,
  rate,
  symbol,
  status,
  updateCount,
  lastUpdate,
  className,
}: FullTickerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeSinceUpdate = useMemo(() => {
    if (lastUpdate === 0) return null;
    const seconds = Math.floor((now - lastUpdate) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  }, [now, lastUpdate]);

  return (
    <div
      className={`
        relative rounded-2xl bg-black/40 backdrop-blur-3xl 
        border border-white/10 
        p-5 min-w-[240px] shadow-2xl overflow-hidden group
        ${className}
      `}
    >
      {/* Dynamic Golden Aura Background */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-yellow-500/10 rounded-full blur-[60px] group-hover:bg-yellow-500/20 transition-all duration-1000" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent opacity-30" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded bg-yellow-500/10 border border-yellow-500/20">
            <span className={`text-sm ${status.color}`}>{status.icon}</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40">
            Real-time Accrual
          </span>
        </div>
        <div className="flex items-center gap-2 py-0.5 px-2 rounded-full bg-yellow-500/10 border border-yellow-500/20">
          <span className="h-1 w-1 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-[9px] font-bold text-yellow-400/90 uppercase tracking-tighter">
            Yellow State Channel (Live)
          </span>
        </div>
      </div>

      {/* Main amount */}
      <div className="flex items-baseline gap-2.5 mb-2 relative z-10">
        <AnimatePresence mode="wait">
          <motion.span
            key={amount}
            initial={{ opacity: 0.5, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="text-4xl font-black text-white tracking-tighter drop-shadow-lg"
          >
            {amount}
          </motion.span>
        </AnimatePresence>
        <span className="text-sm font-bold text-yellow-500/80 uppercase tracking-widest">{symbol}</span>
      </div>

      {/* Rate */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-white/50 mb-5 relative z-10">
        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-yellow-500/70">+{rate} {symbol}/min</span>
        {timeSinceUpdate && (
          <span className="opacity-40 tracking-tight italic text-[9px]">Synced {timeSinceUpdate}</span>
        )}
      </div>

      {/* Tactical Progress Visualizer */}
      <div className="relative h-1 w-full bg-white/5 rounded-full overflow-hidden mb-3">
        <div className="absolute inset-0 bg-yellow-500/5" />
        <motion.div
          className="h-full bg-gradient-to-r from-yellow-600 via-amber-400 to-yellow-300 relative"
          initial={{ width: "0%" }}
          animate={{ width: `${Math.min((updateCount % 8) * 12.5, 100)}%` }}
          transition={{ duration: 0.8, ease: "circOut" }}
        >
          {/* Animated glow on progress head */}
          <div className="absolute right-0 top-0 h-full w-4 bg-white/40 blur-sm" />
        </motion.div>
      </div>

      {/* Footer / Meta Info */}
      <div className="flex items-center justify-between text-[9px] font-bold text-white/20 uppercase tracking-widest relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="opacity-50">Packet Hash:</span>
          <span className="text-white/40 font-mono">0x{Math.floor(updateCount * 1337).toString(16).padStart(4, '0')}</span>
        </div>
        <span>State Channel Active</span>
      </div>
    </div>
  );
}

// ============================================================================
// Status Badge (standalone)
// ============================================================================

interface StreamingStatusBadgeProps {
  streamState: RewardStreamState;
  className?: string;
}

export function StreamingStatusBadge({
  streamState,
  className = "",
}: StreamingStatusBadgeProps) {
  const status = getStreamingStatus(streamState);

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 
        px-2 py-1 rounded-full 
        text-xs font-medium
        bg-black/50 backdrop-blur
        border border-white/10
        ${status.color}
        ${className}
      `}
    >
      <span className="relative flex h-2 w-2">
        {streamState.status === "open" && (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </>
        )}
        {streamState.status !== "open" && (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        )}
      </span>
      {status.label}
    </span>
  );
}

// ============================================================================
// Export
// ============================================================================

export default YellowRewardTicker;
