/**
 * `pnpm build` / `pnpm start` on a machine set up for the dev-only interim home photos
 * (PROGRESS 2026-10-07): `pnpm build:local`, `pnpm start:local`.
 *
 * Two guards refuse production mode there, both on purpose: the photos under
 * `public/media/home/` are `interim-unverified` (`build-checks/no-untracked-third-party-assets.mjs`,
 * which `next.config.ts` runs for `next build` and `next start` alike), and
 * `HOME_PHOTOS_LOCAL_MANIFEST=1` from `.env` / `.env.local` is refused by the env schema.
 * This sets the folder aside and clears the flag for the one command, then puts the folder back —
 * also when the command fails or is interrupted. A build made this way never contains the photos,
 * so it is the same build CI makes; the guards themselves are untouched.
 */

import { spawn } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { constants as osConstants } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PHOTOS = join(ROOT, "public", "media", "home");
// Outside public/ (nothing under it is served or checked) and gitignored.
const ASIDE = join(ROOT, ".home-photos-aside");

const [script, ...args] = process.argv.slice(2);
if (script !== "build" && script !== "start") {
  console.error("usage: tsx scripts/without-interim-photos.ts <build|start> [args...]");
  process.exit(1);
}

// A previous run that was killed outright left the folder aside: bring it back first.
if (existsSync(ASIDE) && !existsSync(PHOTOS)) renameSync(ASIDE, PHOTOS);
if (existsSync(ASIDE)) {
  console.error(`${script}:local: both ${PHOTOS} and ${ASIDE} exist; resolve that by hand first.`);
  process.exit(1);
}

const setAside = existsSync(PHOTOS);
if (setAside) renameSync(PHOTOS, ASIDE);

function restore(): void {
  if (setAside && existsSync(ASIDE)) renameSync(ASIDE, PHOTOS);
}

const child = spawn("pnpm", [script, ...args], {
  cwd: ROOT,
  stdio: "inherit",
  // Empty means unset to the env schema, and a key already in the environment wins over .env files.
  env: { ...process.env, HOME_PHOTOS_LOCAL_MANIFEST: "" },
});

// Ctrl+C reaches the child through the terminal, a plain `kill` of this process does not: pass it
// on either way, and restore only once the child has exited, so `next` never runs unwatched.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  console.error(error);
  restore();
  process.exit(1);
});
child.on("exit", (code, signal) => {
  restore();
  process.exit(code ?? (signal ? 128 + osConstants.signals[signal] : 1));
});
