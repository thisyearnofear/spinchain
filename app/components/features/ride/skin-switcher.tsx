"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { EASE_SMOOTH } from "@/app/lib/motion";
import { X, Globe, User, Bike, Palette, Sparkles } from "lucide-react";
import type { HapticType } from "@/app/hooks/use-haptic";
import type { VisualizerTheme } from "@/app/components/features/route/visualizer-theme";
import { VISUALIZER_THEMES } from "@/app/components/features/route/visualizer-theme";
import {
  getWorldModes,
} from "@/app/lib/themes/worlds";
import { useWorldAccess } from "@/app/lib/progression";
import { SELECTABLE_AVATARS, EQUIPMENT } from "@/app/lib/selection-library";
import { getLocalStorage, setLocalStorage } from "@/app/lib/utils";
import { safeParse } from "@/app/lib/utils";
import { ANALYTICS_EVENTS, trackEvent } from "@/app/lib/analytics/events";

/**
 * In-ride skin switcher — the live truth for what the ride renders.
 *
 * The URL seeds the ride; this state is what the renderers actually read.
 * Selecting here writes state (never navigates): the 3D layer is always
 * mounted and already reacts to `routeTheme`/`worldMode`/avatar/equipment
 * prop changes, so a swap is a state write, not a page load.
 */
export interface SkinSwapState {
  routeTheme: VisualizerTheme;
  /** Which mode of the swapped-to world presents it (undefined = its default). */
  worldMode?: string;
  avatarId?: string;
  equipmentId?: string;
}

const STORAGE_KEY = "spin-last-skin";

/** Persist the last skin so the next ride starts where the rider left off. */
export function readLastSkin(): Partial<SkinSwapState> | null {
  return safeParse<Partial<SkinSwapState> | null>(getLocalStorage(STORAGE_KEY), null);
}

/** Rows of the switcher. */
type RowId = "world" | "avatar" | "equipment";

const ROW_META: Record<RowId, { label: string; icon: typeof Globe }> = {
  world: { label: "World", icon: Globe },
  avatar: { label: "Rider", icon: User },
  equipment: { label: "Bike", icon: Bike },
};

/** A short veil covering a world swap — the atmosphere kit crossfades under it. */
function SwapVeil({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show ? (
        <m.div
          key="swap-veil"
          className="pointer-events-none absolute inset-0 z-20 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: EASE_SMOOTH }}
          aria-hidden="true"
        />
      ) : null}
    </AnimatePresence>
  );
}

