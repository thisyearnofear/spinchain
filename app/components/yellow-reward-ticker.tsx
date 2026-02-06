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

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RewardStreamState, RewardMode } from "../lib/rewards";
import { formatReward, getStreamingStatus, calculateStreamingRate } from "../lib/rewards";

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
        flex items-center gap-2 
        rounded-lg bg-black/70 backdrop-blur-xl 
        border border-white/20 
        px-3 py-2
        ${className}
      `}
    >
      {/* Status indicator */}
      <span className={`text-xs ${status.color}`}>{status.icon}</span>
      
      {/* Amount */}
      <div className="flex items-baseline gap-1">
        <motion.span
          key={amount}
          initial={{ opacity: 0.5, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-bold text-white"
        >
          {amount}
        </motion.span>
        <span className="text-xs text-white/50">{symbol}</span>
      </div>
      
      {/* Yellow badge */}
      <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">
        Yellow
      </span>
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
  const timeSinceUpdate = useMemo(() => {
    if (lastUpdate === 0) return null;
    const seconds = Math.floor((Date.now() - lastUpdate) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  }, [lastUpdate]);

  return (
    <div
      className={`
        rounded-xl bg-black/70 backdrop-blur-xl 
        border border-white/20 
        p-4 min-w-[200px]
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${status.color}`}>{status.icon}</span>
          <span className="text-xs uppercase tracking-wider text-white/50">
            Live Rewards
          </span>
        </div>
        <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
          Yellow
        </span>
      </div>

      {/* Main amount */}
      <div className="flex items-baseline gap-2 mb-2">
        <AnimatePresence mode="wait">
          <motion.span
            key={amount}
            initial={{ opacity: 0.5, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0.5, scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="text-3xl font-bold text-white"
          >
            {amount}
          </motion.span>
        </AnimatePresence>
        <span className="text-sm text-white/50">{symbol}</span>
      </div>

      {/* Rate */}
      <div className="flex items-center gap-2 text-xs text-white/40 mb-3">
        <span>+{rate} {symbol}/min</span>
        {timeSinceUpdate && (
          <span className="text-white/20">• Updated {timeSinceUpdate}</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-yellow-500 to-amber-400"
          initial={{ width: "0%" }}
          animate={{ width: `${Math.min((updateCount % 6) * 20, 100)}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-white/30">
        <span>{updateCount} updates</span>
        <span>State Channel</span>
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
