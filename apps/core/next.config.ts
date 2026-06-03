import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    middlewareClientMaxBodySize: "50mb",
  },
  serverExternalPackages: ["xlsx"],
  transpilePackages: [
    "@mizan/database",
    "@mizan/shared-lib",
    "@mizan/shared-ui",
  ],
};

export default nextConfig;
