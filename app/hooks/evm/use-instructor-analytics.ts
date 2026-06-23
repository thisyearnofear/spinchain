"use client";

/**
 * Instructor Analytics Hook
 * Aggregates revenue, class performance, and rider engagement metrics
 * ENHANCEMENT: Consolidates instructor data from multiple sources
 */

import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { useClasses } from "./use-class-data";
import { isSupabaseConfigured } from "@/app/lib/supabase/client";

export interface RiderBreakdown {
  address: string;
  rideCount: number;
  avgEffort: number;
  avgPower: number;
  lastRideAt: string | null;
}

export interface TrendBucket {
  day: string;
  rideCount: number;
  uniqueRiders: number;
  avgEffort: number;
  avgPower: number;
}

export interface RealAnalytics {
  totalRides: number;
  uniqueRiders: number;
  repeatRiderRate: number;
  avgEffort: number;
  avgPower: number;
  avgHeartRate: number;
  attendanceRate: number;
  riderBreakdown: RiderBreakdown[];
  trends: TrendBucket[];
}

export interface ClassAnalytics {
  classAddress: `0x${string}`;
  className: string;
  startTime: number;
  endTime: number;
  
  // Ticket metrics
  ticketsSold: number;
  capacity: number;
  fillRate: number; // 0-1
  
  // Revenue metrics
  grossRevenue: number; // in USDC/AVAX
  instructorRevenue: number;
  protocolFee: number;
  
  // Engagement metrics
  attendanceRate: number; // checked in / tickets sold
  avgHeartRate?: number;
  avgPower?: number;
  completionRate?: number; // riders who finished
  
  // Status
  status: "upcoming" | "live" | "completed" | "cancelled";
}

export interface RevenueMetrics {
  totalGross: number;
  totalInstructor: number;
  totalProtocol: number;
  pendingWithdrawal: number;
  withdrawnToDate: number;
  currency: "USDC" | "USDT" | "AVAX";
}

export interface EngagementMetrics {
  totalRiders: number;
  uniqueRiders: number;
  avgClassSize: number;
  avgFillRate: number;
  avgAttendanceRate: number;
  repeatRiderRate: number; // % of riders who took >1 class
}

export interface PerformanceMetrics {
  totalClasses: number;
  upcomingClasses: number;
  completedClasses: number;
  cancelledClasses: number;
  avgRating?: number;
  topPerformingClass?: ClassAnalytics;
}

export interface InstructorAnalytics {
  revenue: RevenueMetrics;
  engagement: EngagementMetrics;
  performance: PerformanceMetrics;
  classes: ClassAnalytics[];
  timeRange: "7d" | "30d" | "90d" | "all";
}

/**
 * Hook to fetch and aggregate instructor analytics
 */
