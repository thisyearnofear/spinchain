import { getRideHistory, getBadges } from "./analytics/ride-history";
import { resolveProfile, getDisplayName } from "./profile-service";

export type FitnessLevel = "beginner" | "intermediate" | "advanced" | "elite";

export interface AvatarStyle {
  from: string;
  to: string;
}

export interface AvatarProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  avatarStyle: AvatarStyle;
  fitnessLevel: FitnessLevel;
  badgeCount: number;
  totalRides: number;
  preferredTheme: string;
}

/**
 * Deterministically generate a two-color gradient from a hex address or guest ID.
 * Uses simple hash slices so the same input always yields the same colors.
 */
export function generateAvatarGradient(address: string): AvatarStyle {
  const hex = address.replace(/^0x/i, "").padEnd(12, "a");
  const hue1 = parseInt(hex.slice(0, 4), 16) % 360;
  const hue2 = (hue1 + 40 + (parseInt(hex.slice(4, 8), 16) % 120)) % 360;
  return {
    from: `hsl(${hue1}, 70%, 55%)`,
    to: `hsl(${hue2}, 60%, 45%)`,
  };
}

export function getFitnessLevel(totalRides: number, avgEffort: number): FitnessLevel {
  if (totalRides >= 50 && avgEffort >= 750) return "elite";
  if (totalRides >= 20 && avgEffort >= 600) return "advanced";
  if (totalRides >= 5 && avgEffort >= 400) return "intermediate";
  return "beginner";
}

export async function getAvatarProfile(address: string): Promise<AvatarProfile> {
  const [profile, rides] = await Promise.all([
    resolveProfile(address).catch(() => null),
    Promise.resolve(getRideHistory().filter((r) => r.riderId.toLowerCase() === address.toLowerCase())),
  ]);

  const totalRides = rides.length;
  const avgEffort = totalRides > 0
    ? Math.round(rides.reduce((s, r) => s + r.avgEffort, 0) / totalRides)
    : 0;

  // Count unique badges across all rides
  const allBadges = new Set(rides.flatMap((r) => getBadges([r])));

  // Most-used theme from class names is not stored; default to "neon"
  const preferredTheme = "neon";

  return {
    id: address,
    displayName: getDisplayName(profile, address),
    avatarUrl: profile?.avatar ?? null,
    avatarStyle: generateAvatarGradient(address),
    fitnessLevel: getFitnessLevel(totalRides, avgEffort),
    badgeCount: allBadges.size,
    totalRides,
    preferredTheme,
  };
}
