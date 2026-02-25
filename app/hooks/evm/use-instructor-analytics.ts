"use client";

/**
 * Instructor Analytics Hook
 * Aggregates revenue, class performance, and rider engagement metrics
 * ENHANCEMENT: Consolidates instructor data from multiple sources
 */

import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { useClasses } from "./use-class-data";

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
  const [error, setError] = useState<Error | null>(null);

  // Filter classes by instructor
  const instructorClasses = useMemo(() => {
    if (!address) return [];
    return classes.filter(c => 
      c.instructor.toLowerCase() === address.toLowerCase()
    );
  }, [classes, address]);

  // Filter by time range
  const filteredClasses = useMemo(() => {
    const now = Date.now() / 1000;
    const ranges = {
      "7d": 7 * 24 * 60 * 60,
      "30d": 30 * 24 * 60 * 60,
      "90d": 90 * 24 * 60 * 60,
      "all": Infinity,
    };
    
    const cutoff = now - ranges[timeRange];
    return instructorClasses.filter(c => c.startTime >= cutoff);
  }, [instructorClasses, timeRange]);

  // Calculate analytics
  const analytics = useMemo((): InstructorAnalytics => {
    const now = Date.now() / 1000;
    
    // Map classes to analytics
    const classAnalytics: ClassAnalytics[] = filteredClasses.map(cls => {
      const fillRate = cls.maxRiders > 0 ? cls.ticketsSold / cls.maxRiders : 0;
      const status = 
        cls.startTime > now ? "upcoming" :
        cls.endTime > now ? "live" :
        "completed";
      
      // Mock revenue calculation (would come from contract in production)
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
        attendanceRate: 0.85, // Mock - would come from contract
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
      uniqueRiders: Math.floor(totalRiders * 0.7), // Mock - would dedupe addresses
      avgClassSize: completedClasses.length > 0 
        ? totalRiders / completedClasses.length 
        : 0,
      avgFillRate: completedClasses.length > 0
        ? completedClasses.reduce((sum, c) => sum + c.fillRate, 0) / completedClasses.length
        : 0,
      avgAttendanceRate: completedClasses.length > 0
        ? completedClasses.reduce((sum, c) => sum + c.attendanceRate, 0) / completedClasses.length
        : 0,
      repeatRiderRate: 0.35, // Mock - would calculate from rider addresses
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
  }, [filteredClasses, timeRange]);

  useEffect(() => {
    setIsLoading(classesLoading);
  }, [classesLoading]);

  return {
    analytics,
    isLoading,
    error,
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
    // For now, mock data
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
