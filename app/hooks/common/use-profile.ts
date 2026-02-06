"use client";

/**
 * useProfile Hook - React hook for universal profile resolution
 * 
 * Features:
 * - Automatic profile resolution on mount
 * - 5-minute stale-while-revalidate caching
 * - Loading and error states
 * 
 * Core Principles:
 * - MODULAR: Self-contained, composable
 * - PERFORMANT: Caching prevents redundant fetches
 * - CLEAN: Clear separation between service and UI
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  resolveProfile, 
  resolveProfiles,
  Profile, 
  formatAddress,
  getDisplayName,
  getAvatarUrl,
  getENSDataAvatarUrl,
  getENSDataContentHash
} from '@/app/lib/profile-service';

interface UseProfileReturn {
  profile: Profile | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseProfilesReturn {
  profiles: Map<string, Profile | null>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for resolving a single address to profile
 */
export function useProfile(address: string | undefined): UseProfileReturn {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!address) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await resolveProfile(address);
      setProfile(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to resolve profile'));
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    refetch: fetchProfile
  };
}

/**
 * Hook for batch resolving multiple addresses
 */
export function useProfiles(addresses: string[]): UseProfilesReturn {
  const [profiles, setProfiles] = useState<Map<string, Profile | null>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (addresses.length === 0) return;

    const fetchProfiles = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const results = await resolveProfiles(addresses);
        setProfiles(results);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to resolve profiles'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfiles();
  }, [addresses.join(',')]); // Re-fetch when addresses change

  return {
    profiles,
    isLoading,
    error
  };
}

// Re-export utility functions for convenience
export { 
  formatAddress, 
  getDisplayName, 
  getAvatarUrl, 
  getENSDataAvatarUrl,
  getENSDataContentHash 
};
export type { Profile };
