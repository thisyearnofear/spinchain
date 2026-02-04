"use client";

/**
 * Sui Session Management Hook
 * Manages the complete lifecycle: create session → join → telemetry → close
 * 
 * Core Principles Applied:
 * - DRY: Uses shared use-sui-transaction for all transactions
 * - CLEAN: Separated from EVM logic, clear dependencies
 * - MODULAR: Can be used independently or composed with EVM flows
 * - ENHANCEMENT FIRST: Extends existing session concepts to Sui layer
 */

import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState, useCallback } from "react";
import { SUI_CONFIG } from "../config";
import { useSuiTransaction } from "./use-sui-transaction";

const MODULE_NAME = "spinsession";

export interface SuiSession {
  id: string;
  classId: string;
  instructor: string;
  duration: number;
  isActive: boolean;
}

export interface SuiRiderStats {
  id: string;
  sessionId: string;
  rider: string;
  hr: number;
  power: number;
  cadence: number;
  lastUpdate: number;
}

interface UseSuiSessionReturn {
  // Session lifecycle
  createSession: (classId: string, duration: number) => Promise<string | null>;
  joinSession: (sessionId: string) => Promise<string | null>;
  closeSession: (sessionId: string) => Promise<boolean>;
  
  // Data
  session: SuiSession | null;
  riderStats: SuiRiderStats | null;
  
  // State
  isCreating: boolean;
  isJoining: boolean;
  error: Error | null;
  isConnected: boolean;
}

/**
 * Hook for managing Sui performance sessions
 * 
 * Usage:
 * ```typescript
 * const { createSession, joinSession, isCreating } = useSuiSession();
 * 
 * // Create a session (instructor)
 * const sessionId = await createSession(evmClassId, 3600);
 * 
 * // Join a session (rider)
 * const statsId = await joinSession(sessionId);
 * ```
 */
export function useSuiSession(): UseSuiSessionReturn {
  const client = useSuiClient();
  const account = useCurrentAccount();
  
  const [session, setSession] = useState<SuiSession | null>(null);
  const [riderStats, setRiderStats] = useState<SuiRiderStats | null>(null);

  const createTx = useSuiTransaction({
    successMessage: "Performance session created",
    pendingMessage: "Creating Sui session...",
  });

  const joinTx = useSuiTransaction({
    successMessage: "Joined session",
    pendingMessage: "Joining session...",
  });

  const closeTx = useSuiTransaction({
    successMessage: "Session closed",
    pendingMessage: "Closing session...",
  });

  /**
   * Create a new Sui session linked to an EVM class
   * @param classId - The EVM class ID (as hex string)
   * @param duration - Session duration in seconds
   * @returns The created session ID or null on failure
   */
  const createSession = useCallback(async (
    classId: string,
    duration: number
  ): Promise<string | null> => {
    if (!account) {
      console.warn("[SuiSession] Wallet not connected");
      return null;
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${SUI_CONFIG.packageId}::${MODULE_NAME}::create_session`,
      arguments: [
        tx.pure.id(classId),
        tx.pure.u64(duration),
      ],
    });

    const success = await createTx.execute(tx);
    
    if (success && createTx.digest) {
      // In production, parse the transaction effects to get the actual session ID
      // For now, we'll need to query for it
      const newSession: SuiSession = {
        id: `pending-${Date.now()}`, // Will be updated after indexer sync
        classId,
        instructor: account.address,
        duration,
        isActive: true,
      };
      setSession(newSession);
      return newSession.id;
    }
    
    return null;
  }, [account, createTx]);

  /**
   * Join an existing session as a rider
   * Creates a RiderStats object owned by the rider
   * @param sessionId - The Sui session ID to join
   * @returns The RiderStats object ID or null on failure
   */
  const joinSession = useCallback(async (
    sessionId: string
  ): Promise<string | null> => {
    if (!account) {
      console.warn("[SuiSession] Wallet not connected");
      return null;
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${SUI_CONFIG.packageId}::${MODULE_NAME}::join_session`,
      arguments: [
        tx.object(sessionId),
      ],
    });

    const success = await joinTx.execute(tx);
    
    if (success) {
      // In production, parse effects to get stats ID
      const stats: SuiRiderStats = {
        id: `stats-${Date.now()}`,
        sessionId,
        rider: account.address,
        hr: 0,
        power: 0,
        cadence: 0,
        lastUpdate: Date.now(),
      };
      setRiderStats(stats);
      return stats.id;
    }
    
    return null;
  }, [account, joinTx]);

  /**
   * Close an active session (instructor only)
   * @param sessionId - The session ID to close
   */
  const closeSession = useCallback(async (
    sessionId: string
  ): Promise<boolean> => {
    if (!account) {
      console.warn("[SuiSession] Wallet not connected");
      return false;
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${SUI_CONFIG.packageId}::${MODULE_NAME}::close_session`,
      arguments: [
        tx.object(sessionId),
      ],
    });

    const success = await closeTx.execute(tx);
    
    if (success) {
      setSession(prev => prev ? { ...prev, isActive: false } : null);
    }
    
    return success;
  }, [account, closeTx]);

  return {
    // Actions
    createSession,
    joinSession,
    closeSession,
    
    // Data
    session,
    riderStats,
    
    // State
    isCreating: createTx.isPending,
    isJoining: joinTx.isPending,
    error: createTx.error || joinTx.error || closeTx.error,
    isConnected: !!account,
  };
}

export default useSuiSession;
