import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Allow large file uploads
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
