/**
 * Consolidated Rewards Module
 * 
 * Core Principles:
 * - DRY: Single source of truth for all reward logic
 * - CLEAN: Clear separation between calculation, channels, and settlement
 * - MODULAR: Multiple reward modes (Yellow, ZK, Sui) with unified interface
 * 
 * This module consolidates reward functionality that was previously
 * scattered across useZKClaim, useSuiRewards, and IncentiveEngine.
 */

// Types
export * from "./types";

// Calculator (DRY - shared across all modes)
export * from "./calculator";

// Yellow State Channels
export * from "./yellow";

// ZK Integration (consolidated from useZKClaim)
export * from "./zk";
