import path from "node:path";

import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @payproof/* export TS sources (no build step).
  transpilePackages: ["@payproof/api-client", "@payproof/mocks"],
  // @payproof/mocks imports ../../fixtures/*.json — the root must be the monorepo.
  turbopack: { root: path.join(import.meta.dirname, "../..") },
  // Agent guidance lives in apps/mobile/CLAUDE.md; don't let `next dev` generate AGENTS.md.
  agentRules: false,
};

export default withSerwist(nextConfig);
