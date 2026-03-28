import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/generated/:path*',
        destination: '/api/generated/:path*',
      },
    ]
  },
};

export default nextConfig;
