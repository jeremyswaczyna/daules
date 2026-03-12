import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow up to 12 MB file uploads through the /api/upload route
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
