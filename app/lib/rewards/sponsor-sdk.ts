/**
 * SpinChain Sponsor SDK (Phase 4 Placeholder)
 * 
 * "Bringing Wellness Brands into the State Channel"
 * 
 * This SDK allows brands like Nike, AG1, and Lululemon to sponsor
 * specific 'Story Beats' in a ride. Rewards are streamed via Yellow
 * Network state channels directly to riders who meet the biometric criteria.
 */

import { parseReward } from "./calculator";
import type { TelemetryPoint } from "../zk/oracle";

export interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
  vaultAddress: `0x${string}`;
}

export interface SponsoredBeat {
  id: string;
  sponsor: Sponsor;
  targetBpm: number;
  rewardPerMinute: bigint;
  message: string;
}

/**
 * MOCK SPONSORS FOR ACCELERATOR DEMO
 */
export const DEMO_SPONSORS: Sponsor[] = [
  {
    id: "nike",
    name: "Nike",
    logoUrl: "/images/sponsors/nike.svg",
    vaultAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  },
  {
    id: "ag1",
    name: "AG1",
    logoUrl: "/images/sponsors/ag1.svg",
    vaultAddress: "0x123d35Cc6634C0532925a3b844Bc454e4438f44e",
  }
];

/**
 * Check if the current telemetry qualifies for a sponsored reward boost
 */
export function checkSponsorEligibility(
  telemetry: TelemetryPoint,
  activeBeat: SponsoredBeat
): boolean {
  // Logic: Heart rate must be above the sponsor's target for >10 seconds
  return telemetry.heartRate >= activeBeat.targetBpm;
}

/**
 * Calculate the additional 'Sponsor Yield' to be added to the Yellow stream
 */
export function calculateSponsorYield(
  isEligible: boolean,
  beat: SponsoredBeat
): bigint {
  if (!isEligible) return BigInt(0);
  
  // Return the per-interval slice of the rewardPerMinute
  // Assumes 10-second intervals (Yellow default)
  return beat.rewardPerMinute / BigInt(6);
}

/**
 * Placeholder for Phase 4: Settle Sponsor Yield
 * This will trigger a secondary 'Top-up' on the Yellow state channel
 */
export async function settleSponsorYield(
  channelId: string,
  yieldAmount: bigint
): Promise<void> {
  console.log(`[SponsorSDK] Queueing yield of ${yieldAmount} SPIN for channel ${channelId}`);
  // In Phase 4, this interacts with the SponsorVault.sol on Avalanche
}
