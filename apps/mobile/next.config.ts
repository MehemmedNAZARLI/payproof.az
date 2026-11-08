import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Shared workspace packages ship TypeScript source, not a build.
  transpilePackages: ["@payproof/design-tokens"],
  // Agent guidance lives in apps/mobile/CLAUDE.md; don't let `next dev` generate AGENTS.md.
  agentRules: false,
};

export default nextConfig;
