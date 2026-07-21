import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@adobe/react-spectrum", "@spectrum-icons/workflow"]
  }
};

export default nextConfig;
