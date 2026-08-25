import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Node.js runtime for all routes (no Edge — native modules like @node-rs/argon2 require Node)
  // Individual routes can override with export const runtime = "edge" if they need to
  experimental: {
    serverComponentsHmrCache: true,
  },
};

export default nextConfig;
