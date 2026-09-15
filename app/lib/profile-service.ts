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
  platform: "ens" | "farcaster" | "lens" | "basenames" | string;
  displayName: string;
  avatar: string | null;
  description: string | null;
  links?: Record<string, { link: string; handle: string }>;
}

/** Current ENSData API shape (flat fields; legacy `records` still accepted). */
interface ENSDataResponse {
  address: string;
  ens: string | null;
  ens_primary?: string | null;
  avatar?: string | null;
  avatar_url?: string | null;
  avatar_small?: string | null;
  description?: string | null;
  url?: string | null;
  twitter?: string | null;
  github?: string | null;
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

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/** Prefer named identities over bare wallet stubs. */
const PLATFORM_PRIORITY = [
  "ens",
  "basenames",
  "farcaster",
  "lens",
  "linea",
  "sns",
] as const;

// Provider configuration (public endpoints; no API keys required)
const PROVIDERS = {
  web3bio: {
    name: "Web3.bio",
    url: (address: string) => `https://api.web3.bio/profile/${address}`,
    enabled: true,
  },
  ensdata: {
    name: "ENSData.net",
    // Canonical host — ensdata.net 301s here
    url: (address: string) => `https://api.ensdata.net/${address}`,
    enabled: true,
  },
};

function isHexAddress(value: string | null | undefined): boolean {
  return !!value && ADDRESS_RE.test(value);
}

/**
 * Web3.bio returns a platform:"ethereum" stub (identity = address) when there
 * is no named profile. Treat those as unresolved so ENSData can run.
 */
export function isMeaningfulProfile(profile: Profile | null | undefined): boolean {
  if (!profile?.identity) return false;
  if (profile.platform === "ethereum" || profile.platform === "wallet") {
    return false;
  }
  if (isHexAddress(profile.identity)) return false;
  return true;
}

function pickWeb3BioProfile(profiles: Profile[]): Profile | null {
  const named = profiles.filter(isMeaningfulProfile);
  if (named.length === 0) return null;

  for (const platform of PLATFORM_PRIORITY) {
    const match = named.find((p) => p.platform === platform);
    if (match) return match;
  }

  return named[0] ?? null;
}

/**
 * Resolve address using Web3.bio (primary provider)
 */
async function resolveWeb3Bio(address: string): Promise<Profile | null> {
  const response = await fetch(PROVIDERS.web3bio.url(address));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const profiles: Profile[] = await response.json();
  if (!Array.isArray(profiles) || profiles.length === 0) return null;

  const profile = pickWeb3BioProfile(profiles);
  if (!profile) return null;

  return {
    ...profile,
    address: profile.address || address,
  };
}

function ensDataField(
  data: ENSDataResponse,
  key: "avatar" | "description" | "url" | "twitter" | "github",
): string | null {
  const flat = data[key];
  if (typeof flat === "string" && flat.length > 0) return flat;
  const nested = data.records?.[key];
  if (typeof nested === "string" && nested.length > 0) return nested;
  return null;
}

/**
 * Resolve address using ENSData.net (fallback provider)
 * Converts ENSData format to unified Profile format
 */
async function resolveENSData(address: string): Promise<Profile | null> {
  const response = await fetch(PROVIDERS.ensdata.url(address));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data: ENSDataResponse = await response.json();
  const ens = data.ens || data.ens_primary || null;
  if (!ens) return null;

  const avatar =
    data.avatar_url ||
    ensDataField(data, "avatar") ||
    data.avatar_small ||
    null;

  const description = ensDataField(data, "description");
  const url = ensDataField(data, "url");
  const twitter = ensDataField(data, "twitter");
  const github = ensDataField(data, "github");

  const profile: Profile = {
    address: data.address || address,
    identity: ens,
    platform: "ens",
    displayName: ens,
    avatar,
    description,
    links: {},
  };

  if (url) {
    profile.links!.website = { link: url, handle: url };
  }
  if (twitter) {
    const handle = twitter.replace(/^@/, "");
    profile.links!.twitter = {
      link: `https://twitter.com/${handle}`,
      handle,
    };
  }
  if (github) {
    profile.links!.github = {
      link: `https://github.com/${github}`,
      handle: github,
    };
  }

  if (data.farcaster?.username) {
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
  if (!address?.trim()) return null;

  const normalized = address.toLowerCase();

  const cached = cache.get(normalized);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  let lastError: Error | null = null;

  if (PROVIDERS.web3bio.enabled) {
    try {
      const profile = await resolveWeb3Bio(normalized);
      if (profile) {
        cache.set(normalized, { data: profile, timestamp: Date.now() });
        return profile;
      }
    } catch (error) {
      console.warn("Web3.bio resolution failed:", error);
      lastError = error instanceof Error ? error : new Error("Web3.bio failed");
    }
  }

  if (PROVIDERS.ensdata.enabled) {
    try {
      const profile = await resolveENSData(normalized);
      if (profile) {
        cache.set(normalized, { data: profile, timestamp: Date.now() });
        return profile;
      }
    } catch (error) {
      console.warn("ENSData.net resolution failed:", error);
      lastError =
        error instanceof Error ? error : new Error("ENSData.net failed");
    }
  }

  cache.set(normalized, { data: null, timestamp: Date.now() });

  if (lastError) {
    console.warn("All profile providers failed:", lastError.message);
  }

  return null;
}

/**
 * Batch resolve multiple addresses efficiently
 */
export async function resolveProfiles(
  addresses: string[],
): Promise<Map<string, Profile | null>> {
  const results = new Map<string, Profile | null>();
  const toFetch: string[] = [];

  for (const addr of addresses) {
    const normalized = addr.toLowerCase();
    const cached = cache.get(normalized);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      results.set(normalized, cached.data);
    } else {
      toFetch.push(normalized);
    }
  }

  if (toFetch.length > 0) {
    await Promise.all(
      toFetch.map((addr) =>
        resolveProfile(addr).then((profile) => {
          results.set(addr, profile);
        }),
      ),
    );
  }

  return results;
}

/** Clear in-memory cache (tests / forced refresh). */
export function clearProfileCache(): void {
  cache.clear();
}

/**
 * Format address for display (0x1234...5678)
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get display name for address (ENS / named identity > formatted address)
 */
export function getDisplayName(profile: Profile | null, address: string): string {
  if (isMeaningfulProfile(profile)) {
    return profile!.displayName || profile!.identity;
  }
  return formatAddress(address);
}

/**
 * Get avatar URL with fallback
 */
export function getAvatarUrl(profile: Profile | null, fallback?: string): string {
  return profile?.avatar || fallback || "/default-avatar.png";
}

/**
 * Get direct avatar URL from ENSData.net (optimized endpoint)
 * Use this for simple avatar display without full profile resolution
 */
export function getENSDataAvatarUrl(addressOrEns: string): string {
  return `https://api.ensdata.net/media/avatar/${addressOrEns}`;
}

/**
 * Get direct content hash from ENSData.net
 */
export function getENSDataContentHash(ensName: string): string {
  return `https://api.ensdata.net/content-hash/${ensName}`;
}
