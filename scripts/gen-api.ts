/**
 * Generates the typed API surface from the backend's OpenAPI contract (ADR-0006).
 *
 *   pnpm gen:api           regenerate from the vendored contract
 *   pnpm gen:api --check   fail if a committed output is stale or was hand-edited (CI)
 *   pnpm gen:api --adopt   pull a newer contract from API_CONTRACT_SOURCE, then regenerate
 *
 * Three files are written, all committed:
 *   src/lib/api/schema.d.ts       from contract/openapi.json   — what packio-api has agreed to
 *   src/lib/api/schema.seed.d.ts  from mocks/seed-openapi.json — the temporary auth seed
 *   mocks/generated/handlers.ts   MSW handlers built from the examples in both documents
 *
 * Why a vendored copy of the contract rather than fetching it here: CI has no sibling
 * checkout of packio-api and no credentials for a private release asset, so the drift gate
 * has to be reproducible offline. `--adopt` is the one command that reaches outside this
 * repo, and it rewrites contract/openapi.json and contract.lock.json together, so bumping
 * the pinned contract stays a reviewable act rather than a side effect of running a build.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import openapiTS, { astToString } from "openapi-typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const LOCK = resolve(ROOT, "contract.lock.json");
const VENDORED = resolve(ROOT, "contract/openapi.json");
const SEED = resolve(ROOT, "mocks/seed-openapi.json");
const OUT_SCHEMA = resolve(ROOT, "src/lib/api/schema.d.ts");
const OUT_SEED_SCHEMA = resolve(ROOT, "src/lib/api/schema.seed.d.ts");
const OUT_HANDLERS = resolve(ROOT, "mocks/generated/handlers.ts");

interface ContractLock {
  version: string;
  sha256: string;
  source: string;
  localSource: string;
  vendored: string;
}

/** An OpenAPI document, read only as far as this script needs it. */
interface OpenApiDocument {
  info?: { version?: string };
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

interface OpenApiOperation {
  operationId?: string;
  responses?: Record<string, OpenApiResponse>;
}

interface OpenApiResponse {
  $ref?: string;
  description?: string;
  content?: Record<string, { example?: unknown }>;
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

function banner(source: string): string {
  return `/**
 * GENERATED FILE — do not edit.
 * Source: ${source} · Regenerate: pnpm gen:api · Gate: pnpm gen:api --check
 */`;
}

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** `/v1/orders/{orderId}` → `*​/v1/orders/:orderId`, the form MSW matches on any origin. */
function toMswPath(path: string): string {
  return `*${path.replace(/\{([^}]+)\}/g, ":$1")}`;
}

/**
 * Follows one level of `$ref` into `components.responses`, because a seed response like
 * `Session` is shared by six operations and its example lives at the referenced node.
 */
function resolveResponse(document: unknown, response: OpenApiResponse): OpenApiResponse {
  if (!response.$ref) return response;
  const path = response.$ref.replace(/^#\//, "").split("/");
  let node: unknown = document;
  for (const segment of path) {
    if (typeof node !== "object" || node === null) return response;
    node = (node as Record<string, unknown>)[segment];
  }
  return (node as OpenApiResponse | undefined) ?? response;
}

/** The lowest 2xx a mock should answer with, plus its example body if the document has one. */
function successResponse(
  document: OpenApiDocument,
  operation: OpenApiOperation,
): { status: number; example: unknown } | null {
  const codes = Object.keys(operation.responses ?? {})
    .map(Number)
    .filter((code) => code >= 200 && code < 300)
    .sort((a, b) => a - b);

  const status = codes[0];
  if (status === undefined) return null;

  const resolved = resolveResponse(document, operation.responses![String(status)]!);
  const content = resolved.content ?? {};
  const body = content["application/json"] ?? content["application/problem+json"];
  return { status, example: body?.example ?? null };
}

function handlersFor(document: OpenApiDocument, origin: string, seeded: boolean): string[] {
  const lines: string[] = [];

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = item[method as HttpMethod];
      if (!operation) continue;

      const success = successResponse(document, operation);
      if (!success) continue;

      const marker = seeded ? `  // CONTRACT-REQUEST ${operation.operationId ?? path}\n` : "";
      const body =
        success.example === null
          ? `new HttpResponse(null, { status: ${success.status} })`
          : `HttpResponse.json(${JSON.stringify(success.example)}, { status: ${success.status} })`;

      lines.push(`${marker}  http.${method}(${JSON.stringify(toMswPath(path))}, () => ${body}),`);
    }
  }

