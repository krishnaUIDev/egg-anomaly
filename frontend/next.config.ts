import type { NextConfig } from "next";

const API_BASE =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_BASE}/api/v1/:path*`,
      },
      {
        source: "/samples/:path*",
        destination: `${API_BASE}/samples/:path*`,
      },
      {
        source: "/healthz",
        destination: `${API_BASE}/healthz`,
      },
    ];
  },
};

export default nextConfig;
