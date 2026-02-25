"use client";

/**
 * RideHeader - Top navigation bar for ride page
 * 
 * Core Principles:
 * - CLEAN: Single responsibility - header UI only
 * - MODULAR: Independent of ride logic
 * - ACCESSIBLE: Proper aria labels and roles
 */

interface RideHeaderProps {
  className: string;
  instructor: string;
  isPracticeMode: boolean;
  viewMode: "immersive" | "focus";
  hudMode: "full" | "compact" | "minimal";
  deviceType: "mobile" | "tablet" | "desktop";
  isExiting: boolean;
  onViewModeChange: (mode: "immersive" | "focus") => void;
  onHudModeChange: () => void;
  onResetPreferences: () => void;
  onExit: () => void;
}

export function RideHeader({
  className,
  instructor,
  isPracticeMode,
  viewMode,
  deviceType,
  isExiting,
  onViewModeChange,
  onHudModeChange,
  onResetPreferences,
  onExit,
}: RideHeaderProps) {
  return (
    <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/90 to-transparent p-3 sm:p-6 pointer-events-auto safe-top">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Class Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-lg sm:text-2xl font-bold text-white truncate">
              {className}
            </h1>
            {isPracticeMode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
                Practice
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-white/60 truncate">{instructor}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 ml-2">
          {/* Reset Preferences - Desktop Only */}
          <button
            onClick={onResetPreferences}
            className="hidden sm:inline-flex rounded-lg bg-white/10 px-3 py-2 text-xs sm:text-sm text-white/60 hover:bg-white/20 backdrop-blur active:scale-95 transition-all touch-manipulation min-h-[44px]"
            aria-label="Reset ride UI preferences"
          >
            Reset
          </button>

          {/* View Mode Toggle */}
          <button
            onClick={() => onViewModeChange(viewMode === "immersive" ? "focus" : "immersive")}
            className="rounded-lg bg-white/10 px-3 py-2 text-xs sm:text-sm text-white/70 hover:bg-white/20 backdrop-blur active:scale-95 transition-all touch-manipulation min-h-[44px]"
            aria-label={`Switch to ${viewMode === "immersive" ? "focus" : "immersive"} view`}
            aria-pressed={viewMode === "immersive"}
          >
            {viewMode === "immersive" ? "3D" : "2D"}
          </button>

          {/* HUD Mode Toggle - Mobile Only */}
          {deviceType === "mobile" && (
            <button
              onClick={onHudModeChange}
              className="rounded-lg bg-white/10 p-2 sm:p-2.5 text-white/70 hover:bg-white/20 backdrop-blur active:scale-95 transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Toggle HUD mode"
            >
              <EyeIcon />
            </button>
          )}

          {/* Exit Button */}
          <button
            onClick={onExit}
            disabled={isExiting}
            className="rounded-lg bg-white/10 p-2 sm:p-2.5 text-white/70 hover:bg-white/20 backdrop-blur active:scale-95 transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50"
            aria-label="Exit ride"
          >
            {isExiting ? <LoadingSpinner /> : <CloseIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" opacity="0.3" />
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="15 45" opacity="0.8" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
