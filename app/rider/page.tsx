"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { PrimaryNav } from "../components/nav";
import { useClasses } from "../hooks/use-class-data";
import { RoutePreviewCard } from "../components/route-preview-card";
import { ConnectWallet } from "../components/connect-wallet";
import type { SavedRoute } from "../lib/route-library";

export default function RiderPage() {
  const { address, isConnected } = useAccount();
  const { classes, isLoading, error } = useClasses();
  const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null);
  const [filterUpcoming, setFilterUpcoming] = useState(true);
  const [showGuestBanner, setShowGuestBanner] = useState(true);
  
  // Filter classes by time
  const now = Math.floor(Date.now() / 1000);
  const filteredClasses = classes.filter(cls => 
    filterUpcoming ? cls.startTime > now : cls.startTime <= now
  );

  const handlePreviewRoute = (classData: any) => {
    if (classData.route) {
      const routeForPreview: SavedRoute = {
        id: classData.address,
        name: classData.route.route.name,
        description: classData.route.route.description,
        coordinates: classData.route.route.coordinates,
        estimatedDistance: classData.route.route.estimatedDistance,
        estimatedDuration: classData.route.route.estimatedDuration,
        elevationGain: classData.route.route.elevationGain,
        storyBeats: classData.route.route.storyBeats,
        savedAt: classData.route.deployment.deployedAt,
        author: classData.instructor,
        tags: [],
        isFavorite: false,
        timesUsed: 0,
      };
      setSelectedRoute(routeForPreview);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      {/* Background gradient - adapts to theme */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      
      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        {/* Guest Mode Banner */}
        {!isConnected && showGuestBanner && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 backdrop-blur">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="text-2xl">👋</span>
                <div>
                  <h3 className="text-lg font-semibold text-amber-600 dark:text-amber-400 mb-1">
                    Browsing as Guest
                  </h3>
                  <p className="text-sm text-amber-700/80 dark:text-amber-200/80">
                    You can preview all classes and routes. Connect your wallet to book and earn rewards.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ConnectWallet />
                <button
                  onClick={() => setShowGuestBanner(false)}
                  className="p-2 rounded-lg text-amber-600/60 dark:text-amber-400/60 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Demo Mode Info (when connected but no purchases) */}
        {isConnected && (
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[color:var(--muted)]">
                  Connected as {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
                <p className="text-xs text-[color:var(--muted)] mt-1">
                  Browse classes below and purchase tickets to start earning SPIN
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[color:var(--foreground)]">0</p>
                <p className="text-xs text-[color:var(--muted)]">SPIN Balance</p>
              </div>
            </div>
          </div>
        )}

        {/* Header with Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[color:var(--foreground)]">Available Classes</h1>
            <p className="mt-1 text-[color:var(--muted)]">
              {filteredClasses.length} {filterUpcoming ? 'upcoming' : 'past'} classes with immersive routes
            </p>
          </div>
          
          <div className="flex gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-1">
            <button
              onClick={() => setFilterUpcoming(true)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                filterUpcoming 
                  ? "bg-[color:var(--accent)] text-white" 
                  : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setFilterUpcoming(false)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                !filterUpcoming 
                  ? "bg-[color:var(--accent)] text-white" 
                  : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
              }`}
            >
              Past
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-[color:var(--border)] border-t-[color:var(--accent)] mb-4" />
              <p className="text-[color:var(--muted)]">Loading classes...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Classes Grid */}
        {!isLoading && !error && filteredClasses.length > 0 && (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {filteredClasses.map((classData) => (
              <div
                key={classData.address}
                className="group rounded-xl sm:rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] overflow-hidden backdrop-blur transition-all hover:border-[color:var(--accent)]/30"
              >
                {/* Class Header */}
                <div className="p-4 sm:p-6 border-b border-[color:var(--border)]">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg sm:text-xl font-bold text-[color:var(--foreground)] mb-1">
                        {classData.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-[color:var(--muted)]">
                        by {classData.instructor}
                      </p>
                    </div>
                    
                    {classData.metadata?.ai?.enabled && (
                      <div className="rounded-full bg-[color:var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
                        AI Coach
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-[color:var(--muted)]">
                    <span className="flex items-center gap-1">
                      ⏱️ {classData.metadata?.duration || 45} min
                    </span>
                    <span className="flex items-center gap-1">
                      👥 {classData.ticketsSold} / {classData.maxRiders}
                    </span>
                    <span className="flex items-center gap-1">
                      💰 {classData.currentPrice} ETH
                    </span>
                  </div>
                </div>

                {/* Route Preview */}
                {classData.metadata?.route && (
                  <div className="p-4 sm:p-6">
                    <RoutePreviewCard
                      route={classData.metadata.route}
                      variant="compact"
                      onPreview={() => handlePreviewRoute(classData)}
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="p-4 sm:p-6 pt-0 flex gap-2">
                  <button
                    onClick={() => handlePreviewRoute(classData)}
                    className="flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-strong)] py-2.5 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-elevated)]"
                  >
                    Preview Route
                  </button>
                  <button 
                    className="flex-1 rounded-lg bg-[color:var(--accent)] py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isConnected}
                    title={!isConnected ? "Connect wallet to purchase" : "Purchase ticket"}
                  >
                    {isConnected ? "Purchase Ticket" : "Connect to Buy"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredClasses.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--border)] p-12 text-center">
            <p className="text-[color:var(--muted)]">No {filterUpcoming ? 'upcoming' : 'past'} classes</p>
          </div>
        )}

        {/* Route Preview Modal */}
        {selectedRoute && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedRoute(null)}
          >
            <div 
              className="w-full max-w-2xl max-h-[90vh] overflow-auto"
              onClick={e => e.stopPropagation()}
            >
              <RoutePreviewCard route={selectedRoute} variant="detailed" />
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setSelectedRoute(null)}
                  className="flex-1 py-3 rounded-xl bg-[color:var(--surface-strong)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-elevated)] transition-colors"
                >
                  Close Preview
                </button>
                {!isConnected && (
                  <div className="flex-1">
                    <ConnectWallet />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
