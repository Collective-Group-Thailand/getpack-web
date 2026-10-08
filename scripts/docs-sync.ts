/**
 * Keeps the documents both repositories share identical to packio-api's — never copied by hand
 * (packio-api Phase 4 review, 2026-10-08).
 *
 *   pnpm docs:sync                 take them at the packio-api tag this app is pinned to (contract.lock.json)
 *   pnpm docs:sync --tag vX.Y.Z    take them at another tagged packio-api release
 *   pnpm docs:sync --check         fail if a synced document was edited here or the lock is stale (CI, offline)
 *
 * The backend owns these documents (api-conventions §1, decisions.md header). They are read from a
 * tagged release — `git show <tag>:<path>` in the sibling checkout named by contract.lock.json's
 * `localSource` (override with PACKIO_API_DIR) — never from packio-api's working tree, which runs
 * ahead of its last release. Each file gets a one-line banner; `docs/shared-docs.lock.json` records
 * the tag, the commit and the sha256 of the bytes taken, so `--check` needs no sibling checkout.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_LOCK = resolve(ROOT, "contract.lock.json");
const DOCS_LOCK = resolve(ROOT, "docs/shared-docs.lock.json");

/** Shared documents: the same path in both repositories. */
const SHARED = ["docs/decisions.md", "docs/contract/api-conventions.md"] as const;

interface DocsLock {
  $comment: string;
  tag: string;
  commit: string;
  files: Record<string, string>;
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

const banner = (tag: string) =>
  `<!-- Synced from packio-api ${tag} by \`pnpm docs:sync\` — do not edit here; change it in packio-api. -->\n`;

/** The document without the banner line this script adds. */
function body(text: string): string {
  return text.startsWith("<!-- Synced from packio-api ") ? text.slice(text.indexOf("\n") + 1) : text;
}

function fail(message: string): never {
  console.error(`docs:sync: ${message}`);
  process.exit(1);
}

function apiCheckout(): string {
  if (process.env.PACKIO_API_DIR) return resolve(process.env.PACKIO_API_DIR);
  const lock = JSON.parse(readFileSync(CONTRACT_LOCK, "utf8")) as { localSource: string };
  // localSource is `<checkout>/contract/openapi.json`.
  return resolve(ROOT, dirname(dirname(lock.localSource)));
}

function check(): void {
  if (!existsSync(DOCS_LOCK)) fail("docs/shared-docs.lock.json is missing — run `pnpm docs:sync`");
  const lock = JSON.parse(readFileSync(DOCS_LOCK, "utf8")) as DocsLock;
  const stale: string[] = [];
  for (const path of SHARED) {
    const text = readFileSync(resolve(ROOT, path), "utf8");
    if (!text.startsWith(banner(lock.tag)) || sha256(body(text)) !== lock.files[path]) stale.push(path);
  }
  if (stale.length > 0)
    fail(`${stale.join(", ")} differ from packio-api ${lock.tag} — edit them in packio-api, then \`pnpm docs:sync\``);
  console.log(`docs:sync: ${SHARED.length} shared documents match packio-api ${lock.tag}`);
}

function sync(tagArg: string | undefined): void {
  const pinned = JSON.parse(readFileSync(CONTRACT_LOCK, "utf8")) as { tag?: string };
  const tag = tagArg ?? pinned.tag;
  if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) fail(`a release tag (vX.Y.Z) is needed, got ${tag ?? "none"}`);
  const api = apiCheckout();
  const git = (...args: string[]) => execFileSync("git", ["-C", api, ...args], { encoding: "utf8" });
  let commit: string;
  try {
    commit = git("rev-list", "-n", "1", tag).trim();
  } catch {
    fail(`tag ${tag} not found in ${api} — fetch packio-api's tags or set PACKIO_API_DIR`);
  }
  const files: Record<string, string> = {};
  for (const path of SHARED) {
    const text = git("show", `${tag}:${path}`);
    writeFileSync(resolve(ROOT, path), banner(tag) + text);
    files[path] = sha256(text);
  }
  const lock: DocsLock = {
    $comment:
      "Shared with packio-api, which owns them. Written by `pnpm docs:sync`; `pnpm docs:sync --check` fails on hand edits.",
    tag,
    commit,
    files,
  };
  writeFileSync(DOCS_LOCK, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`docs:sync: ${SHARED.join(", ")} ← packio-api ${tag} (${commit.slice(0, 7)})`);
}

const args = process.argv.slice(2);
if (args.includes("--check")) check();
else {
  const at = args.indexOf("--tag");
  sync(at >= 0 ? args[at + 1] : undefined);
}
