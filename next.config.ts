import type { NextConfig } from "next";
import path from "path";
import { existsSync } from "fs";

function findRoot(dir: string): string {
  if (existsSync(path.join(dir, "node_modules", "next", "package.json"))) return dir;
  const parent = path.dirname(dir);
  if (parent === dir) return dir;
  return findRoot(parent);
}

const nextConfig: NextConfig = {
  turbopack: {
    root: findRoot(path.resolve(__dirname)),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
