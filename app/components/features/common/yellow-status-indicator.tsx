/**
 * Yellow Connection Status Indicator
 * 
 * Shows real-time ClearNode connection status for:
 * - Investors: Demonstrates infrastructure reliability
 * - Riders: Shows reward streaming health
 * - Testers: Debug connection issues
 * 
 * Core Principles:
 * - VISUAL: Clear status at a glance
 * - EDUCATIONAL: Explains what each state means
 * - ACTIONABLE: Shows remediation steps when failed
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isClearNodeConnected } from "@/app/lib/rewards/yellow/clearnode";

interface YellowStatusIndicatorProps {
  compact?: boolean;
  showDetails?: boolean;
}

type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

export function YellowStatusIndicator({ 
  compact = false, 
  showDetails = true 
}: YellowStatusIndicatorProps) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastCheck, setLastCheck] = useState<number>(0);

  useEffect(() => {
    const checkStatus = () => {
      const connected = isClearNodeConnected();
      setStatus(connected ? "connected" : "disconnected");
      setLastCheck(Date.now());
    };

    // Initial check
    checkStatus();

    // Poll every 2 seconds
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const statusConfig = {
    connected: {
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
      icon: "●",
      label: "Yellow Connected",
      description: "Rewards streaming in real-time",
    },
    connecting: {
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30",
      icon: "◐",
      label: "Connecting...",
      description: "Establishing secure channel",
    },
    disconnected: {
      color: "text-zinc-400",
      bgColor: "bg-zinc-500/10",
      borderColor: "border-zinc-500/30",
      icon: "○",
      label: "Yellow Offline",
      description: "Using local reward tracking",
    },
    error: {
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
      icon: "✕",
      label: "Connection Error",
      description: "Check wallet & network",
    },
  };

  const config = statusConfig[status];

  if (compact) {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bgColor} border ${config.borderColor}`}
        title={config.label}
      >
        <span className={`${config.color} text-xs animate-pulse`}>
          {config.icon}
        </span>
        <span className={`text-xs font-medium ${config.color}`}>
          Yellow
        </span>
      </div>
    );
  }

  return (
    <div 
      className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-3 transition-all`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.span
            animate={status === "connected" ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
            className={`${config.color} text-sm`}
          >
            {config.icon}
          </motion.span>
          <span className={`text-sm font-semibold ${config.color}`}>
            {config.label}
          </span>
        </div>
        
        {showDetails && (
          <span className="text-xs text-[color:var(--muted)]">
            {config.description}
          </span>
        )}
      </div>

      {status === "disconnected" && showDetails && (
        <div className="mt-2 pt-2 border-t border-zinc-500/20">
          <p className="text-xs text-[color:var(--muted)]">
            💡 <strong>Demo Mode:</strong> Rewards are simulated locally. 
            Connect wallet and restart ride for real Yellow streaming.
          </p>
        </div>
      )}

      {status === "error" && showDetails && (
        <div className="mt-2 pt-2 border-t border-red-500/20">
          <p className="text-xs text-red-300">
            ⚠️ ClearNode connection failed. Check your wallet connection and try again.
          </p>
        </div>
      )}

      {lastCheck > 0 && (
        <div className="mt-1 text-[10px] text-zinc-500">
          Last check: {new Date(lastCheck).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

/**
 * Compact status for embedding in other components
 */
export function YellowStatusBadge() {
  return <YellowStatusIndicator compact />;
}
