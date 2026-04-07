/**
 * Class Data Hook
 * Fetches class information including route metadata from contracts
 * Integrates with Walrus to load complete route data
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { usePublicClient, useReadContract } from "wagmi";
import { CLASS_FACTORY_ABI, CLASS_FACTORY_ADDRESS, SPIN_CLASS_ABI } from "@/app/lib/contracts";
import { parseClassMetadata, type EnhancedClassMetadata } from "@/app/lib/contracts";
import { retrieveRouteFromWalrus, getCachedRoute, cacheRouteLocally, type WalrusRouteData } from "@/app/lib/route-storage";
import type { StoryBeat, StoryBeatType } from "@/app/routes/builder/gpx-uploader";
import type { PublicClient } from "viem";

const ENABLE_DEMO_CLASS_CATALOG = process.env.NEXT_PUBLIC_ENABLE_DEMO_CLASS_CATALOG === "true";

/**
 * Demo class catalog used only when explicitly enabled.
 */
const MOCK_CLASSES = [
  {
    address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
    name: "Morning Mountain Climb",
    instructor: "Coach Atlas",
    startTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    ticketsSold: 23,
    maxRiders: 50,
    currentPrice: "0.025",
  },
  {
    address: "0x2345678901234567890123456789012345678901" as `0x${string}`,
    name: "Sunset Coastal Sprint",
    instructor: "Coach Sarah",
    startTime: Math.floor(Date.now() / 1000) + 7200, // 2 hours from now
    ticketsSold: 42,
    maxRiders: 50,
    currentPrice: "0.048",
  },
  {
    address: "0x3456789012345678901234567890123456789012" as `0x${string}`,
    name: "Neon City Intervals",
    instructor: "Coach Nova",
    startTime: Math.floor(Date.now() / 1000) + 86400, // Tomorrow
    ticketsSold: 15,
    maxRiders: 40,
    currentPrice: "0.018",
  },
];

/**
 * Guest Demo Class
 * Free to try without wallet connection
 */
export const GUEST_DEMO_CLASS = {
  address: "0xGUEST0000000000000000000000000000000000" as `0x${string}`,
  name: "Alpine Challenge (Demo)",
  instructor: "Coach Demo",
  startTime: Math.floor(Date.now() / 1000) + 1800, // 30 min from now
  ticketsSold: Math.floor(Math.random() * 5) + 3, // Real-time variability
  maxRiders: 20,
  currentPrice: "0",
  isGuestMode: true,
  description: "Try SpinChain without connecting a wallet. Experience the full workout with real-time rewards!",
  difficulty: "moderate",
  duration: 30,
  elevationGain: 450,
  theme: "alpine" as const,
};

/**
 * Generates practice mode URL for demo ride
 * Single source of truth for demo ride links (DRY principle)
 */
export function getDemoRideUrl(): string {
  const params = new URLSearchParams({
    mode: "practice",
    name: GUEST_DEMO_CLASS.name,
    date: new Date().toISOString(),
    instructor: GUEST_DEMO_CLASS.instructor,
    capacity: "20",
    basePrice: "0",
    maxPrice: "0",
    curveType: "linear",
    rewardThreshold: "150",
    rewardAmount: "10",
    aiEnabled: "true",
    aiPersonality: "zen",
    routeName: GUEST_DEMO_CLASS.name,
    routeDistance: "15",
    routeDuration: GUEST_DEMO_CLASS.duration.toString(),
    routeElevation: GUEST_DEMO_CLASS.elevationGain.toString(),
  });
  return `/rider/ride/demo?${params.toString()}`;
}

export interface ClassWithRoute {
  // Contract data
  address: `0x${string}`;
  name: string;
  instructor: string;
  startTime: number;
  endTime: number;
  maxRiders: number;
  ticketsSold: number;
  currentPrice: string;

  // Metadata
  metadata: EnhancedClassMetadata | null;

  // Route data
  route: WalrusRouteData | null;
  routeLoading: boolean;
  routeError: string | null;
}

function getDeterministicNumber(seed: string, min: number, max: number) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  const normalized = Math.abs(hash % 10_000) / 10_000;
  return min + normalized * (max - min);
}

