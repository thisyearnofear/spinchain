"use client";

/**
 * Rive runtime bootstrap.
 *
 * Self-hosts the Rive WASM runtime: by default @rive-app/canvas fetches
 * ~1.9 MB of WASM from the unpkg CDN on first mount (with a jsdelivr retry),
 * which stalls first render and fails outright in the offline Capacitor
 * shell. The WASM is copied to public/rive/rive.wasm by
 * scripts/copy-rive-wasm.mjs (postinstall) and always matches the installed
 * runtime version.
 *
 * This must run before any Rive instance is created, so every Rive wrapper
 * imports this module for its side effect.
 */
import { useState } from "react";
import { RuntimeLoader } from "@rive-app/react-canvas";

RuntimeLoader.setWasmUrl("/rive/rive.wasm");

/**
 * Per-instance cache-busted .riv URL.
 *
 * The wasm runtime caches imported .riv files by URL, and destroying an
 * instance poisons its URL's entry: a later instance created on the same URL
 * loads but silently loses state-machine trigger transitions (verified on
 * @rive-app/canvas 2.44.1 — the ride HUD mounts a rider, unmounts it on the
 * loading→HUD swap, and the next rider then never bursts). A random query
 * string per component mount means a poisoned URL is never reused: React
 * remounts always re-run the state initializer. Requires reactStrictMode:
 * false (next.config.ts) — StrictMode's dev double-mount shares one state
 * instance and would recreate on the same, just-poisoned URL.
 */
export function useRivSrc(base: string): string {
  const [src] = useState(() => `${base}?i=${Math.random().toString(36).slice(2, 8)}`);
  return src;
}
