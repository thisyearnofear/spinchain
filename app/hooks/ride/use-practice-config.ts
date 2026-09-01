"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  createPracticeClassMetadata,
  generateRouteData,
  GUEST_DEMO_CLASS,
  type ClassWithRoute,
} from "../evm/use-class-data";

export interface PracticeClassConfig {
  name: string;
  date: string;
  capacity: number;
  basePrice: number;
  maxPrice: number;
  curveType: "linear" | "exponential";
  rewardThreshold: number;
  rewardAmount: number;
  aiEnabled?: boolean;
  aiPersonality?: "zen" | "drill-sergeant" | "data";
  routeName: string;
  routeDistance: number;
  routeDuration: number;
  routeElevation: number;
  instructor: string;
}

export function usePracticeConfig(classId: string) {
  const searchParams = useSearchParams();
  // /rider/ride/demo is a first-class practice URL — no ?mode= param needed.
  const isGuestDemo = classId === "demo";
  const isPracticeMode = isGuestDemo || searchParams.get("mode") === "practice";

  const practiceConfig: PracticeClassConfig | null = useMemo(() => {
    if (!isPracticeMode) return null;
    const name = searchParams.get("name");
    const date = searchParams.get("date");
    const instructor = searchParams.get("instructor");

    // Guest demo fallback: /rider/ride/demo with no query params uses the
    // canonical guest demo class. Custom demos still pass explicit params.
    if (isGuestDemo && (!name || !date || !instructor)) {
      return {
        name: name || GUEST_DEMO_CLASS.name,
        date: date || new Date().toISOString(),
        capacity: Number(searchParams.get("capacity")) || GUEST_DEMO_CLASS.maxRiders,
        basePrice: Number(searchParams.get("basePrice")) || 0,
        maxPrice: Number(searchParams.get("maxPrice")) || 0,
        curveType: "linear" as const,
        rewardThreshold: Number(searchParams.get("rewardThreshold")) || 150,
        rewardAmount: Number(searchParams.get("rewardAmount")) || 10,
        aiEnabled: searchParams.get("aiEnabled") !== "false",
        aiPersonality:
          (searchParams.get("aiPersonality") as
            | "zen"
            | "drill-sergeant"
            | "data") || "zen",
        routeName: searchParams.get("routeName") || GUEST_DEMO_CLASS.name,
        routeDistance: Number(searchParams.get("routeDistance")) || 15,
        routeDuration:
          Number(searchParams.get("routeDuration")) || GUEST_DEMO_CLASS.duration,
        routeElevation:
          Number(searchParams.get("routeElevation")) || GUEST_DEMO_CLASS.elevationGain,
        instructor: instructor || GUEST_DEMO_CLASS.instructor,
      };
    }

    if (!name || !date || !instructor) return null;

    return {
      name,
      date,
      capacity: Number(searchParams.get("capacity")) || 50,
      basePrice: Number(searchParams.get("basePrice")) || 0.02,
      maxPrice: Number(searchParams.get("maxPrice")) || 0.08,
      curveType:
        (searchParams.get("curveType") as "linear" | "exponential") || "linear",
      rewardThreshold: Number(searchParams.get("rewardThreshold")) || 150,
      rewardAmount: Number(searchParams.get("rewardAmount")) || 20,
      aiEnabled: searchParams.get("aiEnabled") === "true",
      aiPersonality:
        (searchParams.get("aiPersonality") as
          | "zen"
          | "drill-sergeant"
          | "data") || undefined,
      routeName: searchParams.get("routeName") || "Practice Route",
      routeDistance: Number(searchParams.get("routeDistance")) || 20,
      routeDuration: Number(searchParams.get("routeDuration")) || 45,
      routeElevation: Number(searchParams.get("routeElevation")) || 300,
      instructor,
    };
  }, [isPracticeMode, searchParams]);

  const practiceClassData: ClassWithRoute | null = useMemo(() => {
    if (!practiceConfig) return null;

    const metadata = createPracticeClassMetadata(
      {
        name: practiceConfig.name,
        date: practiceConfig.date,
        capacity: practiceConfig.capacity,
        basePrice: practiceConfig.basePrice,
        maxPrice: practiceConfig.maxPrice,
        curveType: practiceConfig.curveType,
        rewardThreshold: practiceConfig.rewardThreshold,
        rewardAmount: practiceConfig.rewardAmount,
        suiPerformance: true,
        aiEnabled: practiceConfig.aiEnabled,
        aiPersonality: practiceConfig.aiPersonality,
      },
      {
        name: practiceConfig.routeName,
        distance: practiceConfig.routeDistance,
        duration: practiceConfig.routeDuration,
        elevationGain: practiceConfig.routeElevation,
        theme: "neon",
        storyBeatsCount: 4,
      },
      practiceConfig.instructor,
    );

    const route = generateRouteData(metadata);

    return {
      address: classId as `0x${string}`,
      name: metadata.name,
      instructor: metadata.instructor,
      startTime: metadata.startTime,
      endTime: metadata.endTime,
      maxRiders: practiceConfig.capacity,
      ticketsSold: 0,
      currentPrice: practiceConfig.basePrice.toString(),
      metadata,
      route,
      routeLoading: false,
      routeError: null,
      routeIsGenerated: true,
    };
  }, [practiceConfig, classId]);

  return { isPracticeMode, practiceConfig, practiceClassData };
}