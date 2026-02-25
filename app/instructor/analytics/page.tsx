"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { PrimaryNav } from "../../components/layout/nav";
import { SurfaceCard, Tag, MetricTile } from "../../components/ui/ui";
import { ConnectWallet } from "../../components/features/wallet/connect-wallet";
import { useInstructorAnalytics } from "../../hooks/evm/use-instructor-analytics";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Calendar,
  Award,
  Activity,
  Download
} from "lucide-react";

export default function InstructorAnalyticsPage() {
  const { isConnected, address } = useAccount();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const { analytics, isLoading } = useInstructorAnalytics(timeRange);

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
                    Connect Wallet to View Analytics
                  </h3>
                  <p className="text-sm text-amber-900 dark:text-amber-200/80">
                    Track your revenue, class performance, and rider engagement.
                  </p>
                </div>
              </div>
              <ConnectWallet />
            </div>
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
                className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
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

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <SurfaceCard className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">
                    Total Revenue
                  </p>
                  <p className="text-2xl md:text-3xl font-bold text-[color:var(--foreground)]">
                    {formatCurrency(analytics.revenue.totalInstructor)}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                    <TrendingUp size={12} />
                    {formatCurrency(analytics.revenue.totalGross)} gross
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/20">
                  <DollarSign size={20} className="text-green-600 dark:text-green-400" />
                </div>
              </div>
            </SurfaceCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <SurfaceCard className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">
                    Total Riders
                  </p>
                  <p className="text-2xl md:text-3xl font-bold text-[color:var(--foreground)]">
                    {analytics.engagement.totalRiders}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    {analytics.engagement.uniqueRiders} unique
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <Users size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </SurfaceCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <SurfaceCard className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">
                    Classes Taught
                  </p>
                  <p className="text-2xl md:text-3xl font-bold text-[color:var(--foreground)]">
                    {analytics.performance.completedClasses}
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                    {analytics.performance.upcomingClasses} upcoming
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/20">
                  <Calendar size={20} className="text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </SurfaceCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <SurfaceCard className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">
                    Avg Fill Rate
                  </p>
                  <p className="text-2xl md:text-3xl font-bold text-[color:var(--foreground)]">
                    {formatPercent(analytics.engagement.avgFillRate)}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    {analytics.engagement.avgClassSize.toFixed(1)} riders/class
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/20">
                  <Award size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </SurfaceCard>
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

              <button className="w-full mt-4 px-6 py-3 rounded-xl bg-[color:var(--accent)] text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
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
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                  style={{ width: `${analytics.engagement.avgAttendanceRate * 100}%` }}
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
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                  style={{ width: `${analytics.engagement.repeatRiderRate * 100}%` }}
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
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
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
      </main>
    </div>
  );
}
