import type { NextConfig } from "next";

// браузер бьёт по same-origin /api/v1/*, next пересылает на бэкенд внутри docker сети
// в dev: BACKEND_INTERNAL_URL=http://localhost:8000 (берётся из .env.local)
const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? "http://api:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // standalone собирает минимальный node рантайм, slim docker образ
  output: "standalone",

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