function inferBeatType(label: string): StoryBeatType {
  const normalized = label.toLowerCase();

  if (normalized.includes("climb")) return "climb";
  if (normalized.includes("sprint") || normalized.includes("push")) return "sprint";
  if (normalized.includes("recover") || normalized.includes("rest")) return "rest";
  if (normalized.includes("drop") || normalized.includes("descen")) return "drop";
  return "scenery";
}

function createFallbackMetadataFromMock(mockClass: typeof MOCK_CLASSES[number]): EnhancedClassMetadata {
  const seed = mockClass.address;
  const themeOptions: EnhancedClassMetadata["route"]["theme"][] = ["neon", "alpine", "mars"];
  const personalityOptions: EnhancedClassMetadata["ai"]["personality"][] = ["zen", "drill-sergeant", "data"];
  const theme = themeOptions[Math.floor(getDeterministicNumber(seed + "theme", 0, themeOptions.length)) % themeOptions.length];
  const personality = personalityOptions[Math.floor(getDeterministicNumber(seed + "personality", 0, personalityOptions.length)) % personalityOptions.length];
  const distance = Number(getDeterministicNumber(seed + "distance", 35, 55).toFixed(1));
  const elevationGain = Math.round(getDeterministicNumber(seed + "elevation", 300, 800));
  const storyBeatLabels = ["Warm-up", "Build", "Climb", "Sprint", "Final Push"].slice(
    0,
    Math.round(getDeterministicNumber(seed + "beats", 3, 5)),
  );

  return {
    version: "2.0",
    name: mockClass.name,
    description: "An immersive cycling experience with AI-powered coaching",
    instructor: mockClass.instructor,
    startTime: mockClass.startTime,
    endTime: mockClass.startTime + 3600,
    duration: 45,
    route: {
      walrusBlobId: `mock-blob-id-${mockClass.address.slice(2, 8)}`,
      name: mockClass.name,
      distance,
      duration: 45,
      elevationGain,
      theme,
      checksum: `mock-checksum-${mockClass.address.slice(2, 8)}`,
      storyBeatsCount: storyBeatLabels.length,
      terrainTags: theme === "alpine" ? ["climb", "mountain"] : theme === "mars" ? ["desert", "rolling"] : ["urban", "tempo"],
      storyBeatLabels,
    },
    ai: {
      enabled: true,
      personality,
      autoTriggerBeats: true,
      adaptiveDifficulty: true,
    },
    pricing: {
      basePrice: "0.02",
      maxPrice: "0.08",
      curveType: "linear",
    },
    rewards: {
      enabled: true,
      threshold: 150,
      amount: 20,
    },
  };
}

function enrichWalrusRouteData(
  routeData: WalrusRouteData,
  metadata: EnhancedClassMetadata,
  classId: string,
): WalrusRouteData {
  return {
    ...routeData,
    route: {
      ...routeData.route,
      description: routeData.route.description || metadata.description,
      terrainTags:
        routeData.route.terrainTags?.length ? routeData.route.terrainTags : metadata.route.terrainTags || ["rolling", "mixed"],
      storyBeats:
        routeData.route.storyBeats.length > 0
          ? routeData.route.storyBeats.map((beat, index) => ({
              ...beat,
              label: metadata.route.storyBeatLabels?.[index] || beat.label,
            }))
          : (metadata.route.storyBeatLabels || []).map((label, index) => ({
              progress: (index + 1) / ((metadata.route.storyBeatLabels?.length || 0) + 1),
              label,
              type: inferBeatType(label),
              intensity: 6,
            })),
    },
    deployment: {
      ...routeData.deployment,
      classId,
      instructor: routeData.deployment.instructor || metadata.instructor,
    },
    checksum: routeData.checksum || metadata.route.checksum,
  };
}

async function resolveRouteForMetadata(
  classId: `0x${string}`,
  metadata: EnhancedClassMetadata,
) {
  const cachedRoute = getCachedRoute(classId);
  if (cachedRoute) {
    return enrichWalrusRouteData(cachedRoute, metadata, classId);
  }

  if (metadata.route.walrusBlobId) {
    try {
      const remoteRoute = await retrieveRouteFromWalrus(metadata.route.walrusBlobId);
      if (remoteRoute) {
        const enrichedRoute = enrichWalrusRouteData(remoteRoute, metadata, classId);
        cacheRouteLocally(classId, enrichedRoute);
        return enrichedRoute;
      }
    } catch (routeError) {
      console.warn("Failed to fetch route from Walrus, using generated fallback:", routeError);
    }
  }

  const generatedRoute = generateMockRouteData(metadata, classId);
  cacheRouteLocally(classId, generatedRoute);
  return generatedRoute;
}

