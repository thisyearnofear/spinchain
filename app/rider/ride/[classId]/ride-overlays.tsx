"use client";

/**
 * RideOverlays — social feed, coach messages, settlement stream.
 * Subscribes to ride store for isRiding, rewardMode.
 */

import { useRideStore } from "@/app/stores/ride-store";
import { RiderSocialFeed } from "@/app/components/features/ride/social-feed";
import { CoachMessageOverlay } from "@/app/components/features/ride/coach-message-overlay";
import { SettlementStream } from "@/app/components/features/ride/settlement-stream";
import type { IntervalPhase } from "@/app/lib/workout-plan";

interface RideOverlaysProps {
  consolidatedCoachMessage: string | null;
  currentInterval: { phase: IntervalPhase } | null;
  socialEvents: Array<{
    id: string;
    type: "recommendation" | "nudge" | "highfive" | "shoutout";
    message: string;
    timestamp: number;
    from?: string;
  }>;
  handleHighFive: (riderId: string) => void;
  rewards: {
    mode: string;
    isActive: boolean;
    accumulatedReward: bigint;
    streamingRate?: bigint;
  };
}

export function RideOverlays({
  consolidatedCoachMessage,
  currentInterval,
  socialEvents,
  handleHighFive,
  rewards,
}: RideOverlaysProps) {
  const isRiding = useRideStore((s) => s.isRiding);

  return (
    <>
      <RiderSocialFeed events={socialEvents} onHighFive={handleHighFive} />

      <SettlementStream
        isActive={
          isRiding && rewards.mode === "yellow-stream" && rewards.isActive
        }
        accumulated={Number(rewards.accumulatedReward)}
        rate={rewards.streamingRate ? Number(rewards.streamingRate) : 0}
      />

      <CoachMessageOverlay
        message={isRiding ? consolidatedCoachMessage : null}
        phase={currentInterval?.phase}
      />

      {/* Sprint flash border */}
      {isRiding && currentInterval?.phase === "sprint" && (
        <div className="absolute inset-0 pointer-events-none rounded-none border-4 border-red-500/60 animate-pulse" />
      )}
    </>
  );
}
