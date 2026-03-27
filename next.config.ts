import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["next-auth", "@auth/core", "bcryptjs"],
};

export default nextConfig;
