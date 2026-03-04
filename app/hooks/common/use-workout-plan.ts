"use client";

/**
 * useWorkoutPlan - Select, build, and persist workout plans to Walrus
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Builds on existing WorkoutPlan types and WalrusClient
 * - MODULAR: Composable on top of single-ride infrastructure
 * - DRY: Reuses createWorkoutPlan, computeTotalDuration from workout-plan.ts
 */

import { useState, useCallback } from 'react';
import {
  WorkoutPlan,
  WorkoutInterval,
  WorkoutDifficulty,
  PRESET_WORKOUTS,
  createWorkoutPlan,
  getPresetWorkout,
} from '@/app/lib/workout-plan';
import { getWalrusClient } from '@/app/lib/walrus/client';

export interface UseWorkoutPlanReturn {
  // Current plan
  plan: WorkoutPlan | null;
  // Preset library
  presets: WorkoutPlan[];
  // Actions
  selectPreset: (id: string) => void;
  buildCustomPlan: (
    name: string,
    intervals: WorkoutInterval[],
    difficulty: WorkoutDifficulty,
    tags?: string[],
  ) => WorkoutPlan;
  savePlanToWalrus: (plan: WorkoutPlan) => Promise<string | null>;
  loadPlanFromWalrus: (blobId: string) => Promise<WorkoutPlan | null>;
  clearPlan: () => void;
  // Persistence state
  isSaving: boolean;
  isLoading: boolean;
  walrusBlobId: string | null;
  error: Error | null;
}

export function useWorkoutPlan(initialPlanId?: string): UseWorkoutPlanReturn {
  const [plan, setPlan] = useState<WorkoutPlan | null>(
    initialPlanId ? (getPresetWorkout(initialPlanId) ?? null) : null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [walrusBlobId, setWalrusBlobId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const selectPreset = useCallback((id: string) => {
    const preset = getPresetWorkout(id);
    if (preset) {
      setPlan(preset);
      setWalrusBlobId(null);
      setError(null);
    }
  }, []);

  const buildCustomPlan = useCallback((
    name: string,
    intervals: WorkoutInterval[],
    difficulty: WorkoutDifficulty,
    tags: string[] = [],
  ): WorkoutPlan => {
    const id = `custom-${Date.now()}`;
    const newPlan = createWorkoutPlan(id, name, intervals, difficulty, tags);
    setPlan(newPlan);
    setWalrusBlobId(null);
    setError(null);
    return newPlan;
  }, []);

  const savePlanToWalrus = useCallback(async (planToSave: WorkoutPlan): Promise<string | null> => {
    setIsSaving(true);
    setError(null);
    try {
      const client = getWalrusClient();
      const result = await client.storeJSON(planToSave);
      const blobId = result.success ? result.blobId ?? null : null;
      setWalrusBlobId(blobId);
      return blobId;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Walrus save failed');
      setError(e);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const loadPlanFromWalrus = useCallback(async (blobId: string): Promise<WorkoutPlan | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const client = getWalrusClient();
      const result = await client.retrieveJSON<WorkoutPlan>(blobId);
      if (!result.success) throw new Error('Walrus retrieve failed');
      const loaded: WorkoutPlan = (result as { success: true; data: WorkoutPlan }).data;
      setPlan(loaded);
      setWalrusBlobId(blobId);
      return loaded;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Walrus load failed');
      setError(e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearPlan = useCallback(() => {
    setPlan(null);
    setWalrusBlobId(null);
    setError(null);
  }, []);

  return {
    plan,
    presets: PRESET_WORKOUTS,
    selectPreset,
    buildCustomPlan,
    savePlanToWalrus,
    loadPlanFromWalrus,
    clearPlan,
    isSaving,
    isLoading,
    walrusBlobId,
    error,
  };
}