  return lines.length > 0 ? [`  // ${origin}`, ...lines] : [];
}

function buildHandlers(contract: OpenApiDocument, seed: OpenApiDocument, lock: ContractLock): string {
  const real = handlersFor(contract, `contract/openapi.json (packio-api ${lock.version})`, false);
  const seeded = handlersFor(seed, "mocks/seed-openapi.json — SEED, not agreed by packio-api", true);

  return [
    banner("contract/openapi.json + mocks/seed-openapi.json"),
    "",
    "/**",
    " * Base handlers: every operation answered with the example from the document it came from,",
    " * so `pnpm dev:mock` and the e2e suite run with no backend. Data is deliberately and",
    " * obviously fake. Override a handler in mocks/handlers.ts rather than editing this file.",
    " *",
    " * Handlers carrying a CONTRACT-REQUEST marker are served from the seed contract and have a",
    " * row in docs/contract-requests.md. Both disappear when packio-api publishes the real one.",
    " */",
    "",
    'import { http, HttpResponse } from "msw";',
    "",
    "export const generatedHandlers = [",
    ...real,
    ...seeded,
    "];",
    "",
  ].join("\n");
}

async function typesFor(path: string, source: string): Promise<string> {
  const ast = await openapiTS(new URL(`file://${path}`), { alphabetize: true });
  return `${banner(source)}\n\n${astToString(ast)}`;
}

function compare(path: string, expected: string, label: string): boolean {
  let current: string;
  try {
    current = readFileSync(path, "utf8");
  } catch {
    process.stderr.write(`${label} is missing — run pnpm gen:api\n`);
    return false;
  }
  if (current !== expected) {
    process.stderr.write(`${label} is out of date or was hand-edited — run pnpm gen:api\n`);
    return false;
  }
  return true;
}

function write(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  process.stdout.write(`wrote ${path.slice(ROOT.length + 1)}\n`);
}

/** Copies a newer contract in from API_CONTRACT_SOURCE and re-pins the lock to it. */
function adopt(lock: ContractLock): ContractLock {
  const source = process.env.API_CONTRACT_SOURCE ?? lock.localSource;
  let contents: string;
  try {
    contents = readFileSync(resolve(ROOT, source), "utf8");
  } catch {
    process.stderr.write(
      `Cannot read the contract at ${source}.\nSet API_CONTRACT_SOURCE to a local path, or download ${lock.source} and point it there.\n`,
    );
    process.exit(1);
  }

  const document = JSON.parse(contents) as OpenApiDocument;
  const version = document.info?.version ?? lock.version;
  const hash = sha256(contents);

  if (hash === lock.sha256) {
    process.stdout.write(`contract ${version} is already the pinned one (${hash.slice(0, 12)}…)\n`);
    return lock;
  }

  writeFileSync(VENDORED, contents);
  const next = {
    ...lock,
    version,
    sha256: hash,
    source: lock.source.replace(/v[^/]+\/openapi\.json$/, `v${version}/openapi.json`),
  };
  writeFileSync(LOCK, `${JSON.stringify(next, null, 2)}\n`);
  process.stdout.write(`adopted contract ${lock.version} → ${version} (${hash.slice(0, 12)}…)\n`);
  return next;
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  const shouldAdopt = process.argv.includes("--adopt");

  let lock = readJson<ContractLock>(LOCK);
  if (shouldAdopt) lock = adopt(lock);

  const vendored = readFileSync(VENDORED, "utf8");
  const hash = sha256(vendored);
  if (hash !== lock.sha256) {
    process.stderr.write(
      `contract/openapi.json does not match the sha256 in contract.lock.json.\n` +
        `  pinned: ${lock.sha256}\n  actual: ${hash}\n\n` +
        `The contract is pinned deliberately (ADR-0006). To move to a newer one, run\n` +
        `  pnpm gen:api --adopt\n` +
        `which rewrites both files together and turns the differences into type errors.\n`,
    );
    process.exit(1);
  }

  const [schema, seedSchema] = await Promise.all([
    typesFor(VENDORED, `contract/openapi.json (packio-api ${lock.version})`),
    typesFor(SEED, "mocks/seed-openapi.json — SEED, not agreed by packio-api"),
  ]);
  const handlers = buildHandlers(readJson<OpenApiDocument>(VENDORED), readJson<OpenApiDocument>(SEED), lock);

  if (check) {
    const ok = [
      compare(OUT_SCHEMA, schema, "src/lib/api/schema.d.ts"),
      compare(OUT_SEED_SCHEMA, seedSchema, "src/lib/api/schema.seed.d.ts"),
      compare(OUT_HANDLERS, handlers, "mocks/generated/handlers.ts"),
    ].every(Boolean);

    if (!ok) process.exit(1);
    process.stdout.write(`the generated API surface matches contract ${lock.version}\n`);
    return;
  }

  write(OUT_SCHEMA, schema);
  write(OUT_SEED_SCHEMA, seedSchema);
  write(OUT_HANDLERS, handlers);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