async function hydrateClassFromMetadata(params: {
  classAddress: `0x${string}`;
  metadata: EnhancedClassMetadata;
  startTime: number;
  endTime: number;
  maxRiders: number;
  ticketsSold: number;
  currentPrice: string;
}): Promise<ClassWithRoute> {
  const route = await resolveRouteForMetadata(params.classAddress, params.metadata);

  return {
    address: params.classAddress,
    name: params.metadata.name,
    instructor: params.metadata.instructor,
    startTime: params.startTime,
    endTime: params.endTime,
    maxRiders: params.maxRiders,
    ticketsSold: params.ticketsSold,
    currentPrice: params.currentPrice,
    metadata: params.metadata,
    route,
    routeLoading: false,
    routeError: null,
  };
}

async function loadContractClass(
  publicClient: PublicClient,
  classAddress: `0x${string}`,
): Promise<ClassWithRoute | null> {
  const metadataRaw = await publicClient.readContract({
    address: classAddress,
    abi: SPIN_CLASS_ABI,
    functionName: "classMetadata",
  });

  if (typeof metadataRaw !== "string") {
    return null;
  }

  const metadata = parseClassMetadata(metadataRaw);
  if (!metadata) {
    return null;
  }

  const [currentPrice, ticketsSoldData, maxRidersData, startTimeData, endTimeData] = await Promise.all([
    publicClient.readContract({ address: classAddress, abi: SPIN_CLASS_ABI, functionName: "currentPrice" }),
    publicClient.readContract({ address: classAddress, abi: SPIN_CLASS_ABI, functionName: "ticketsSold" }),
    publicClient.readContract({ address: classAddress, abi: SPIN_CLASS_ABI, functionName: "maxRiders" }),
    publicClient.readContract({ address: classAddress, abi: SPIN_CLASS_ABI, functionName: "startTime" }),
    publicClient.readContract({ address: classAddress, abi: SPIN_CLASS_ABI, functionName: "endTime" }),
  ]);

  return hydrateClassFromMetadata({
    classAddress,
    metadata,
    startTime: Number(startTimeData),
    endTime: Number(endTimeData),
    maxRiders: Number(maxRidersData),
    ticketsSold: Number(ticketsSoldData),
    currentPrice: currentPrice.toString(),
  });
}

async function loadMockClass(mockClass: typeof MOCK_CLASSES[number]): Promise<ClassWithRoute> {
  const metadata = createFallbackMetadataFromMock(mockClass);

  return hydrateClassFromMetadata({
    classAddress: mockClass.address,
    metadata,
    startTime: mockClass.startTime,
    endTime: mockClass.startTime + 3600,
    maxRiders: mockClass.maxRiders,
    ticketsSold: mockClass.ticketsSold,
    currentPrice: mockClass.currentPrice,
  });
}

/**
 * Hook to fetch a single class with route data
 */
