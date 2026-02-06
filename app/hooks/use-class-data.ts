/**
 * Class Data Hook
 * Fetches class information including route metadata from contracts
 * Integrates with Walrus to load complete route data
 */

"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "wagmi";
import { SPIN_CLASS_ABI } from "../lib/contracts";
import { parseClassMetadata, type EnhancedClassMetadata } from "../lib/contracts";
import { retrieveRouteFromWalrus, getCachedRoute, cacheRouteLocally, type WalrusRouteData } from "../lib/route-storage";
import type { StoryBeat, StoryBeatType } from "../routes/builder/gpx-uploader";

/**
 * Mock class data for development
 * In production, this would come from subgraph or contract events
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
  ticketsSold: 8,
  maxRiders: 20,
  currentPrice: "0",
  isGuestMode: true,
  description: "Try SpinChain without connecting a wallet. Experience the full workout with real-time rewards!",
  difficulty: "moderate",
  duration: 30,
  elevationGain: 450,
  theme: "alpine" as const,
};

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

/**
 * Hook to fetch a single class with route data
 */
export function useClass(classAddress: `0x${string}`) {
  const [classData, setClassData] = useState<ClassWithRoute | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TODO: Replace with actual contract read
  // const { data: metadata } = useReadContract({
  //   address: classAddress,
  //   abi: SPIN_CLASS_ABI,
  //   functionName: 'classMetadata',
  // });

  useEffect(() => {
    loadClassData();
  }, [classAddress]);

  const loadClassData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock: Find class in mock data
      const mockClass = MOCK_CLASSES.find(c => c.address === classAddress);
      if (!mockClass) {
        throw new Error("Class not found");
      }

      // Mock metadata with route reference
      const mockMetadata: EnhancedClassMetadata = {
        version: "2.0",
        name: mockClass.name,
        description: "An immersive cycling experience with AI-powered coaching",
        instructor: mockClass.instructor,
        startTime: mockClass.startTime,
        endTime: mockClass.startTime + 3600,
        duration: 45,
        route: {
          walrusBlobId: "mock-blob-id-" + classAddress.slice(2, 8),
          name: mockClass.name,
          distance: 35 + Math.random() * 20,
          duration: 45,
          elevationGain: 300 + Math.floor(Math.random() * 500),
          theme: ["neon", "alpine", "mars"][Math.floor(Math.random() * 3)] as "neon" | "alpine" | "mars",
          checksum: "mock-checksum",
          storyBeatsCount: 3 + Math.floor(Math.random() * 3),
        },
        ai: {
          enabled: true,
          personality: "drill-sergeant",
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

      // Check cache first
      let route = getCachedRoute(classAddress);

      // If not cached, try to fetch from Walrus (mock for now)
      if (!route && mockMetadata.route.walrusBlobId) {
        // In production: route = await retrieveRouteFromWalrus(mockMetadata.route.walrusBlobId);
        // For now, generate mock route data
        route = generateMockRouteData(mockMetadata);
        
        // Cache it
        if (route) {
          cacheRouteLocally(classAddress, route);
        }
      }

      setClassData({
        address: classAddress,
        name: mockClass.name,
        instructor: mockClass.instructor,
        startTime: mockClass.startTime,
        endTime: mockClass.startTime + 3600,
        maxRiders: mockClass.maxRiders,
        ticketsSold: mockClass.ticketsSold,
        currentPrice: mockClass.currentPrice,
        metadata: mockMetadata,
        route,
        routeLoading: false,
        routeError: null,
      });

      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load class:", err);
      setError(err instanceof Error ? err.message : "Failed to load class");
      setIsLoading(false);
    }
  };

  return { classData, isLoading, error, refetch: loadClassData };
}

/**
 * Hook to fetch all available classes with route previews
 */
export function useClasses() {
  const [classes, setClasses] = useState<ClassWithRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClasses = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load all mock classes
      const loadedClasses = await Promise.all(
        MOCK_CLASSES.map(async (mockClass) => {
          const mockMetadata: EnhancedClassMetadata = {
            version: "2.0",
            name: mockClass.name,
            description: "An immersive cycling experience with AI-powered coaching",
            instructor: mockClass.instructor,
            startTime: mockClass.startTime,
            endTime: mockClass.startTime + 3600,
            duration: 45,
            route: {
              walrusBlobId: "mock-blob-id-" + mockClass.address.slice(2, 8),
              name: mockClass.name,
              distance: 35 + Math.random() * 20,
              duration: 45,
              elevationGain: 300 + Math.floor(Math.random() * 500),
              theme: ["neon", "alpine", "mars"][Math.floor(Math.random() * 3)] as "neon" | "alpine" | "mars",
              checksum: "mock-checksum",
              storyBeatsCount: 3 + Math.floor(Math.random() * 3),
            },
            ai: {
              enabled: true,
              personality: ["zen", "drill-sergeant", "data"][Math.floor(Math.random() * 3)] as "zen" | "drill-sergeant" | "data",
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

          // Check cache
          let route = getCachedRoute(mockClass.address);
          
          if (!route) {
            route = generateMockRouteData(mockMetadata);
            if (route) {
              cacheRouteLocally(mockClass.address, route);
            }
          }

          return {
            address: mockClass.address,
            name: mockClass.name,
            instructor: mockClass.instructor,
            startTime: mockClass.startTime,
            endTime: mockClass.startTime + 3600,
            maxRiders: mockClass.maxRiders,
            ticketsSold: mockClass.ticketsSold,
            currentPrice: mockClass.currentPrice,
            metadata: mockMetadata,
            route,
            routeLoading: false,
            routeError: null,
          };
        })
      );

      setClasses(loadedClasses);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load classes:", err);
      setError(err instanceof Error ? err.message : "Failed to load classes");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadClasses();
  }, []);

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
export function generateMockRouteData(metadata: EnhancedClassMetadata): WalrusRouteData {
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

  const storyBeats: StoryBeat[] = [];
  for (let i = 0; i < metadata.route.storyBeatsCount; i++) {
    const progress = (i + 1) / (metadata.route.storyBeatsCount + 1);
    storyBeats.push({
      progress,
      label: ["Warm-up", "Climb", "Sprint", "Recovery", "Final Push"][i] || `Beat ${i + 1}`,
      type: ["rest", "climb", "sprint", "drop"][Math.floor(Math.random() * 4)] as StoryBeatType,
      intensity: Math.floor(Math.random() * 10) + 1,
    });
  }

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
      terrainTags: ["rolling", "mixed"],
      difficultyScore: 50,
      estimatedCalories: 400,
      zones: [
        { name: "Warmup", startProgress: 0, endProgress: 0.15, type: "warmup", description: "Easy spinning" },
        { name: "Main", startProgress: 0.15, endProgress: 0.85, type: "endurance", description: "Steady effort" },
        { name: "Cooldown", startProgress: 0.85, endProgress: 1, type: "recovery", description: "Easy spinning" },
      ],
    },
    deployment: {
      classId: "mock-class-id",
      instructor: metadata.instructor,
      deployedAt: new Date().toISOString(),
    },
    checksum: metadata.route.checksum,
  };
}
