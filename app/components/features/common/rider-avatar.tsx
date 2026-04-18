"use client";

import { useState, useEffect, useMemo } from "react";
import {
  generateAvatarGradient,
  getAvatarProfile,
  type AvatarProfile,
  type FitnessLevel,
} from "@/app/lib/avatar-service";
import { formatAddress } from "@/app/lib/profile-service";

interface RiderAvatarProps {
  address: string;
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
  showLevel?: boolean;
  className?: string;
}

const SIZE = {
  sm: "w-8 h-8 text-[10px]",
  md: "w-12 h-12 text-sm",
  lg: "w-20 h-20 text-lg",
} as const;

const RING: Record<FitnessLevel, string> = {
  beginner: "ring-amber-700/60",
  intermediate: "ring-gray-300/60",
  advanced: "ring-yellow-400/70",
  elite: "ring-cyan-300/80",
};

const LEVEL_LABEL: Record<FitnessLevel, string> = {
  beginner: "Bronze",
  intermediate: "Silver",
  advanced: "Gold",
  elite: "Platinum",
};

export function RiderAvatar({
  address,
  size = "md",
  showBadge = false,
  showLevel = false,
  className = "",
}: RiderAvatarProps) {
  const [profile, setProfile] = useState<AvatarProfile | null>(null);

  // Synchronous gradient so we never flash empty
  const gradient = useMemo(() => generateAvatarGradient(address), [address]);

  useEffect(() => {
    let cancelled = false;
    getAvatarProfile(address).then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => { cancelled = true; };
  }, [address]);

  const initials = (profile?.displayName ?? formatAddress(address))
    .replace(/\.eth$/, "")
    .slice(0, 2)
    .toUpperCase();

  const level = profile?.fitnessLevel ?? "beginner";

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <div
        className={`${SIZE[size]} rounded-full ring-2 ${RING[level]} overflow-hidden flex items-center justify-center font-bold text-white`}
        style={{
          background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
        }}
      >
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {showBadge && profile && profile.badgeCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[8px] font-bold text-white ring-1 ring-black">
          {profile.badgeCount}
        </span>
      )}

      {showLevel && (
        <span className="mt-1 text-[8px] font-bold uppercase tracking-widest text-white/40">
          {LEVEL_LABEL[level]}
        </span>
      )}
    </div>
  );
}
