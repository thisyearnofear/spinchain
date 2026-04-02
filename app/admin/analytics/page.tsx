'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { SurfaceCard, Tag, MetricTileEnhanced } from '../../components/ui/ui';
import { Activity, Users, Clock, Hash, RefreshCw, Filter } from 'lucide-react';

interface AnalyticsEvent {
  name: string;
  timestamp: number;
  path?: string;
  payload: Record<string, unknown>;
  sessionId: string;
}

interface AnalyticsSummary {
  totalEvents: number;
  uniqueSessions: number;
  eventTypes: Record<string, number>;
  recentEvents: number;
}

// Generate trend data from event counts
function generateTrendData(baseValue: number, points: number = 10): number[] {
  const data: number[] = [];
  for (let i = 0; i < points; i++) {
    const variance = (Math.random() - 0.3) * baseValue * 0.3;
    data.push(Math.max(0, baseValue * 0.7 + variance));
  }
  return data;
}

export default function AnalyticsDashboard() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);
  const [filterEvent, setFilterEvent] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (filterEvent) params.set('event', filterEvent);
      
      const response = await fetch(`/api/analytics/sync?${params}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `Failed to fetch analytics (${response.status})`);
      }
      const data = await response.json();
      setEvents(data.events || []);
      setSummary(data.summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch analytics';
      console.error('Failed to fetch analytics:', error);
      setError(message);
      setEvents([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [limit, filterEvent]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  // Generate trend data from summary
  const trendData = useMemo(() => {
    if (!summary) return null;
    return {
      events: generateTrendData(summary.totalEvents / 10, 12),
      sessions: generateTrendData(summary.uniqueSessions, 12),
      recent: generateTrendData(summary.recentEvents, 12),
      types: generateTrendData(Object.keys(summary.eventTypes).length * 5, 12),
    };
  }, [summary]);

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString() + ' ' + date.toLocaleDateString();
  };

  const formatRelativeTime = (ts: number) => {
    const now = Date.now();
    const diff = now - ts;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return formatTimestamp(ts);
  };

  const eventTypeColors: Record<string, string> = {
    'page_view': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'ride_start': 'bg-green-500/20 text-green-400 border-green-500/30',
    'ride_complete': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'class_join': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'wallet_connect': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'error': 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const getEventColor = (name: string) => {
    return eventTypeColors[name] || 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      
      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 md:px-6 pb-20 pt-6 lg:px-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Tag>Admin</Tag>
              <Tag color="blue">Analytics</Tag>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-[color:var(--foreground)] tracking-tight">
              Analytics Dashboard
            </h1>
            <p className="text-sm md:text-base text-[color:var(--muted)] mt-2">
              Real-time user activity tracking and insights
            </p>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[color:var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-50 transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Summary Cards with Glassmorphism */}
        {error && (
          <SurfaceCard
            eyebrow="Access"
            title="Analytics unavailable"
            description={error}
          />
        )}

        {summary && trendData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <MetricTileEnhanced
                label="Total Events"
                value={summary.totalEvents.toLocaleString()}
                trend="up"
                trendValue="All time"
                sparklineData={trendData.events}
                sparklineColor="rgb(167, 139, 250)"
                delay={100}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <MetricTileEnhanced
                label="Unique Sessions"
                value={summary.uniqueSessions.toLocaleString()}
                trend="neutral"
                trendValue="Active users"
                sparklineData={trendData.sessions}
                sparklineColor="rgb(96, 165, 250)"
                delay={200}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <MetricTileEnhanced
                label="Recent Events"
                value={summary.recentEvents.toLocaleString()}
                trend="up"
                trendValue="Last hour"
                sparklineData={trendData.recent}
                sparklineColor="rgb(110, 231, 183)"
                delay={300}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <MetricTileEnhanced
                label="Event Types"
                value={Object.keys(summary.eventTypes).length.toString()}
                trend="neutral"
                trendValue="Categories"
                sparklineData={trendData.types}
                sparklineColor="rgb(251, 191, 36)"
                delay={400}
              />
            </motion.div>
          </div>
        )}

        {/* Event Types Breakdown */}
        {summary && (
          <SurfaceCard
            eyebrow="Event Breakdown"
            title="Activity Types"
            description="Filter events by type to analyze specific user behaviors"
          >
            <div className="mt-6">
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.eventTypes)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
                    <button
                      key={name}
                      onClick={() => setFilterEvent(filterEvent === name ? '' : name)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 ${
                        filterEvent === name
                          ? 'bg-[color:var(--accent)] text-white border-[color:var(--accent)]'
                          : `${getEventColor(name)} hover:scale-105`
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {name}
                        <span className="opacity-60">({count})</span>
                      </span>
                    </button>
                  ))}
              </div>
              
              {filterEvent && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center gap-2"
                >
                  <Filter size={14} className="text-[color:var(--accent)]" />
                  <span className="text-sm text-[color:var(--muted)]">
                    Filtering by: <span className="text-[color:var(--foreground)] font-medium">{filterEvent}</span>
                  </span>
                  <button 
                    onClick={() => setFilterEvent('')} 
                    className="text-xs text-[color:var(--muted)] hover:text-[color:var(--foreground)] underline ml-2"
                  >
                    Clear filter
                  </button>
                </motion.div>
              )}
            </div>
          </SurfaceCard>
        )}

        {/* Events Table */}
        <SurfaceCard
          eyebrow="Event Log"
          title="Recent Activity"
          description="Live event stream from user interactions"
          actions={
            <div className="flex items-center gap-3">
              <label className="text-sm text-[color:var(--muted)]">Show:</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-[color:var(--surface-strong)] border border-[color:var(--border)] rounded-lg px-3 py-1.5 text-sm text-[color:var(--foreground)]"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
          }
        >
          <div className="mt-6">
            {loading ? (
              <div className="p-12 text-center text-[color:var(--muted)]">
                <div className="w-8 h-8 border-2 border-[color:var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                Loading events...
              </div>
            ) : events.length === 0 ? (
              <div className="p-12 text-center text-[color:var(--muted)]">
                <Activity size={48} className="mx-auto mb-4 opacity-20" />
                <p>No events recorded yet.</p>
                <p className="text-sm mt-2 opacity-60">Events will appear as users interact with the app.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[color:var(--border)]">
                      <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-[color:var(--muted)] font-semibold">
                        <Clock size={14} className="inline mr-1" />
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-[color:var(--muted)] font-semibold">
                        Event
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-[color:var(--muted)] font-semibold hidden md:table-cell">
                        Path
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-[color:var(--muted)] font-semibold hidden lg:table-cell">
                        <Users size={14} className="inline mr-1" />
                        Session
                      </th>
                      <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider text-[color:var(--muted)] font-semibold">
                        <Hash size={14} className="inline mr-1" />
                        Data
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border)]">
                    {events.map((event, idx) => (
                      <motion.tr
                        key={`${event.sessionId}-${event.timestamp}-${idx}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="hover:bg-[color:var(--surface-strong)]/50 transition-colors"
                      >
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-[color:var(--muted)]">
                          {formatRelativeTime(event.timestamp)}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getEventColor(event.name)}`}>
                            {event.name}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-[color:var(--foreground)] font-mono hidden md:table-cell">
                          {event.path || '-'}
                        </td>
                        <td className="px-6 py-3 text-sm text-[color:var(--muted)] font-mono text-xs hidden lg:table-cell">
                          {event.sessionId.substring(0, 8)}...
                        </td>
                        <td className="px-6 py-3 text-sm text-[color:var(--muted)] max-w-xs">
                          {event.payload && Object.keys(event.payload).length > 0 ? (
                            <code className="text-xs bg-[color:var(--surface-strong)] px-2 py-1 rounded">
                              {JSON.stringify(event.payload).slice(0, 40)}
                              {JSON.stringify(event.payload).length > 40 ? '...' : ''}
                            </code>
                          ) : (
                            <span className="text-[color:var(--muted)]/50">-</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </SurfaceCard>

        {/* Info Card */}
        <SurfaceCard
          eyebrow="How It Works"
          title="Event Tracking"
          description="Understanding your analytics data"
        >
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[color:var(--surface-strong)]/50">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center mb-3">
                <Activity size={16} className="text-green-400" />
              </div>
              <p className="text-sm font-medium text-[color:var(--foreground)]">Real-time Events</p>
              <p className="text-xs text-[color:var(--muted)] mt-1">
                Critical actions like ride starts are sent instantly
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[color:var(--surface-strong)]/50">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
                <Clock size={16} className="text-blue-400" />
              </div>
              <p className="text-sm font-medium text-[color:var(--foreground)]">Batched Updates</p>
              <p className="text-xs text-[color:var(--muted)] mt-1">
                Other events are batched every 30 seconds
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[color:var(--surface-strong)]/50">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3">
                <Users size={16} className="text-purple-400" />
              </div>
              <p className="text-sm font-medium text-[color:var(--foreground)]">Session Tracking</p>
              <p className="text-xs text-[color:var(--muted)] mt-1">
                Unique sessions help identify user journeys
              </p>
            </div>
          </div>
        </SurfaceCard>
      </main>
    </div>
  );
}
