"use client";

interface RideHudControlsProps {
  hudMode: "full" | "compact" | "minimal";
  onToggleHud: () => void;
  onToggleViewMode: () => void;
  effectiveIsFocus: boolean;
  canRender3d: boolean;
  onShowKeyboardHints: () => void;
}

export function RideHudControls({
  hudMode,
  onToggleHud,
  onToggleViewMode,
  effectiveIsFocus,
  canRender3d,
  onShowKeyboardHints,
}: RideHudControlsProps) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-auto">
      <button
        onClick={onToggleHud}
        className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 backdrop-blur-xl px-3 py-1.5 text-[10px] font-bold text-white/60 hover:text-white transition-colors"
        title="Cycle HUD visibility (also: H)"
        aria-label="Toggle HUD visibility"
      >
        {hudMode === "minimal" ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Show UI
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
            Hide UI
          </>
        )}
      </button>

      {hudMode !== "minimal" && (
        <>
          <button
            onClick={onShowKeyboardHints}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 backdrop-blur-xl px-3 py-1.5 text-[10px] font-bold text-white/60 hover:text-white transition-colors"
            title="Keyboard controls"
            aria-label="Show keyboard controls"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
            Keys
          </button>

          <button
            onClick={onToggleViewMode}
            className={`flex items-center gap-1.5 rounded-full border backdrop-blur-xl px-3 py-1.5 text-[10px] font-bold transition-colors ${
              !canRender3d && effectiveIsFocus
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200/70 hover:text-amber-100"
                : "border-white/15 bg-black/60 text-white/60 hover:text-white"
            }`}
            title={!canRender3d ? "Try immersive 3D anyway — will auto-switch back if slow (V)" : `Switch to ${effectiveIsFocus ? "immersive 3D" : "2D focus"} (V)`}
            aria-label={`Switch to ${effectiveIsFocus ? "immersive 3D" : "2D focus"} view`}
          >
            {effectiveIsFocus ? "3D" : "2D"}
            {!canRender3d && effectiveIsFocus && <span className="text-[8px] opacity-60">&middot; Low GPU</span>}
          </button>
        </>
      )}
    </div>
  );
}
