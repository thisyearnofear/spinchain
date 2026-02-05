/**
 * Profile Service - Universal identity resolution with multi-provider fallback
 * 
 * Primary: Web3.bio (ENS + universal profiles)
 * Fallback: ENSData.net (ENS only, no API key needed)
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Extends address display without contract changes
 * - DRY: Single source of truth for profile resolution
 * - PERFORMANT: 5-minute cache prevents redundant API calls
 * - MODULAR: Swappable providers with consistent interface
 */

export interface Profile {
  address: string;
  identity: string;
  platform: 'ens' | 'farcaster' | 'lens' | 'basenames' | string;
  displayName: string;
  avatar: string | null;
  description: string | null;
  links?: Record<string, { link: string; handle: string }>;
}

// ENSData.net response shape
interface ENSDataResponse {
  address: string;
  ens: string | null;
  records?: {
    avatar?: string;
    description?: string;
    url?: string;
    twitter?: string;
    github?: string;
    [key: string]: string | undefined;
  };
  farcaster?: {
    username: string;
    fid: number;
  };
}

interface CacheEntry {
  data: Profile | null;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

// Provider configuration
const PROVIDERS = {
  web3bio: {
    name: 'Web3.bio',
    url: (address: string) => `https://api.web3.bio/profile/${address}`,
    enabled: true,
  },
  ensdata: {
    name: 'ENSData.net',
    url: (address: string) => `https://ensdata.net/${address}`,
    enabled: true,
  },
};

/**
 * Resolve address using Web3.bio (primary provider)
 */
async function resolveWeb3Bio(address: string): Promise<Profile | null> {
  const response = await fetch(PROVIDERS.web3bio.url(address));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const profiles: Profile[] = await response.json();
  
  // Prefer ENS, then first available
  const profile = profiles.find(p => p.platform === 'ens') || profiles[0] || null;
  
  if (profile) {
    // Normalize to ensure address is set
    profile.address = address;
  }
  
  return profile;
}

/**
 * Resolve address using ENSData.net (fallback provider)
 * Converts ENSData format to unified Profile format
 */
async function resolveENSData(address: string): Promise<Profile | null> {
  const response = await fetch(PROVIDERS.ensdata.url(address));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const data: ENSDataResponse = await response.json();
  
  if (!data.ens) return null;
  
  // Convert ENSData format to unified Profile format
  const profile: Profile = {
    address: data.address,
    identity: data.ens,
    platform: 'ens',
    displayName: data.ens,
    avatar: data.records?.avatar || null,
    description: data.records?.description || null,
    links: {},
  };
  
  // Build links from records
  if (data.records) {
    if (data.records.url) {
      profile.links!.website = { link: data.records.url, handle: data.records.url };
    }
    if (data.records.twitter) {
      profile.links!.twitter = { 
        link: `https://twitter.com/${data.records.twitter}`, 
        handle: data.records.twitter 
      };
    }
    if (data.records.github) {
      profile.links!.github = { 
        link: `https://github.com/${data.records.github}`, 
        handle: data.records.github 
      };
    }
  }
  
  // Add Farcaster if available
  if (data.farcaster) {
    profile.links!.farcaster = {
      link: `https://warpcast.com/${data.farcaster.username}`,
      handle: data.farcaster.username,
    };
  }
  
  return profile;
}

/**
 * Resolve address to universal profile with automatic fallback
 * Tries Web3.bio first, falls back to ENSData.net
 */
export async function resolveProfile(address: string): Promise<Profile | null> {
  const normalized = address.toLowerCase();
  
  // Check cache
  const cached = cache.get(normalized);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  let lastError: Error | null = null;

  // Try primary provider (Web3.bio)
  if (PROVIDERS.web3bio.enabled) {
    try {
      const profile = await resolveWeb3Bio(normalized);
      if (profile) {
        cache.set(normalized, { data: profile, timestamp: Date.now() });
        return profile;
      }
    } catch (error) {
      console.warn('Web3.bio resolution failed:', error);
      lastError = error instanceof Error ? error : new Error('Web3.bio failed');
    }
  }

  // Fallback to ENSData.net
  if (PROVIDERS.ensdata.enabled) {
    try {
      const profile = await resolveENSData(normalized);
      if (profile) {
        cache.set(normalized, { data: profile, timestamp: Date.now() });
        return profile;
      }
    } catch (error) {
      console.warn('ENSData.net resolution failed:', error);
      lastError = error instanceof Error ? error : new Error('ENSData.net failed');
    }
  }

  // Cache null result to prevent retry spam
  cache.set(normalized, { data: null, timestamp: Date.now() });
  
  if (lastError) {
    console.warn('All profile providers failed:', lastError.message);
  }
  
  return null;
}

/**
 * Batch resolve multiple addresses efficiently
 */
export async function resolveProfiles(addresses: string[]): Promise<Map<string, Profile | null>> {
  const results = new Map<string, Profile | null>();
  const toFetch: string[] = [];
  
  // Check cache first
  for (const addr of addresses) {
    const normalized = addr.toLowerCase();
    const cached = cache.get(normalized);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      results.set(normalized, cached.data);
    } else {
      toFetch.push(normalized);
    }
  }
  
  // Fetch uncached addresses in parallel
  if (toFetch.length > 0) {
    const fetchPromises = toFetch.map(addr => 
      resolveProfile(addr).then(profile => {
        results.set(addr, profile);
      })
    );
    await Promise.all(fetchPromises);
  }
  
  return results;
}

/**
 * Format address for display (0x1234...5678)
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get display name for address (ENS > formatted address)
 */
export function getDisplayName(profile: Profile | null, address: string): string {
  if (profile?.identity) return profile.identity;
  return formatAddress(address);
}

/**
 * Get avatar URL with fallback
 */
export function getAvatarUrl(profile: Profile | null, fallback?: string): string {
  return profile?.avatar || fallback || '/default-avatar.png';
}

/**
 * Get direct avatar URL from ENSData.net (optimized endpoint)
 * Use this for simple avatar display without full profile resolution
 */
export function getENSDataAvatarUrl(addressOrEns: string): string {
  return `https://ensdata.net/media/avatar/${addressOrEns}`;
}

/**
 * Get direct content hash from ENSData.net
 */
export function getENSDataContentHash(ensName: string): string {
  return `https://ensdata.net/content-hash/${ensName}`;
}
