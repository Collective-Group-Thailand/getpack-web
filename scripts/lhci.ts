/**
 * Runs Lighthouse CI once per URL set (`docs/performance-budgets.md`).
 *
 * `lhci autorun` takes one config, and the budgets differ per route type — 150 KB of initial
 * JS on a marketing page, 250 KB on an admin list, 180 KB on the partner PWA over 4G. So each
 * set is its own config in `lighthouse/`, they share `lighthouse/shared.json`, and this runs
 * them in turn against one server.
 *
 * One server, started here rather than by `lhci`: it has to answer all three hosts, and
 * starting and stopping it five times would add minutes to CI for nothing.
 */

import { spawn, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.LHCI_PORT ?? 3200);
const ROOT = new URL("..", import.meta.url).pathname;
const SETS = process.argv.slice(2);

/**
 * The server env. Mock mode, because Lighthouse has to measure the same thing every time and
 * a real API's latency is not that — and because the admin and partner sets need a session,
 * which the mock's fixed tokens make possible without a login flow in a Lighthouse run.
 */
const env = {
  ...process.env,
  PUBLIC_HOST: `localhost:${PORT}`,
  ADMIN_HOST: `admin.localhost:${PORT}`,
  PARTNER_HOST: `partner.localhost:${PORT}`,
  API_INTERNAL_URL: "http://127.0.0.1:4999",
  API_MOCKS: "1",
  // Measure the storefront as a visitor who has answered, so the consent banner is not in
  // every screenshot and GTM's weight is counted the way most visits will pay it.
  NEXT_PUBLIC_GTM_ID: "",
};

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await fetch(`http://localhost:${PORT}/`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`The server did not come up on port ${PORT}.`);
}

const configs = readdirSync(join(ROOT, "lighthouse"))
  .filter((file) => file.endsWith(".json") && file !== "shared.json")
  .map((file) => file.replace(/\.json$/, ""))
  .filter((name) => SETS.length === 0 || SETS.includes(name));

if (configs.length === 0) {
  console.error(`No URL set matched ${SETS.join(", ")}. Available: see lighthouse/*.json`);
  process.exit(1);
}

// Wrapped in a function rather than using top-level await: `tsx` compiles this to CJS, where
// there is no such thing.
/** Whether something already answers on the port — another worktree's `pnpm lhci`, a dev server. */
async function portTaken(): Promise<boolean> {
  try {
    await fetch(`http://localhost:${PORT}/`);
    return true;
  } catch {
    return false;
  }
}

/**
 * The set's config with its URLs on `LHCI_PORT`, written beside the original (so `extends` still
 * resolves) and removed afterwards. The checked-in configs name port 3200; running on another port
 * is how two worktrees measure at the same time without measuring each other's server.
 */
function configFor(name: string): { path: string; cleanup: () => void } {
  if (PORT === 3200) return { path: `lighthouse/${name}.json`, cleanup: () => undefined };
  const path = `lighthouse/.port-${PORT}-${name}.json`;
  writeFileSync(join(ROOT, path), readFileSync(join(ROOT, `lighthouse/${name}.json`), "utf8").replaceAll(":3200/", `:${PORT}/`));
  return { path, cleanup: () => rmSync(join(ROOT, path), { force: true }) };
}

async function main(): Promise<void> {
  // A server already on the port would be measured instead of this build — and `pnpm start` would
  // fail to bind without saying so. Refuse rather than report someone else's numbers.
  if (await portTaken()) {
    console.error(`Port ${PORT} is already in use (another \`pnpm lhci\`?). Set LHCI_PORT to a free port.`);
    process.exit(1);
  }
  const server = spawn("pnpm", ["start", "-p", String(PORT)], { cwd: ROOT, env, stdio: "ignore" });
  const failures: string[] = [];

  try {
    await waitForServer();

    for (const name of configs) {
      console.info(`\n── lighthouse: ${name} ──`);
      const config = configFor(name);
      const result = spawnSync("pnpm", ["exec", "lhci", "autorun", `--config=${config.path}`], {
        cwd: ROOT,
        env,
        stdio: "inherit",
      });
      config.cleanup();
      if (result.status !== 0) failures.push(name);
    }
  } finally {
    server.kill();
  }

  if (failures.length > 0) {
    console.error(`\nLighthouse budgets failed for: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.info("\nAll Lighthouse URL sets met their budgets.");
}

void main();
