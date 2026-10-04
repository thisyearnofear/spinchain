import { ACTIVE_NETWORK } from "@/app/lib/contracts";

export function isLegacyRewardClaimsEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_LEGACY_REWARD_CLAIMS === "true" &&
    ACTIVE_NETWORK.id === 43113
  );
}
