import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export', // Removed for API routes support
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
