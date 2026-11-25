import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // data/ dibaca server lewat fs (bukan import), jadi harus diikutkan eksplisit saat build standalone/serverless.
  outputFileTracingIncludes: {
    "/api/**": ["./data/**/*"],
    "/desa/**": ["./data/index.json"],
  },
  outputFileTracingExcludes: {
    "*": ["./wilayah_boundaries-2025.7/**"],
  },
};

export default nextConfig;
