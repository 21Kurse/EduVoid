import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't walk up to the home dir
  // (a stray lockfile above the repo would be silently ignored/warned).
  // next.config.ts is always loaded from the project root, so cwd is correct.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
