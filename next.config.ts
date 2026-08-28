import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Next.js dev-mode indicator (floating button, top-left) was mistaken
  // for an app bug during the ride activation countdown investigation.
  // Dev-only either way; hidden to keep the corner of the viewport clean.
  devIndicators: false,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    "@noir-lang/noir_js",
    "@aztec/bb.js",
    "@noir-lang/acvm_js",
    "@noir-lang/noirc_abi",
  ],
  experimental: {
  },
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        "@react-native-async-storage/async-storage": false,
        "pino-pretty": false,
      };
      // Support WASM modules from @noir-lang packages
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    }

    return config;
  },
};

export default nextConfig;
