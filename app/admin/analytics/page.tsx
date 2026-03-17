'use client';

import { useState, useEffect, useCallback } from 'react';

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

export default function AnalyticsDashboard() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(100);
  const [filterEvent, setFilterEvent] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (filterEvent) params.set('event', filterEvent);
      
      const response = await fetch(`/api/analytics/sync?${params}`);
      const data = await response.json();
      setEvents(data.events || []);
      setSummary(data.summary);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Analytics Dashboard</h1>
            <p className="text-gray-400 mt-1">Real-time user activity tracking</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-sm">Total Events</p>
              <p className="text-3xl font-bold text-white mt-1">{summary.totalEvents}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-sm">Unique Sessions</p>
              <p className="text-3xl font-bold text-indigo-400 mt-1">{summary.uniqueSessions}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-sm">Recent Events</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{summary.recentEvents}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-sm">Event Types</p>
              <p className="text-3xl font-bold text-purple-400 mt-1">
                {Object.keys(summary.eventTypes).length}
              </p>
            </div>
          </div>
        )}

        {/* Event Types Breakdown */}
        {summary && (
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Event Types</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.eventTypes)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <button
                    key={name}
                    onClick={() => setFilterEvent(filterEvent === name ? '' : name)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      filterEvent === name
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {name} <span className="ml-1 opacity-60">({count})</span>
                  </button>
                ))}
            </div>
            {filterEvent && (
              <p className="mt-3 text-sm text-gray-400">
                Filtering by: <span className="text-indigo-400">{filterEvent}</span>
                <button onClick={() => setFilterEvent('')} className="ml-2 text-gray-500 hover:text-white">
                  (clear)
                </button>
              </p>
            )}
          </div>
        )}

        {/* Events Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Events</h2>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400">Show:</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No events recorded yet. Events will appear as users interact with the app.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Event</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Path</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Session</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {events.map((event, idx) => (
                    <tr key={`${event.sessionId}-${event.timestamp}-${idx}`} className="hover:bg-gray-800/30">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                        {formatRelativeTime(event.timestamp)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-900/50 text-indigo-300">
                          {event.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 font-mono">{event.path || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono text-xs">
                        {event.sessionId.substring(0, 12)}...
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">
                        {event.payload && Object.keys(event.payload).length > 0 ? (
                          <code className="text-xs">{JSON.stringify(event.payload)}</code>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
          <p className="text-sm text-blue-200">
            <strong>Tip:</strong> This dashboard shows events synced from users&apos; browsers. 
            Events are sent in real-time for important actions (ride started/completed) 
            and batched every 30 seconds for other events. Use this data to understand user behavior 
            and identify areas for improvement.
          </p>
        </div>
      </div>
    </div>
  );
}
