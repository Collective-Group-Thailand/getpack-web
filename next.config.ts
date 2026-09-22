import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CLAUDE.md in this repo is hand-written project documentation (see its "Read before
  // every task" list); Next 16 would otherwise overwrite it with generated agent rules.
  agentRules: false,
  // The workspace package is shipped as TypeScript source for local development;
  // publishConfig points the published copy at dist/ instead.
  transpilePackages: ["@packio/dieline"],
  async redirects() {
    return [
      // BoxStudio's "My designs" lives under the customer account area now.
      { source: "/my/designs", destination: "/account/designs", permanent: true },
      { source: "/en/my/designs", destination: "/en/account/designs", permanent: true },
    ];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
