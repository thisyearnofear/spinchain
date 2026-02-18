// Simplified BLE Device Selector - Compatible with existing components
// Following Core Principles: Enhancement First, DRY patterns

"use client";

import { useState } from "react";
import { useBleData } from "../../hooks/ble/use-ble-data";
import { motion } from "framer-motion";
import { 
  Bluetooth, 
  BluetoothConnected, 
  BluetoothSearching,
  Power,
  Heart,
  RotateCcw
} from "lucide-react";

export interface FitnessMetrics {
  heartRate?: number;
  power?: number;
  cadence?: number;
  speed?: number;
  distance?: number;
}

export interface DeviceSelectorProps {
  onMetricsUpdate?: (metrics: FitnessMetrics) => void;
  className?: string;
}

export function DeviceSelector({ onMetricsUpdate, className = "" }: DeviceSelectorProps) {
  const {
    metrics,
    status,
    device,
    error,
    isScanning,
    isConnected,
    isPending,
    scanAndConnect,
    disconnect,
    clearError
  } = useBleData({
    onSuccess: onMetricsUpdate,
    autoConnect: false
  });

  // Connection status indicator
  const getConnectionStatus = () => {
    switch (status) {
      case 'connected': return { icon: BluetoothConnected, color: 'text-green-500', label: 'Connected' };
      case 'scanning': return { icon: BluetoothSearching, color: 'text-blue-500', label: 'Scanning' };
      case 'connecting': return { icon: Bluetooth, color: 'text-yellow-500', label: 'Connecting' };
      case 'error': return { icon: Bluetooth, color: 'text-red-500', label: 'Error' };
      default: return { icon: Bluetooth, color: 'text-gray-400', label: 'Disconnected' };
    }
  };

  const statusInfo = getConnectionStatus();
  const StatusIcon = statusInfo.icon;

  return (
    <div className={`rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <StatusIcon className={`h-6 w-6 ${statusInfo.color}`} />
              {isScanning && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-blue-500"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-[color:var(--foreground)]">
                Fitness Equipment
              </h3>
              <p className="text-sm text-[color:var(--muted)]">
                {statusInfo.label}
                {device && ` - ${device.name}`}
              </p>
            </div>
          </div>
          
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${
            isConnected 
              ? 'bg-green-500/20 text-green-500' 
              : 'bg-gray-500/20 text-gray-500'
          }`}>
            {isConnected ? "ACTIVE" : "INACTIVE"}
          </div>
        </div>

        {/* Connection Controls */}
        <div className="flex gap-3">
          {!isConnected ? (
            <button
              onClick={scanAndConnect}
              disabled={isPending || isScanning}
              className="flex-1 rounded-lg bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <BluetoothSearching className="mr-2 inline h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Bluetooth className="mr-2 inline h-4 w-4" />
                  Connect Device
                </>
              )}
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--muted)]"
            >
              <Bluetooth className="mr-2 inline h-4 w-4" />
              Disconnect
            </button>
          )}
          
          {error && (
            <button
              onClick={clearError}
              className="rounded-lg p-2 text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Device Metrics Display */}
        {isConnected && metrics && (
          <motion.div 
            className="grid grid-cols-2 gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <MetricCard
              icon={<Power className="h-4 w-4 text-blue-500" />}
              label="Power"
              value={`${Math.round(metrics.power)} W`}
              trend={metrics.power > 100 ? "high" : metrics.power > 50 ? "medium" : "low"}
            />
            
            <MetricCard
              icon={<Heart className="h-4 w-4 text-red-500" />}
              label="Heart Rate"
              value={`${Math.round(metrics.heartRate)} BPM`}
              trend={metrics.heartRate > 160 ? "high" : metrics.heartRate > 120 ? "medium" : "low"}
            />
          </motion.div>
        )}

        {/* Error Display */}
        {error && (
          <div className="rounded-lg bg-red-500/10 p-4">
            <p className="text-sm font-medium text-red-500">
              {error.message}
            </p>
            <p className="mt-1 text-xs text-red-400">
              Try moving closer to your device or ensure it&apos;s powered on.
            </p>
          </div>
        )}

        {/* Debug Info (Development only) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="text-xs text-[color:var(--muted)]">
            <summary className="cursor-pointer">Debug Info</summary>
            <div className="mt-2 space-y-1 font-mono">
              <div>Status: {status}</div>
              <div>Connected: {isConnected.toString()}</div>
              <div>Scanning: {isScanning.toString()}</div>
              {device && <div>Device: {device.name} ({device.id})</div>}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: "high" | "medium" | "low";
}

function MetricCard({ icon, label, value, trend }: MetricCardProps) {
  const trendColors = {
    high: "text-red-500",
    medium: "text-yellow-500", 
    low: "text-green-500"
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] p-3">
      {icon}
      <div>
        <p className="text-xs text-[color:var(--muted)]">{label}</p>
        <p className={`font-semibold ${trendColors[trend]}`}>{value}</p>
      </div>
    </div>
  );
}