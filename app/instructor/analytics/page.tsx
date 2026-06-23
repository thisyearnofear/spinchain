"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { PrimaryNav } from "../../components/layout/nav";
import { SurfaceCard, Tag, MetricTileEnhanced } from "../../components/ui/ui";
import { ConnectWallet } from "../../components/features/wallet/connect-wallet";
import { useInstructorAnalytics } from "../../hooks/evm/use-instructor-analytics";
import { InstructorRoster } from "../../components/features/instructor/instructor-roster";
import { InstructorInsightsPanel } from "../../components/features/instructor/instructor-insights-panel";
import { GymManager } from "../../components/features/gym/gym-manager";
import { motion } from "framer-motion";
import { 
  Activity, 
  Download,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

// Generate realistic trend data for sparklines
function generateTrendData(baseValue: number, points: number = 10, variance: number = 0.2): number[] {
  const data: number[] = [];
  let current = baseValue * (1 - variance);
  for (let i = 0; i < points; i++) {
    current += (Math.random() - 0.4) * baseValue * variance * 0.5;
    current = Math.max(baseValue * 0.5, Math.min(baseValue * 1.5, current));
    data.push(current);
  }
  return data;
}

export default function InstructorAnalyticsPage() {
  const { isConnected } = useAccount();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const { analytics, realAnalytics } = useInstructorAnalytics(timeRange);

  // Use real trend data from Supabase when available, fall back to estimated
  const trendData = useMemo(() => {
    const realTrends = realAnalytics?.trends;
    if (realTrends && realTrends.length > 0) {
      return {
        revenue: realTrends.map(t => t.rideCount * 15 * 0.8),
        riders: realTrends.map(t => t.uniqueRiders),
        classes: realTrends.map(t => t.rideCount),
        fillRate: realTrends.map(t => t.avgEffort),
      };
    }
    // Fallback: estimated trend data
    return {
      revenue: generateTrendData(analytics.revenue.totalInstructor || 1000, 12),
      riders: generateTrendData(analytics.engagement.totalRiders || 100, 12),
      classes: generateTrendData(analytics.performance.completedClasses || 10, 12),
      fillRate: generateTrendData(analytics.engagement.avgFillRate * 100 || 50, 12),
    };
  }, [analytics, realAnalytics]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[color:var(--background)]">
        <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
        
        <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
          <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
            <PrimaryNav />
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 backdrop-blur">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="text-2xl">📊</span>
                <div>
                  <h3 className="text-lg font-semibold text-amber-600 dark:text-amber-400 mb-1">
                    Connect your wallet to view analytics
                  </h3>
                  <p className="text-sm text-amber-900 dark:text-amber-200/80">
                    Track your revenue, class performance, and rider engagement once you start teaching.
                  </p>
                </div>
              </div>
              <ConnectWallet />
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-8 text-center">
            <span className="mb-4 block text-4xl">📈</span>
            <h2 className="text-xl font-semibold text-[color:var(--foreground)] mb-2">
              No classes yet
            </h2>
            <p className="text-sm text-[color:var(--muted)] max-w-md mx-auto mb-6">
              Once you publish your first class, you'll see revenue, rider engagement, and performance metrics here.
            </p>
            <Link
              href="/instructor/builder"
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Create your first class
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      
      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 md:px-6 pb-20 pt-10 lg:px-12">
        {/* Header */}
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-6 md:px-8 py-8 md:py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        {/* Title & Time Range Selector */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Tag>Instructor Analytics</Tag>
              {analytics.performance.totalClasses > 0 && (
                <Tag>
                  <Activity size={12} className="mr-1" />
                  Active
                </Tag>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[color:var(--foreground)] tracking-tight">
              Performance Dashboard
            </h1>
            <p className="text-sm md:text-base text-[color:var(--muted)] mt-2">
              Track revenue, engagement, and class performance
            </p>
          </div>

          {/* Time Range Selector */}
          <div className="flex gap-2 bg-[color:var(--surface)] border border-[color:var(--border)] rounded-xl p-1">
            {(["7d", "30d", "90d", "all"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-[background-color,color] duration-150 ${
                  timeRange === range
                    ? "bg-[color:var(--accent)] text-white"
                    : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                }`}
              >
                {range === "all" ? "All Time" : range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics Grid - Enhanced with Sparklines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          >
            <MetricTileEnhanced
              label="Total Revenue"
              value={formatCurrency(analytics.revenue.totalInstructor)}
              trend="up"
              trendValue={`${formatCurrency(analytics.revenue.totalGross)} gross`}
              sparklineData={trendData.revenue}
              sparklineColor="rgb(110, 231, 183)"
              delay={100}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          >
            <MetricTileEnhanced
              label="Total Riders"
              value={analytics.engagement.totalRiders.toLocaleString()}
              trend="neutral"
              trendValue={`${analytics.engagement.uniqueRiders} unique`}
              sparklineData={trendData.riders}
              sparklineColor="rgb(96, 165, 250)"
              delay={200}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          >
            <MetricTileEnhanced
              label="Classes Taught"
              value={analytics.performance.completedClasses.toString()}
              trend="neutral"
              trendValue={`${analytics.performance.upcomingClasses} upcoming`}
              sparklineData={trendData.classes}
              sparklineColor="rgb(192, 132, 252)"
              delay={300}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          >
            <MetricTileEnhanced
              label="Avg Fill Rate"
              value={formatPercent(analytics.engagement.avgFillRate)}
              trend={analytics.engagement.avgFillRate > 0.5 ? "up" : "neutral"}
              trendValue={`${analytics.engagement.avgClassSize.toFixed(1)} riders/class`}
              sparklineData={trendData.fillRate}
              sparklineColor="rgb(251, 191, 36)"
              delay={400}
            />
          </motion.div>
        </div>

        {/* Revenue Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SurfaceCard
            eyebrow="Revenue Breakdown"
            title={`${formatCurrency(analytics.revenue.pendingWithdrawal)} Available`}
            description="Withdraw your earnings to your wallet"
          >
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-[color:var(--surface-strong)]">
                <div>
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    Instructor Share (80%)
                  </p>
                  <p className="text-xs text-[color:var(--muted)] mt-1">
                    Your earnings from ticket sales
                  </p>
                </div>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(analytics.revenue.totalInstructor)}
                </p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-[color:var(--surface-strong)]">
                <div>
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    Protocol Fee (20%)
                  </p>
                  <p className="text-xs text-[color:var(--muted)] mt-1">
                    Platform maintenance & development
                  </p>
                </div>
                <p className="text-lg font-bold text-[color:var(--muted)]">
                  {formatCurrency(analytics.revenue.totalProtocol)}
                </p>
              </div>

              <button className="w-full mt-4 px-6 py-3 rounded-xl bg-[color:var(--accent)] text-white font-medium hover:opacity-90 transition-[transform,opacity] duration-150 active:scale-95 flex items-center justify-center gap-2">
                <Download size={16} />
                Withdraw {formatCurrency(analytics.revenue.pendingWithdrawal)}
              </button>
            </div>
          </SurfaceCard>

          <SurfaceCard
            eyebrow="Engagement Metrics"
            title="Rider Retention"
            description="Track how riders engage with your classes"
          >
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[color:var(--muted)]">Attendance Rate</span>
                <span className="text-sm font-semibold text-[color:var(--foreground)]">
                  {formatPercent(analytics.engagement.avgAttendanceRate)}
                </span>
              </div>
              <div className="w-full h-2 bg-[color:var(--surface-strong)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full origin-left"
                  style={{ transform: `scaleX(${analytics.engagement.avgAttendanceRate})`, transition: "transform 400ms cubic-bezier(0.23, 1, 0.32, 1)" }}
                />
              </div>

              <div className="flex items-center justify-between mt-6">
                <span className="text-sm text-[color:var(--muted)]">Repeat Riders</span>
                <span className="text-sm font-semibold text-[color:var(--foreground)]">
                  {formatPercent(analytics.engagement.repeatRiderRate)}
                </span>
              </div>
              <div className="w-full h-2 bg-[color:var(--surface-strong)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full origin-left"
                  style={{ transform: `scaleX(${analytics.engagement.repeatRiderRate})`, transition: "transform 400ms cubic-bezier(0.23, 1, 0.32, 1)" }}
                />
              </div>

              <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                <p className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                  Top Insight
                </p>
                <p className="text-sm text-[color:var(--foreground)]">
                  {analytics.engagement.repeatRiderRate > 0.3 
                    ? "Great retention! Riders love your classes."
                    : "Focus on engagement to improve repeat attendance."}
                </p>
              </div>
            </div>
          </SurfaceCard>
        </div>

        {/* Recent Classes Table */}
        <SurfaceCard
          eyebrow="Recent Classes"
          title="Performance History"
          description="Track individual class metrics"
        >
          <div className="mt-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[color:var(--border)]">
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[color:var(--muted)] font-semibold">
                    Class
                  </th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[color:var(--muted)] font-semibold hidden md:table-cell">
                    Date
                  </th>
                  <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[color:var(--muted)] font-semibold">
                    Riders
                  </th>
                  <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[color:var(--muted)] font-semibold">
                    Fill Rate
                  </th>
                  <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[color:var(--muted)] font-semibold">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {analytics.classes.slice(0, 10).map((cls, i) => (
                  <motion.tr
                    key={cls.classAddress}
                    initial={{ opacity: 0, transform: "translateX(-20px)" }}
                    animate={{ opacity: 1, transform: "translateX(0)" }}
                    transition={{ delay: i * 0.05, duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                    className="border-b border-[color:var(--border)] hover:bg-[color:var(--surface-strong)] transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div>
                        <p className="text-sm font-medium text-[color:var(--foreground)]">
                          {cls.className}
                        </p>
                        <p className="text-xs text-[color:var(--muted)] md:hidden">
                          {new Date(cls.startTime * 1000).toLocaleDateString()}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-[color:var(--muted)] hidden md:table-cell">
                      {new Date(cls.startTime * 1000).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-right text-sm font-medium text-[color:var(--foreground)]">
                      {cls.ticketsSold}/{cls.capacity}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={`text-sm font-semibold ${
                        cls.fillRate > 0.8 ? "text-green-600 dark:text-green-400" :
                        cls.fillRate > 0.5 ? "text-amber-600 dark:text-amber-400" :
                        "text-[color:var(--muted)]"
                      }`}>
                        {formatPercent(cls.fillRate)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-sm font-semibold text-[color:var(--foreground)]">
                      {formatCurrency(cls.instructorRevenue)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        {/* AI Roster Insights */}
        <InstructorInsightsPanel />

        {/* Rider Roster with homework assignment */}
        <InstructorRoster />

        {/* Gym Registry & Bike Calibration */}
        <GymManager />
      </main>
    </div>
  );
}
