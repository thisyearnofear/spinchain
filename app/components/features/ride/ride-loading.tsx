"use client";

// Loading and error screens for the ride page

const LOADING_TIPS = [
  "Warm-up tip: keep cadence steady for better early effort scoring.",
  "Stay in control zones first, then push for sprint windows.",
  "No wallet connected? You can still ride in practice mode.",
];

interface RideLoadingProps {
  classId: string;
  isPracticeMode: boolean;
  practiceClassName?: string;
  rewardModeLabel: string;
  loadStartedAt: number;
  onPracticeMode: () => void;
  onBack: () => void;
}

export function RideLoading({
  classId,
  isPracticeMode,
  practiceClassName,
  rewardModeLabel,
  loadStartedAt,
  onPracticeMode,
  onBack,
}: RideLoadingProps) {
  const loadingDurationMs = Date.now() - loadStartedAt;
  const isLikelyStuck = loadingDurationMs > 12000;

  const loadingStats = [
    {
      label: "Class",
      value: isPracticeMode
        ? practiceClassName || "Practice Ride"
        : classId.slice(0, 6).concat("…"),
    },
    {
      label: "Mode",
      value: isPracticeMode ? "Practice" : "Live Class",
    },
    {
      label: "Rewards",
      value: rewardModeLabel,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-cyan-300" />
          <div>
            <p className="text-base font-semibold text-white">Preparing your ride experience</p>
            <p className="text-xs text-white/60">Loading route, coach profile, and reward pipeline…</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {loadingStats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-white/10 bg-black/30 p-3">
              <p className="text-[10px] uppercase tracking-wide text-white/50">{stat.label}</p>
              <p className="mt-1 truncate text-sm font-medium text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-3">
          <p className="text-[11px] uppercase tracking-wide text-cyan-100/80">Rider insight</p>
          <p className="mt-1 text-sm text-cyan-50">
            {LOADING_TIPS[Math.floor((loadingDurationMs / 2500) % LOADING_TIPS.length)]}
          </p>
        </div>

        {isLikelyStuck && (
          <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-500/10 p-3">
            <p className="text-sm text-amber-100">
              This is taking longer than expected. If your wallet isn&apos;t connected yet, you can continue in practice mode.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={onPracticeMode}
                className="rounded-md bg-amber-300/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-200"
              >
                Open Practice Mode
              </button>
              <button
                onClick={onBack}
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:text-white"
              >
                Back to Classes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RideNotFound({ onExit }: { onExit: () => void }) {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-red-400 mb-4">Route not found</p>
        <button
          onClick={onExit}
          className="text-white/60 hover:text-white text-sm"
        >
          ← Back to classes
        </button>
      </div>
    </div>
  );
}
