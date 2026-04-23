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
};

export default nextConfig;