export function useClass(classAddress: `0x${string}`) {
  const [classData, setClassData] = useState<ClassWithRoute | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validate address format before making contract calls
  const isRealAddress = /^0x[0-9a-fA-F]{40}$/.test(classAddress);

  // Contract reads for class data - only enabled for valid addresses
  const { data: metadataRaw, refetch: refetchMetadata } = useReadContract({
    address: classAddress,
    abi: SPIN_CLASS_ABI,
    functionName: "classMetadata",
    query: {
      enabled: isRealAddress,
    },
  });

  const { data: currentPrice } = useReadContract({
    address: classAddress,
    abi: SPIN_CLASS_ABI,
    functionName: "currentPrice",
    query: {
      enabled: isRealAddress,
    },
  });

  const { data: ticketsSoldData } = useReadContract({
    address: classAddress,
    abi: SPIN_CLASS_ABI,
    functionName: "ticketsSold",
    query: {
      enabled: isRealAddress,
    },
  });

  const { data: maxRidersData } = useReadContract({
    address: classAddress,
    abi: SPIN_CLASS_ABI,
    functionName: "maxRiders",
    query: {
      enabled: isRealAddress,
    },
  });

  const { data: startTimeData } = useReadContract({
    address: classAddress,
    abi: SPIN_CLASS_ABI,
    functionName: "startTime",
    query: {
      enabled: isRealAddress,
    },
  });

  const { data: endTimeData } = useReadContract({
    address: classAddress,
    abi: SPIN_CLASS_ABI,
    functionName: "endTime",
    query: {
      enabled: isRealAddress,
    },
  });

  /**
   * Load class data from contract or fallback to mock data
   * Production: Uses on-chain data when available
   * Demo catalog fallback is opt-in and disabled by default.
   */
  const loadClassData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Production path: Use contract data when available
      if (isRealAddress && metadataRaw && typeof metadataRaw === "string") {
        const parsedMetadata = parseClassMetadata(metadataRaw);

        if (parsedMetadata) {
          setClassData(
            await hydrateClassFromMetadata({
              classAddress,
              metadata: parsedMetadata,
              startTime: startTimeData ? Number(startTimeData) : 0,
              endTime: endTimeData ? Number(endTimeData) : (startTimeData ? Number(startTimeData) + 3600 : 3600),
              maxRiders: maxRidersData ? Number(maxRidersData) : 50,
              ticketsSold: ticketsSoldData ? Number(ticketsSoldData) : 0,
              currentPrice: currentPrice ? currentPrice.toString() : "0",
            }),
          );

          setIsLoading(false);
          return;
        }
      }

      if (ENABLE_DEMO_CLASS_CATALOG) {
        const mockClass = MOCK_CLASSES.find(c => c.address.toLowerCase() === classAddress.toLowerCase());
        if (mockClass) {
          setClassData(await loadMockClass(mockClass));
          setIsLoading(false);
          return;
        }
      }

      setClassData(null);
      setError("Class not found");
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load class:", err);
      setError(err instanceof Error ? err.message : "Failed to load class");
      setIsLoading(false);
    }
  }, [classAddress, isRealAddress, metadataRaw, currentPrice, ticketsSoldData, maxRidersData, startTimeData, endTimeData]);

  // Load class data when address or contract data changes
  useEffect(() => {
    if (!isRealAddress) {
      const timeoutId = window.setTimeout(() => {
        setIsLoading(false);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const timeoutId = window.setTimeout(() => {
      void loadClassData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isRealAddress, loadClassData]);

  return { classData, isLoading, error, refetch: () => { void refetchMetadata(); return loadClassData(); } };
}

/**
 * Hook to fetch all available classes with route previews
 */
export function useClasses() {
  const publicClient = usePublicClient();
  const [classes, setClasses] = useState<ClassWithRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let liveClasses: ClassWithRoute[] = [];

      if (publicClient) {
        try {
          const classCountRaw = await publicClient.readContract({
            address: CLASS_FACTORY_ADDRESS,
            abi: CLASS_FACTORY_ABI,
            functionName: "getClassCount",
          });

          const classCount = Number(classCountRaw);

          if (classCount > 0) {
            const classAddresses = (await publicClient.readContract({
              address: CLASS_FACTORY_ADDRESS,
              abi: CLASS_FACTORY_ABI,
              functionName: "getClasses",
              args: [0n, BigInt(classCount)],
            })) as `0x${string}`[];

            const hydrated = await Promise.all(
              classAddresses.map(async (address) => {
                try {
                  return await loadContractClass(publicClient, address);
                } catch (loadError) {
                  console.warn("Failed to hydrate class from factory listing:", address, loadError);
                  return null;
                }
              }),
            );

            liveClasses = hydrated.filter((classData): classData is ClassWithRoute => Boolean(classData));
          }
        } catch (factoryError) {
          console.warn("Failed to load class list from factory, falling back to mocks:", factoryError);
        }
      }

      if (ENABLE_DEMO_CLASS_CATALOG) {
        const fallbackMocks = await Promise.all(MOCK_CLASSES.map((mockClass) => loadMockClass(mockClass)));
        const mergedClasses = [...liveClasses, ...fallbackMocks.filter((mockClass) => !liveClasses.some((liveClass) => liveClass.address.toLowerCase() === mockClass.address.toLowerCase()))];
        setClasses(mergedClasses);
      } else {
        setClasses(liveClasses);
      }
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load classes:", err);
      setError(err instanceof Error ? err.message : "Failed to load classes");
      setIsLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadClasses();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadClasses]);

  return { classes, isLoading, error, refetch: loadClasses };
}

export interface PracticeClassFormData {
  name: string;
  date: string;
  capacity: number;
  basePrice: number;
  maxPrice: number;
  curveType: "linear" | "exponential";
  rewardThreshold: number;
  rewardAmount: number;
  suiPerformance: boolean;
  aiEnabled?: boolean;
  aiPersonality?: "zen" | "drill-sergeant" | "data";
}

export interface PracticeClassOptions {
  formData: PracticeClassFormData;
  routeData: {
    name: string;
    distance: number;
    duration: number;
    elevationGain: number;
    theme: "neon" | "alpine" | "mars";
    storyBeatsCount: number;
  };
  instructorAddress: string;
}

export function createPracticeClassMetadata(
  formData: PracticeClassFormData,
  routeData: PracticeClassOptions["routeData"],
  instructorAddress: string
): EnhancedClassMetadata {
  return {
    version: "2.0",
    name: formData.name,
    description: `An immersive cycling experience with AI-powered coaching`,
    instructor: instructorAddress,
    startTime: Math.floor(new Date(formData.date).getTime() / 1000),
    endTime: Math.floor(new Date(formData.date).getTime() / 1000) + 3600,
    duration: routeData.duration,
    route: {
      walrusBlobId: `practice-${Date.now()}`,
      name: routeData.name,
      distance: routeData.distance,
      duration: routeData.duration,
      elevationGain: routeData.elevationGain,
      theme: routeData.theme,
      checksum: `practice-checksum-${Date.now()}`,
      storyBeatsCount: routeData.storyBeatsCount,
    },
    ai: {
      enabled: formData.aiEnabled ?? true,
      personality: formData.aiPersonality ?? "drill-sergeant",
      autoTriggerBeats: true,
      adaptiveDifficulty: true,
    },
    pricing: {
      basePrice: formData.basePrice.toString(),
      maxPrice: formData.maxPrice.toString(),
      curveType: formData.curveType,
    },
    rewards: {
      enabled: true,
      threshold: formData.rewardThreshold,
      amount: formData.rewardAmount,
    },
  };
}

export function usePracticeClass() {
  const [practiceClassId, setPracticeClassId] = useState<string | null>(null);
  const [practiceClassData, setPracticeClassData] = useState<ClassWithRoute | null>(null);

  const createPracticeClass = (
    formData: PracticeClassFormData,
    routeData: PracticeClassOptions["routeData"],
    instructorAddress: string
  ) => {
    const mockId = `practice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as `0x${string}`;
    const metadata = createPracticeClassMetadata(formData, routeData, instructorAddress);
    const route = generateMockRouteData(metadata);

    setPracticeClassId(mockId);
    setPracticeClassData({
      address: mockId,
      name: metadata.name,
      instructor: metadata.instructor,
      startTime: metadata.startTime,
      endTime: metadata.endTime,
      maxRiders: formData.capacity,
      ticketsSold: 0,
      currentPrice: formData.basePrice.toString(),
      metadata,
      route,
      routeLoading: false,
      routeError: null,
    });

    return mockId;
  };

  return {
    practiceClassId,
    practiceClassData,
    createPracticeClass,
  };
}

/**
 * Generate elevation profile based on route type
 */
function generateElevationProfile(
  routeName: string,
  elevationGain: number,
  numPoints: number
): number[] {
  const elevations: number[] = [];
  const baseElevation = 100;

  // Determine route type from name
  const isMountain = routeName.toLowerCase().includes("mountain") ||
    routeName.toLowerCase().includes("climb");
  const isSprint = routeName.toLowerCase().includes("sprint") ||
    routeName.toLowerCase().includes("coastal");
  const isIntervals = routeName.toLowerCase().includes("interval") ||
    routeName.toLowerCase().includes("city");

  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1);
    let elevation = baseElevation;

    if (isMountain) {
      // Mountain climb: Steady ascent with some variation
      // S-curve: starts gradual, steepens in middle, eases at top
      const climbFactor = Math.pow(progress, 0.7); // Non-linear for realistic climb
      elevation += climbFactor * elevationGain;
      // Add some rocky variation
      elevation += Math.sin(progress * Math.PI * 8) * (elevationGain * 0.05);

    } else if (isSprint) {
      // Coastal sprint: Rolling hills, undulating
      // Multiple small climbs and descents
      const wave1 = Math.sin(progress * Math.PI * 4) * (elevationGain * 0.3);
      const wave2 = Math.sin(progress * Math.PI * 8) * (elevationGain * 0.15);
      elevation += (progress * elevationGain * 0.4) + wave1 + wave2;

    } else if (isIntervals) {
      // City intervals: Sharp spikes for interval training
      // Flat with periodic sharp climbs
      const intervalPattern = Math.sin(progress * Math.PI * 6);
      const spike = intervalPattern > 0.5
        ? (intervalPattern - 0.5) * 2 * elevationGain * 0.8
        : 0;
      elevation += (progress * elevationGain * 0.2) + spike;

    } else {
      // Default: Rolling terrain
      elevation += progress * elevationGain + Math.sin(progress * Math.PI * 5) * 50;
    }

    elevations.push(Math.round(elevation));
  }

  return elevations;
}

/**
 * Generate mock route data for development
 */
export function generateMockRouteData(
  metadata: EnhancedClassMetadata,
  classId = "mock-class-id",
): WalrusRouteData {
  const numPoints = 100;
  const coordinates = [];
  const baseLat = 34.0195;
  const baseLng = -118.4912;

  // Generate unique elevation profile based on route name
  const elevationProfile = generateElevationProfile(
    metadata.route.name,
    metadata.route.elevationGain,
    numPoints
  );

  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1);
    coordinates.push({
      lat: baseLat + Math.sin(progress * Math.PI * 3) * 0.01,
      lng: baseLng + progress * 0.02,
      ele: elevationProfile[i],
    });
  }

  const labels = metadata.route.storyBeatLabels?.length
    ? metadata.route.storyBeatLabels
    : ["Warm-up", "Climb", "Sprint", "Recovery", "Final Push"].slice(0, metadata.route.storyBeatsCount);
  const storyBeats: StoryBeat[] = labels.map((label, index) => ({
    progress: (index + 1) / (labels.length + 1),
    label,
    type: inferBeatType(label),
    intensity: 5 + (index % 4),
  }));

  // Calculate elevation metrics
  const elevations = coordinates.map(c => c.ele || 0);
  const maxElevation = Math.max(...elevations);
  const minElevation = Math.min(...elevations);
  const elevationLoss = elevations.reduce((loss, ele, i) => {
    if (i === 0) return 0;
    const diff = ele - elevations[i - 1];
    return diff < 0 ? loss + Math.abs(diff) : loss;
  }, 0);
  const avgGrade = metadata.route.elevationGain / (metadata.route.distance * 1000) * 100;

  return {
    version: "1.0",
    route: {
      name: metadata.route.name,
      description: metadata.description,
      coordinates,
      estimatedDistance: metadata.route.distance,
      estimatedDuration: metadata.route.duration,
      elevationGain: metadata.route.elevationGain,
      elevationLoss,
      maxElevation,
      minElevation,
      avgGrade,
      maxGrade: avgGrade * 1.5,
      storyBeats,
      terrainTags: metadata.route.terrainTags?.length ? metadata.route.terrainTags : ["rolling", "mixed"],
      difficultyScore: 50,
      estimatedCalories: 400,
      zones: [
        { name: "Warmup", startProgress: 0, endProgress: 0.15, type: "warmup", description: "Easy spinning" },
        { name: "Main", startProgress: 0.15, endProgress: 0.85, type: "endurance", description: "Steady effort" },
        { name: "Cooldown", startProgress: 0.85, endProgress: 1, type: "recovery", description: "Easy spinning" },
      ],
    },
    deployment: {
      classId,
      instructor: metadata.instructor,
      deployedAt: new Date().toISOString(),
    },
    checksum: metadata.route.checksum,
  };
}
