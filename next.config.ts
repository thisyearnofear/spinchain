import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    "@noir-lang/noir_js",
    "@noir-lang/backend_barretenberg",
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
