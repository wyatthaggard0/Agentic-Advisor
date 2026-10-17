import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The /data folder is read at request time so academic data can be refreshed without a rebuild.
  outputFileTracingIncludes: { "/api/**": ["./data/**/*"] },
};

export default nextConfig;
