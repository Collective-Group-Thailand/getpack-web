import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` throws on import outside a React Server Component — that is its whole
      // job. Under Vitest it resolves to the package's own empty stub, which is the same
      // module Next serves for the `react-server` condition, so the guard still exists in
      // the build and the modules behind it stay testable.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    // next-intl's ESM build imports `next/server`, which Node cannot resolve from inside
    // pnpm's isolated store; letting Vite process the package resolves it from this app's
    // own `next` instead. Only `src/proxy.test.ts` needs it, but the cost is a transform.
    server: { deps: { inline: ["next-intl"] } },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // `e2e/journeys/*.test.ts` checks the step budgets against the scorecard (U5.0); every other
    // file under `e2e/` is a Playwright spec and never matches.
    include: ["src/**/*.{test,spec}.{ts,tsx}", "e2e/journeys/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "packages/**"],
  },
});
