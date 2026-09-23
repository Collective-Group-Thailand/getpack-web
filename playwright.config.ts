import { defineConfig, devices } from "@playwright/test";

// Deliberately not 3000: `pnpm dev` is for humans, the suite gets its own port so a
// dev server (ours or another project's) can never make the run pass or fail by accident.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

/**
 * The three zone hosts, as the suite reaches them. Chromium resolves `*.localhost` to
 * loopback by itself, but the glibc resolver on CI does not, so `--host-resolver-rules`
 * makes it the browser's decision rather than the machine's.
 */
export const HOSTS = {
  customer: baseURL,
  admin: `http://admin.localhost:${PORT}`,
  partner: `http://partner.localhost:${PORT}`,
};

const zoneEnv = {
  PUBLIC_HOST: `localhost:${PORT}`,
  ADMIN_HOST: `admin.localhost:${PORT}`,
  PARTNER_HOST: `partner.localhost:${PORT}`,
  API_INTERNAL_URL: "http://127.0.0.1:4999",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    launchOptions: { args: ["--host-resolver-rules=MAP *.localhost 127.0.0.1"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A production build locally as well as in CI. The security assertions in
    // e2e/zones.spec.ts are about what ships — and `pnpm dev` legitimately has a different
    // CSP, because Turbopack's injected styles cannot be nonced — so testing the dev server
    // would give false confidence in both directions.
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // `next start` runs with NODE_ENV=production, where the env schema has no defaults —
    // which is the point of the schema, so the suite supplies real values.
    env: zoneEnv,
  },
});
