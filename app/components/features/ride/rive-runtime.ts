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
import { RuntimeLoader } from "@rive-app/react-canvas";

RuntimeLoader.setWasmUrl("/rive/rive.wasm");
