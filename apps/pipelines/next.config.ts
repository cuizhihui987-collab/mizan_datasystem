import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@mizan/database",
    "@mizan/shared-lib",
    "@mizan/shared-ui",
  ],
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
