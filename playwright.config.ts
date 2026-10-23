import { defineConfig, devices, type ReporterDescription } from "@playwright/test";

/**
 * Which backend the app under test talks to. `mock` (default): the in-process MSW mock API with
 * its fixtures (`API_MOCKS=1`). `real`: a getpack-api at `INTEGRATION_API_URL`
 * (`pnpm e2e:integration`, U-F0.5, `docs/integration.md`). An environment variable rather than
 * argv, because Playwright re-evaluates this file in every worker with different arguments.
 */
const REAL_BACKEND = process.env.E2E_BACKEND === "real";

// Deliberately not 3000: `pnpm dev` is for humans, the suite gets its own port so a
// dev server (ours or another project's) can never make the run pass or fail by accident. The
// real-backend run has another, so a mock-backed build left running is never reused by it.
const PORT = Number(process.env.E2E_PORT ?? (REAL_BACKEND ? 3500 : 3100));
const baseURL = `http://localhost:${PORT}`;

/** The static Storybook build the visual-snapshot project is served from. */
const STORYBOOK_PORT = Number(process.env.STORYBOOK_PORT ?? 3300);

/**
 * Whether this invocation includes the visual project.
 *
 * Only used to decide whether to start Storybook, which happens in the main process where
 * argv is what was typed. The *project list* cannot be built this way — see the note there.
 */
const runningVisualProject = process.argv.some((arg) => arg.includes("visual"));

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

/** Every first-run hint the storefront shows once (`useFirstRun` keys). */
export const FIRST_RUN_KEYS = ["studio-coach-v1", "intent-v1"] as const;

const zoneEnv = {
  PUBLIC_HOST: `localhost:${PORT}`,
  ADMIN_HOST: `admin.localhost:${PORT}`,
  PARTNER_HOST: `partner.localhost:${PORT}`,
  // Deliberately a port nothing listens on: MSW intercepts in-process, so nothing should
  // ever reach the network. If an interception is missed, the call fails fast and loudly
  // rather than quietly finding some other service.
  API_INTERNAL_URL: "http://127.0.0.1:4999",
  // Starts the mock API from src/instrumentation.ts, so the auth flows have a backend.
  API_MOCKS: "1",
  /*
   * A container id, so the consent tests are not vacuous.
   *
   * Without one `GoogleTagManager` renders nothing and "no tag fired before consent" passes
   * for the wrong reason. With it, the consent-default script is really on the page and the
   * assertion is really about the gate. Nothing reaches Google: the test only checks the
   * refusal path, and the id is obviously fake.
   */
  NEXT_PUBLIC_GTM_ID: "GTM-TEST0000",
  // getpack Assistant built in (U5.5) so its panel is tested; production builds leave it out (D-218).
  NEXT_PUBLIC_ASSISTANT: "1",
};