export function SkinSwitcher({
  value,
  onChange,
  onHaptic,
}: {
  value: SkinSwapState;
  onChange: (next: SkinSwapState) => void;
  onHaptic?: (type?: HapticType) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<RowId>("world");
  const [veil, setVeil] = useState(false);
  const veilTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const worldAccess = useWorldAccess();

  // ─── Preloading (step 3) ───────────────────────────────────────
  // GLTFLoader warm-up into the same cache useGLTF reads: the first swap of
  // a skin costs no more than the second. Runs on open and on hover.
  const preloaded = useRef(new Set<string>());
  const preload = useCallback((urls: string[]) => {
    if (typeof window === "undefined") return;
    for (const url of urls) {
      if (!url || preloaded.current.has(url)) continue;
      preloaded.current.add(url);
      import("three/examples/jsm/loaders/GLTFLoader.js").then(({ GLTFLoader }) => {
        new GLTFLoader().loadAsync(url).catch(() => {
          // Warm-up only: a failed preload just means the swap pays the fetch.
          preloaded.current.delete(url);
        });
      });
    }
  }, []);

  const allAvatarUrls = useMemo(
    () =>
      SELECTABLE_AVATARS.flatMap((a) => [a.modelUrl, ...(a.clips?.map((c) => c.url) ?? [])]),
    [],
  );
  const allEquipmentUrls = useMemo(() => EQUIPMENT.map((e) => e.modelUrl), []);

  const onOpen = useCallback(() => {
    setOpen(true);
    trackEvent(ANALYTICS_EVENTS.SKIN_SWITCHER_OPENED);
    onHaptic?.("light");
    // Warm everything the switcher can offer — the lists are small.
    preload(allAvatarUrls);
    preload(allEquipmentUrls);
  }, [onHaptic, preload, allAvatarUrls, allEquipmentUrls]);

  const onHoverPreload = useCallback(
    (urls: string[]) => preload(urls),
    [preload],
  );

  useEffect(() => () => {
    if (veilTimer.current) clearTimeout(veilTimer.current);
  }, []);

  // ─── Selection handlers ────────────────────────────────────────
  const selectWorld = useCallback(
    (theme: VisualizerTheme, modeId?: string) => {
      if (!worldAccess.isUnlocked(theme)) {
        onHaptic?.("error");
        return;
      }
      trackEvent(ANALYTICS_EVENTS.SKIN_SWAPPED, { kind: "world", id: theme });
      const mode = modeId ? { id: modeId } : undefined;
      onChange({
        ...value,
        routeTheme: theme,
        // The resolver falls back to the world's default mode for an
        // unknown id — a bad reference must never take the ride down.
        worldMode: mode?.id,
      });
      onHaptic?.("medium");
      // World swaps change the whole atmosphere kit — cover the swap with
      // the 0.22s veil; avatar/equipment swaps need no veil.
      setVeil(true);
      if (veilTimer.current) clearTimeout(veilTimer.current);
      veilTimer.current = setTimeout(() => setVeil(false), 240);
    },
    [value, onChange, onHaptic, worldAccess],
  );

  const selectAvatar = useCallback(
    (id: string) => {
      trackEvent(ANALYTICS_EVENTS.SKIN_SWAPPED, { kind: "avatar", id });
      onChange({ ...value, avatarId: id });
      onHaptic?.("light");
    },
    [value, onChange, onHaptic],
  );

  const selectEquipment = useCallback(
    (id: string) => {
      trackEvent(ANALYTICS_EVENTS.SKIN_SWAPPED, { kind: "equipment", id });
      onChange({ ...value, equipmentId: id });
      onHaptic?.("light");
    },
    [value, onChange, onHaptic],
  );

  // Persist the last skin (step 4).
  useEffect(() => {
    setLocalStorage(STORAGE_KEY, JSON.stringify(value));
  }, [value]);

  const rows: RowId[] = ["world", "avatar", "equipment"];

  return (
    <>
      {/* Trigger — bottom-right, above the coach channel. */}
      <m.button
        type="button"
        onClick={onOpen}
        className="absolute bottom-24 right-4 z-30 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/55 backdrop-blur transition-colors hover:bg-black/70 md:bottom-6"
        whileTap={{ scale: 0.92 }}
        aria-label="Change your skin"
      >
        <Sparkles className="h-5 w-5 text-white/80" aria-hidden="true" />
      </m.button>

      <AnimatePresence>
        {open ? (
          <m.div
            key="skin-switcher"
            className="absolute inset-x-3 bottom-20 z-40 mx-auto max-w-md rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur md:bottom-16 md:right-4 md:left-auto md:w-96"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: EASE_SMOOTH }}
            role="dialog"
            aria-label="Skin switcher"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex gap-1.5">
                {rows.map((r) => {
                  const Icon = ROW_META[r].icon;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRow(r)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                        row === r
                          ? "bg-white/15 text-white"
                          : "text-white/50 hover:text-white/80"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {ROW_META[r].label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
                aria-label="Close skin switcher"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {row === "world" ? (
              <WorldRow
                value={value}
                onSelect={selectWorld}
                onHover={onHoverPreload}
                isUnlocked={worldAccess.isUnlocked}
                unlockLabel={(theme) => {
                  const unlock = worldAccess.unlockFor(theme);
                  return unlock ? `Rank ${(unlock.rankIndex ?? 0) + 1}` : "";
                }}
              />
            ) : null}
            {row === "avatar" ? (
              <AvatarRow
                value={value}
                onSelect={selectAvatar}
                onHover={onHoverPreload}
              />
            ) : null}
            {row === "equipment" ? (
              <EquipmentRow
                value={value}
                onSelect={selectEquipment}
                onHover={onHoverPreload}
              />
            ) : null}
          </m.div>
        ) : null}
      </AnimatePresence>

      {/* The veil lives over the whole ride surface, not inside the panel. */}
      <SwapVeil show={veil} />
    </>
  );
}

function WorldRow({
  value,
  onSelect,
  onHover,
  isUnlocked,
  unlockLabel,
}: {
  value: SkinSwapState;
  onSelect: (theme: VisualizerTheme, modeId?: string) => void;
  onHover: (urls: string[]) => void;
  isUnlocked: (theme: string) => boolean;
  unlockLabel: (theme: string) => string;
}) {
  // Every registered (world, mode) pair, deduped by palette — the same
  // contract the home picker reads. Modes of the current world are offered
  // as moods under the world card.
  const cards = useMemo(
    () =>
      Array.from(
        new Map(getWorldModes().map(({ world, mode }) => [mode.themeName, { world, mode }])).values(),
      ),
    [],
  );

  return (
    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
      {cards.map(({ world, mode }) => {
        const theme = mode.themeName as VisualizerTheme;
        const styles = VISUALIZER_THEMES[theme];
        if (!styles) return null;
        const unlocked = isUnlocked(theme);
        const active = value.routeTheme === theme;
        const modes = world.modes;
        return (
          <div key={theme}>
            <button
              type="button"
              onClick={() => onSelect(theme, mode.id)}
              onMouseEnter={() => onHover([])}
              className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                active
                  ? "border-white/30 bg-white/10"
                  : "border-white/10 hover:bg-white/5"
              } ${unlocked ? "" : "opacity-60"}`}
            >
              <span
                className="h-9 w-9 shrink-0 rounded-lg"
                style={{
                  background: `linear-gradient(to bottom, ${styles.skyTop}, ${styles.skyBottom})`,
                }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">
                  {styles.worldLabel}
                </span>
                <span className="block truncate text-xs text-white/60">
                  {unlocked
                    ? world.summary
                    : `Unlocks at ${unlockLabel(theme)}`}
                </span>
              </span>
              {active ? <Palette className="h-4 w-4 shrink-0 text-white/70" aria-hidden="true" /> : null}
            </button>
            {/* Moods of the active world: same place, different weather. */}
            {active && modes.length > 1 ? (
              <div className="mt-1 flex gap-1.5 pl-12">
                {modes.map((m2) => (
                  <button
                    key={m2.id}
                    type="button"
                    onClick={() => onSelect(theme, m2.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      (value.worldMode ?? modes[0]?.id) === m2.id
                        ? "bg-white/20 text-white"
                        : "bg-white/5 text-white/60 hover:text-white"
                    }`}
                  >
                    {m2.label}
                  </button>
                ))}
              </div> 
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function AvatarRow({
  value,
  onSelect,
  onHover,
}: {
  value: SkinSwapState;
  onSelect: (id: string) => void;
  onHover: (urls: string[]) => void;
}) {
  return (
    <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1">
      {SELECTABLE_AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onSelect(a.id)}
          onMouseEnter={() => onHover([a.modelUrl, ...(a.clips?.map((c) => c.url) ?? [])])}
          className={`rounded-xl border p-2 text-center transition-colors ${
            value.avatarId === a.id
              ? "border-white/30 bg-white/10"
              : "border-white/10 hover:bg-white/5"
          }`}
        >
          <span className="mx-auto mb-1.5 block h-10 w-10 overflow-hidden rounded-lg bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element -- deliberate: raw img with onError hide, like the world cards */}
            <img
              src={a.thumbnail}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </span>
          <span className="block truncate text-xs font-bold text-white">{a.name}</span>
        </button>
      ))}
    </div>
  );
}

function EquipmentRow({
  value,
  onSelect,
  onHover,
}: {
  value: SkinSwapState;
  onSelect: (id: string) => void;
  onHover: (urls: string[]) => void;
}) {
  return (
    <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1">
      {EQUIPMENT.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => onSelect(e.id)}
          onMouseEnter={() => onHover([e.modelUrl])}
          className={`rounded-xl border p-2 text-center transition-colors ${
            value.equipmentId === e.id
              ? "border-white/30 bg-white/10"
              : "border-white/10 hover:bg-white/5"
          }`}
        >
          <span className="mx-auto mb-1.5 block h-10 w-10 overflow-hidden rounded-lg bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element -- deliberate: raw img with onError hide */}
            <img
              src={e.thumbnail}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </span>
          <span className="block truncate text-xs font-bold text-white">{e.name}</span>
        </button>
      ))}
    </div>
  );
}
