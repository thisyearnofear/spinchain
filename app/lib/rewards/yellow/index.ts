/**
 * Yellow Network Integration
 * 
 * Core Principles:
 * - MODULAR: Self-contained Yellow SDK wrapper
 * - CLEAN: Clear separation between connection, channel, and messaging
 * - DRY: Reuses reward calculator for all calculations
 */

export * from "./channel";
export * from "./streaming";
export * from "./pending-store";
export * from "./clearnode";

// Yellow Network Constants
export const YELLOW_CLEARNODE_URL = "wss://clearnet-sandbox.yellow.com/ws";
export const YELLOW_PRODUCTION_URL = "wss://clearnet.yellow.com/ws";

// Protocol identifier for SpinChain rewards
export const SPINCHAIN_PROTOCOL = "spinchain-rewards-v1";

// Default channel parameters
export const DEFAULT_CHANNEL_PARAMS = {
  weights: [50, 50], // Equal participation
  quorum: 100, // Both participants must agree
  challenge: 0, // No challenge period for demo
};

// Update interval (milliseconds)
export const STREAMING_INTERVAL = 10000; // 10 seconds