export function useInstructorAnalytics(timeRange: "7d" | "30d" | "90d" | "all" = "30d") {
  const { address } = useAccount();
  const { classes, isLoading: classesLoading } = useClasses();
  
  const [isLoading, setIsLoading] = useState(true);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));
  const [error, _setError] = useState<Error | null>(null);
  const [realAnalytics, setRealAnalytics] = useState<RealAnalytics | null>(null);

  // Fetch real analytics from Supabase
  useEffect(() => {
    if (!address) return;
    if (!isSupabaseConfigured()) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/instructor/analytics?range=${timeRange}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setRealAnalytics(data as RealAnalytics);
        }
      } catch {
        // Silent fail — fall back to on-chain estimates
      }
    })();

    return () => { cancelled = true; };
  }, [address, timeRange]);

  // Filter classes by instructor
  const instructorClasses = useMemo(() => {
    if (!address) return [];
    return classes.filter(c => 
      c.instructor.toLowerCase() === address.toLowerCase()
    );
  }, [classes, address]);

  // Filter by time range
  const filteredClasses = useMemo(() => {
    const ranges = {
      "7d": 7 * 24 * 60 * 60,
      "30d": 30 * 24 * 60 * 60,
      "90d": 90 * 24 * 60 * 60,
      "all": Infinity,
    };
    
    const cutoff = nowSeconds - ranges[timeRange];
    return instructorClasses.filter(c => c.startTime >= cutoff);
  }, [instructorClasses, nowSeconds, timeRange]);

  // Calculate analytics
  const analytics = useMemo((): InstructorAnalytics => {
    const now = nowSeconds;
    
    // Map classes to analytics
    const classAnalytics: ClassAnalytics[] = filteredClasses.map(cls => {
      const fillRate = cls.maxRiders > 0 ? cls.ticketsSold / cls.maxRiders : 0;
      const status = 
        cls.startTime > now ? "upcoming" :
        cls.endTime > now ? "live" :
        "completed";
      
      // Estimated revenue (would come from contract in production)
      const avgPrice = 15; // $15 USDC average
      const grossRevenue = cls.ticketsSold * avgPrice;
      const instructorRevenue = grossRevenue * 0.8; // 80% share
      const protocolFee = grossRevenue * 0.2;
      
      return {
        classAddress: cls.address,
        className: cls.name,
        startTime: cls.startTime,
        endTime: cls.endTime,
        ticketsSold: cls.ticketsSold,
        capacity: cls.maxRiders,
        fillRate,
        grossRevenue,
        instructorRevenue,
        protocolFee,
        attendanceRate: realAnalytics?.attendanceRate ?? 0,
        status,
      };
    });

    // Revenue metrics
    const revenue: RevenueMetrics = {
      totalGross: classAnalytics.reduce((sum, c) => sum + c.grossRevenue, 0),
      totalInstructor: classAnalytics.reduce((sum, c) => sum + c.instructorRevenue, 0),
      totalProtocol: classAnalytics.reduce((sum, c) => sum + c.protocolFee, 0),
      pendingWithdrawal: classAnalytics
        .filter(c => c.status === "completed")
        .reduce((sum, c) => sum + c.instructorRevenue, 0),
      withdrawnToDate: 0, // Would track from contract events
      currency: "USDC",
    };

    // Engagement metrics
    const completedClasses = classAnalytics.filter(c => c.status === "completed");
    const totalRiders = completedClasses.reduce((sum, c) => sum + c.ticketsSold, 0);
    
    const engagement: EngagementMetrics = {
      totalRiders,
      uniqueRiders: realAnalytics?.uniqueRiders ?? Math.max(1, Math.floor(totalRiders * 0.7)),
      avgClassSize: completedClasses.length > 0 
        ? totalRiders / completedClasses.length 
        : 0,
      avgFillRate: completedClasses.length > 0
        ? completedClasses.reduce((sum, c) => sum + c.fillRate, 0) / completedClasses.length
        : 0,
      avgAttendanceRate: realAnalytics?.attendanceRate ?? (completedClasses.length > 0
        ? completedClasses.reduce((sum, c) => sum + c.attendanceRate, 0) / completedClasses.length
        : 0),
      repeatRiderRate: realAnalytics?.repeatRiderRate ?? 0,
    };

    // Performance metrics
    const performance: PerformanceMetrics = {
      totalClasses: classAnalytics.length,
      upcomingClasses: classAnalytics.filter(c => c.status === "upcoming").length,
      completedClasses: completedClasses.length,
      cancelledClasses: 0, // Would track from contract events
      topPerformingClass: completedClasses.sort((a, b) => b.grossRevenue - a.grossRevenue)[0],
    };

    return {
      revenue,
      engagement,
      performance,
      classes: classAnalytics,
      timeRange,
    };
  }, [filteredClasses, nowSeconds, timeRange, realAnalytics]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setIsLoading(classesLoading);
  }, [classesLoading]);

  return {
    analytics,
    isLoading,
    error,
    realAnalytics,
    refetch: () => {
      // Would trigger refetch of contract data
    },
  };
}

/**
 * Hook for real-time revenue tracking
 */
export function useRevenueStream(classAddress: `0x${string}`) {
  const [revenue, setRevenue] = useState({
    current: 0,
    target: 0,
    ticketsSold: 0,
  });

  useEffect(() => {
    // Would subscribe to contract events for real-time updates
    // For now, simulated data
    const interval = setInterval(() => {
      setRevenue(prev => ({
        ...prev,
        current: prev.current + Math.random() * 10,
        ticketsSold: prev.ticketsSold + (Math.random() > 0.8 ? 1 : 0),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [classAddress]);

  return revenue;
}
