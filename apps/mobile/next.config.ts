import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Agent guidance lives in apps/mobile/CLAUDE.md; don't let `next dev` generate AGENTS.md.
  agentRules: false,
};

export default nextConfig;
