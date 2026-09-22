import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CLAUDE.md in this repo is hand-written project documentation (see its "Read before
  // every task" list); Next 16 would otherwise overwrite it with generated agent rules.
  agentRules: false,
};

export default nextConfig;
