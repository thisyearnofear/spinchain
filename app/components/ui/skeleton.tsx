"use client";

import { motion } from "framer-motion";
import { cn } from "@/app/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "default" | "card" | "text" | "circle" | "avatar";
  width?: string | number;
  height?: string | number;
  animate?: boolean;
  style?: React.CSSProperties;
}

/**
 * Base Skeleton Component
 * Provides loading placeholder with shimmer animation
 */
export function Skeleton({
  className,
  variant = "default",
  width,
  height,
  animate = true,
}: SkeletonProps) {
  const baseStyles = "bg-[color:var(--surface-elevated)] rounded-lg";
  
  const variants = {
    default: "",
    card: "rounded-2xl",
    text: "rounded h-4",
    circle: "rounded-full",
    avatar: "rounded-full w-10 h-10",
  };
  
  const style: React.CSSProperties = {
    width: width,
    height: height,
  };

  if (!animate) {
    return (
      <div
        className={cn(baseStyles, variants[variant], className)}
        style={style}
      />
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)} style={style}>
      <div className={cn(baseStyles, variants[variant], "w-full h-full")} />
      <motion.div
        className="absolute inset-0 -translate-x-full"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
        }}
        animate={{ x: ["-100%", "100%"] }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

/**
 * Text Skeleton with multiple lines
 */
export function TextSkeleton({
  lines = 3,
  className,
  lastLineWidth = "60%",
}: {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={cn(
            "w-full",
            i === lines - 1 && lastLineWidth !== "100%" && `w-[${lastLineWidth}]`
          )}
          style={i === lines - 1 && lastLineWidth !== "100%" ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

/**
 * Card Skeleton with header, content, and footer
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6",
        className
      )}
    >
      <div className="flex items-center gap-4 mb-4">
        <Skeleton variant="avatar" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/3" />
          <Skeleton variant="text" className="w-1/4" />
        </div>
      </div>
      <TextSkeleton lines={4} className="mb-4" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Route Card Skeleton
 */
export function RouteCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] overflow-hidden">
      <Skeleton variant="card" className="h-40 rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton variant="text" className="w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex justify-between items-center pt-2">
          <Skeleton variant="text" className="w-20" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Class Card Skeleton
 */
export function ClassCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" />
          <div>
            <Skeleton variant="text" className="w-32 mb-1" />
            <Skeleton variant="text" className="w-20" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      
      <Skeleton variant="text" className="w-full mb-2" />
      <Skeleton variant="text" className="w-3/4 mb-4" />
      
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
    </motion.div>
  );
}

/**
 * Profile Skeleton
 */
export function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton variant="avatar" className="w-12 h-12" />
      <div className="space-y-2">
        <Skeleton variant="text" className="w-32" />
        <Skeleton variant="text" className="w-20" />
      </div>
    </div>
  );
}

/**
 * Stats Grid Skeleton
 */
export function StatsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
        >
          <Skeleton variant="text" className="w-12 mb-2" />
          <Skeleton variant="text" className="w-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Page Header Skeleton
 */
export function PageHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between py-6">
      <div className="space-y-2">
        <Skeleton variant="text" className="w-48 h-8" />
        <Skeleton variant="text" className="w-64" />
      </div>
      <Skeleton className="h-10 w-32 rounded-full" />
    </div>
  );
}

/**
 * Dashboard Skeleton - Full page loading state
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatsSkeleton count={4} />
      <div className="grid md:grid-cols-2 gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

/**
 * Route List Skeleton
 */
export function RouteListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <RouteCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Class List Skeleton
 */
export function ClassListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <ClassCardSkeleton key={i} />
      ))}
    </div>
  );
}


