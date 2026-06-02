/**
 * gpu-probe.ts — WebGL / WebGPU capability detection.
 *
 * Pure function utilities (no React, no hooks) so the VisualizationEngine
 * can probe synchronously at construction time.  Wraps the existing
 * `usePerformanceTier` / `useAdaptiveQuality` hooks from responsive.ts
 * by exposing a procedural API that can be called outside components.
 *
 * Probe results are memoised per window session so repeated calls are free.
 */

export type GpuVendor =
  | "apple-gpu"
  | "adreno"
  | "mali"
  | "intel-hd"
  | "nvidia"
  | "amd"
  | "unknown";

export interface GpuCapability {
  /** WebGL 2 is available */
  webgl2: boolean;
  /** WebGPU is available (Chrome 113+, Edge 113+) */
  webgpu: boolean;
  /** Renderer string from WEBGL_debug_renderer_info */
  renderer: string;
  /** Normalised vendor classifier */
  vendor: GpuVendor;
  /** MAX_TEXTURE_SIZE reported by the context */
  maxTextureSize: number;
  /** Number of hardware cores (navigator.hardwareConcurrency) */
  cores: number;
  /** Device memory in GiB (navigator.deviceMemory) */
  memoryGb: number;
  /** Overall render mode recommendation */
  recommendedMode: "tron-3d" | "focus-2d";
  /** Whether the device is considered "low-end" for 3D rendering */
  isLowEnd: boolean;
  /** Whether the device can safely run post-processing (bloom, SSAO) */
  canPostProcess: boolean;
}

// ─── Probe (synchronous) ────────────────────────────────────────

let cached: GpuCapability | null = null;

/**
 * Probe GPU capabilities synchronously.
 * Results are cached for the window session — call as often as needed.
 */
export function probeGpu(): GpuCapability {
  if (cached && typeof window !== "undefined") return cached;

  const ctx = createWebglCtx();
  const webgl2 = !!(ctx && typeof (ctx as WebGL2RenderingContext).texStorage2D === "function");

  const renderer = getRendererString(ctx);
  const vendor = classifyVendor(renderer);

  const maxTextureSize = ctx ? ctx.getParameter(ctx.MAX_TEXTURE_SIZE) : 0;
  const cores = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4;
  const memoryGb = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;

  // Determine low-end based on vendor, cores, memory
  const isLowEnd =
    vendor === "intel-hd" ||
    vendor === "mali" ||
    cores <= 4 ||
    memoryGb <= 4 ||
    maxTextureSize < 4096;

  const canPostProcess = !isLowEnd && webgl2 && maxTextureSize >= 8192;

  const recommendedMode: GpuCapability["recommendedMode"] =
    isLowEnd || (!webgl2 && maxTextureSize < 2048) ? "focus-2d" : "tron-3d";

  const cap: GpuCapability = {
    webgl2,
    webgpu: detectWebGpu(),
    renderer,
    vendor,
    maxTextureSize,
    cores,
    memoryGb,
    recommendedMode,
    isLowEnd,
    canPostProcess,
  };

  if (typeof window !== "undefined") cached = cap;
  return cap;
}

// ─── Helpers ────────────────────────────────────────────────────

function createWebglCtx(): WebGLRenderingContext | WebGL2RenderingContext | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    return (canvas.getContext("webgl") ||
      canvas.getContext("webgl2") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
  } catch {
    return null;
  }
}

function getRendererString(gl: WebGLRenderingContext | null): string {
  if (!gl) return "";
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) {
      return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
    }
  } catch {
    // Extension not available
  }
  return "";
}

function classifyVendor(renderer: string): GpuVendor {
  if (/Apple GPU/i.test(renderer)) return "apple-gpu";
  if (/Adreno/i.test(renderer)) return "adreno";
  if (/Mali/i.test(renderer)) return "mali";
  if (/Intel HD/i.test(renderer)) return "intel-hd";
  if (/Intel Iris/i.test(renderer)) return "apple-gpu"; // Iris is also capable
  if (/NVIDIA|GeForce|RTX|GTX/i.test(renderer)) return "nvidia";
  if (/AMD|Radeon/i.test(renderer)) return "amd";
  return "unknown";
}

function detectWebGpu(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

// ─── Quality helper (mirrors useAdaptiveQuality for server-side) ──

export interface QualitySettings {
  pixelRatio: number;
  shadows: boolean;
  antialiasing: boolean;
  particleCount: number;
  meshDetail: "low" | "medium" | "high";
  fps: number;
  enableBloom: boolean;
  enableSSAO: boolean;
}

/**
 * Returns quality settings based on the GPU probe result.
 * This is the procedural equivalent of the useAdaptiveQuality hook,
 * intended for the VisualizationEngine to use outside React.
 */
export function getQualitySettings(cap?: GpuCapability): QualitySettings {
  const probe = cap ?? probeGpu();

  if (probe.recommendedMode === "focus-2d" || probe.isLowEnd) {
    return {
      pixelRatio: 1,
      shadows: false,
      antialiasing: false,
      particleCount: 50,
      meshDetail: "low",
      fps: 30,
      enableBloom: false,
      enableSSAO: false,
    };
  }

  if (probe.webgl2 && probe.maxTextureSize >= 8192 && probe.cores >= 6) {
    return {
      pixelRatio: Math.min(
        (typeof window !== "undefined" ? window.devicePixelRatio : 1),
        2,
      ),
      shadows: true,
      antialiasing: true,
      particleCount: 500,
      meshDetail: "high",
      fps: probe.webgpu ? 120 : 60,
      enableBloom: true,
      enableSSAO: probe.vendor !== "intel-hd",
    };
  }

  // Medium
  return {
    pixelRatio: 1,
    shadows: false,
    antialiasing: true,
    particleCount: 200,
    meshDetail: "medium",
    fps: 45,
    enableBloom: false,
    enableSSAO: false,
  };
}
