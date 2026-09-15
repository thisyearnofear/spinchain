/**
 * Copies the Rive WASM runtime into public/ so it is served statically (and
 * bundled into the Capacitor shell) instead of fetched from the unpkg CDN on
 * first Rive mount (~1.9 MB, fails offline).
 *
 * Runs on postinstall so the copy always matches the installed
 * @rive-app/canvas version. Consumed via RuntimeLoader.setWasmUrl("/rive/rive.wasm")
 * in app/components/features/ride/rive-runtime.ts.
 */
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// @rive-app/canvas is a transitive dependency of @rive-app/react-canvas, so
// resolve it from the react-canvas package context. realpathSync unwraps the
// pnpm symlink so Node's resolver sees the real .pnpm node_modules layout.
const reactCanvasPkg = realpathSync(
  join(root, "node_modules/@rive-app/react-canvas/package.json"),
);
const requireFromReactCanvas = createRequire(reactCanvasPkg);
const canvasPkgJson = requireFromReactCanvas.resolve("@rive-app/canvas/package.json");
const wasmSrc = join(dirname(canvasPkgJson), "rive.wasm");

const destDir = join(root, "public", "rive");
mkdirSync(destDir, { recursive: true });
copyFileSync(wasmSrc, join(destDir, "rive.wasm"));
console.log(`rive: copied WASM runtime → public/rive/rive.wasm`);
