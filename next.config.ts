import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Next.js dev-mode indicator (floating button, top-left) was mistaken
  // for an app bug during the ride activation countdown investigation.
  // Dev-only either way; hidden to keep the corner of the viewport clean.
  devIndicators: false,
  images: {
    unoptimized: true,
  },
  // ZK proving is browser-only (see docs/OPERATIONS.md §5). Keep packages
  // external on the server so a mistaken SSR import does not bundle them.
  serverExternalPackages: [
    "@noir-lang/noir_js",
    "@aztec/bb.js",
    "@noir-lang/acvm_js",
    "@noir-lang/noirc_abi",
  ],
  // Safety net: never trace native bb binaries / non-app trees into lambdas.
  // @aztec/bb.js/build alone is ~126MB across arches.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@aztec/bb.js/build/**",
      "node_modules/@aztec/bb.js/dest/node/**",
      "node_modules/@aztec/bb.js/dest/node-cjs/**",
      "node_modules/@aztec/bb.js/src/**",
      "node_modules/@noir-lang/**",
      "contracts/**",
      "circuits/**",
      "rive/**",
      "ios/**",
      "android/**",
      "mobile/**",
      "playwright-report/**",
      "test-results/**",
      "tests/**",
      "**/*.map",
    ],
  },
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