/** The same build against a real getpack-api: no mock, the API the integration stack started. */
const realEnv = {
  PUBLIC_HOST: `localhost:${PORT}`,
  ADMIN_HOST: `admin.localhost:${PORT}`,
  PARTNER_HOST: `partner.localhost:${PORT}`,
  API_INTERNAL_URL: process.env.INTEGRATION_API_URL ?? "http://localhost:3400",
  // Built in, so the real API's own refusal (off at launch, D-218) is what the panel shows.
  NEXT_PUBLIC_ASSISTANT: "1",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // The journey reporter only writes when step counters ran (`e2e/journeys/reporter.ts`).
  reporter: [
    ...((process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]]) satisfies ReporterDescription[]),
    ["./e2e/journeys/reporter.ts"],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    // First-run hints (U5.2) are marked seen, so a coach mark never sits over what an older test
    // clicks; the first-run tests clear this with their own empty storage state.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: FIRST_RUN_KEYS.map((name) => ({ name: `getpack.firstRun.${name}`, value: "1" })),
        },
      ],
    },
    launchOptions: { args: ["--host-resolver-rules=MAP *.localhost 127.0.0.1"] },
  },
  /*
   * Screenshots are rasterised differently on macOS and Linux, so a baseline is only valid on
   * the platform that produced it. Keying the path by platform means both can live side by
   * side: a developer's local baselines and CI's Linux ones.
   */
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{arg}{ext}",

  projects: REAL_BACKEND
    ? [
        /*
         * The launch path on a real getpack-api (U-F0.5). Its specs create their own data on the dev
         * seed; the setup project first provisions what the seed lacks (factory users, customers)
         * through the API, into `e2e/integration/.state/`. Only these exist in a real-backend run,
         * so a spec written against the mock's fixtures can never run against the real API.
         */
        { name: "integration-setup", testMatch: /integration\/global\.setup\.ts/ },
        {
          name: "integration",
          testMatch: /integration\/.*\.spec\.ts/,
          dependencies: ["integration-setup"],
          use: { ...devices["Desktop Chrome"] },
        },
      ]
    : [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
          // The mock project: every spec here is written against the mock API's fixtures.
          testIgnore: [/visual\.spec\.ts/, /journeys\//, /integration\//, /studio-perf\.spec\.ts/],
        },
        /*
         * The studio's orbit performance (U4.3): measured alone (`pnpm e2e:perf`, one worker), so the
         * frame rate is the studio's and not the load of the rest of the suite running beside it.
         */
        {
          name: "perf",
          testMatch: /studio-perf\.spec\.ts/,
          use: { ...devices["Desktop Chrome"] },
        },
        /*
         * Step counters for the scorecard's tasks T1–T12 (U5.0, `e2e/journeys/`). Registered always,
         * like `visual`, and reached through `pnpm e2e:journeys`. They walk the same mock-backed build
         * as the suite; mobile tasks (T7 in LINE, T11 on the floor) set their own phone viewport.
         */
        {
          name: "journeys",
          testMatch: /journeys\/.*\.spec\.ts/,
          use: { ...devices["Desktop Chrome"] },
        },
        /*
         * Visual snapshots, against the built Storybook rather than the app — see
         * `e2e/visual.spec.ts`.
         *
         * Always registered, never in the default run. Playwright re-evaluates this config in
         * every worker with different argv, so a project added conditionally exists in the main
         * process and not in the worker ("Project 'visual' not found in the worker process").
         * `pnpm e2e` therefore names `--project=chromium`, and this one is reached through
         * `pnpm e2e:visual` — which needs `pnpm build-storybook` first.
         */
        {
          name: "visual",
          testMatch: /visual\.spec\.ts/,
          use: {
            ...devices["Desktop Chrome"],
            baseURL: `http://localhost:${STORYBOOK_PORT}`,
          },
        },
      ],
  webServer: [
    // Storybook is only started when the visual project is actually being run. Playwright has
    // no per-project servers, so without this check every `pnpm e2e` would build and serve
    // Storybook as well — minutes of CI for a suite that does not use it.
    ...(runningVisualProject
      ? [
          {
            // `-c-1` disables caching. Without it http-server sends an hour of `max-age`, the
            // browser serves the previous build's JS, and the snapshots pass against a
            // Storybook that is no longer on disk — which is exactly how this was found.
            command: `pnpm exec http-server storybook-static -p ${STORYBOOK_PORT} -c-1 --silent`,
            url: `http://localhost:${STORYBOOK_PORT}/iframe.html`,
            // A developer with `pnpm storybook` already up is not blocked; CI serves the
            // built site, which is what the baselines were taken from.
            reuseExistingServer: true,
            timeout: 60_000,
          },
        ]
      : []),
    // The visual project reads Storybook only; building the app for it would cost CI minutes.
    ...(runningVisualProject
      ? []
      : [
          {
            // A production build locally as well as in CI. The security assertions in
            // e2e/zones.spec.ts are about what ships — and `pnpm dev` legitimately has a different
            // CSP, because Turbopack's injected styles cannot be nonced — so testing the dev server
            // would give false confidence in both directions.
            command: `pnpm build && pnpm start -p ${PORT}`,
            url: baseURL,
            reuseExistingServer: !process.env.CI,
            // The build is part of the wait: a cold CI build (type check included) takes minutes.
            timeout: process.env.CI ? 900_000 : 300_000,
            // `next start` runs with NODE_ENV=production, where the env schema has no defaults —
            // which is the point of the schema, so the suite supplies real values.
            env: REAL_BACKEND ? realEnv : zoneEnv,
          },
        ]),
  ],
});
