import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @payproof/* export TS sources (no build step).
  transpilePackages: ["@payproof/api-client", "@payproof/design-tokens", "@payproof/mocks"],
  // @payproof/mocks imports ../../fixtures/*.json — the root must be the monorepo.
  turbopack: { root: path.join(import.meta.dirname, "../..") },
  // Agent instructions live in CLAUDE.md; don't let `next dev` generate AGENTS.md.
  agentRules: false,
  // The default bottom-left spot covers the sidebar's collapse button.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
