/**
 * Generates the typed API surface from the backend's OpenAPI contract (ADR-0006).
 *
 *   pnpm gen:api           regenerate from the vendored contract
 *   pnpm gen:api --check   fail if a committed output is stale or was hand-edited (CI)
 *   pnpm gen:api --adopt --tag vX.Y.Z
 *                          pin a newer **tagged** contract, then regenerate (U1 U-F0.1)
 *
 * Three files are written, all committed:
 *   src/lib/api/schema.d.ts      from contract/openapi.json — what getpack-api has agreed to
 *   mocks/generated/handlers.ts  MSW handlers built from the contract's own examples
 *   mocks/generated/examples.ts  the list endpoints' example rows, for stateful mocks to seed from
 *   mocks/generated/problems.ts  every operation's documented problem codes, for error-path mocks
 *   src/lib/api/problem-codes.ts the problem codes each surface can return, for the th/en copy
 *   docs/contract-requests.openapi.json  the frontend's contract requests, for the backend
 *
 * Why a vendored copy of the contract rather than fetching it here: CI has no sibling
 * checkout of getpack-api and no credentials for a private release asset, so the drift gate
 * has to be reproducible offline. `--adopt` is the one command that reaches outside this
 * repo, and it rewrites contract/openapi.json and contract.lock.json together, so bumping
 * the pinned contract stays a reviewable act rather than a side effect of running a build.
 *
 * Only a tagged release can be adopted. getpack-api's working tree runs ahead of its last tag
 * (the next group's work lands there first), so copying it would pin a contract nobody has
 * released. `--adopt --tag` reads the document at the tag — `git show <tag>:contract/openapi.json`
 * in the sibling checkout, or a downloaded release asset passed as API_CONTRACT_SOURCE — and
 * refuses when the document's `info.version` is not the tag's.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import openapiTS, { astToString } from "openapi-typescript";

import { buildRequestsDocument } from "./requests-openapi";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const LOCK = resolve(ROOT, "contract.lock.json");
const VENDORED = resolve(ROOT, "contract/openapi.json");
const OUT_SCHEMA = resolve(ROOT, "src/lib/api/schema.d.ts");
const OUT_HANDLERS = resolve(ROOT, "mocks/generated/handlers.ts");
const OUT_EXAMPLES = resolve(ROOT, "mocks/generated/examples.ts");
const OUT_PROBLEMS = resolve(ROOT, "mocks/generated/problems.ts");
const OUT_PROBLEM_CODES = resolve(ROOT, "src/lib/api/problem-codes.ts");
/** The contract requests, as an OpenAPI document for the backend (`src/lib/api/requests`). */
const OUT_REQUESTS = resolve(ROOT, "docs/contract-requests.openapi.json");

interface ContractLock {
  $comment?: string;
  version: string;
  /** The getpack-api release tag the vendored document was taken from. */
  tag?: string;
  /** The commit that tag points at, when adopted from a checkout. */
  commit?: string;
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
  content?: Record<string, { example?: unknown; examples?: Record<string, { $ref?: string; value?: unknown }> }>;
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

function handlersFor(document: OpenApiDocument, origin: string): string[] {
  const lines: string[] = [];

  for (const [path, item] of Object.entries(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = item[method as HttpMethod];
      if (!operation) continue;

      const success = successResponse(document, operation);
      if (!success) continue;

      const body =
        success.example === null
          ? `new HttpResponse(null, { status: ${success.status} })`
          : `HttpResponse.json(${JSON.stringify(success.example)}, { status: ${success.status} })`;

      lines.push(`  http.${method}(${JSON.stringify(toMswPath(path))}, () => ${body}),`);
    }
  }

  return lines.length > 0 ? [`  // ${origin}`, ...lines] : [];
}

function buildHandlers(contract: OpenApiDocument, lock: ContractLock): string {
  const real = handlersFor(contract, `contract/openapi.json (getpack-api ${lock.version})`);

  return [
    banner("contract/openapi.json"),
    "",
    "/**",
    " * Base handlers: every operation answered with the example the contract carries for it,",
    " * so `pnpm dev:mock` and the e2e suite run with no backend. Data is deliberately and",
    " * obviously fake. Override a handler in mocks/handlers.ts rather than editing this file.",
    " */",
    "",
    'import { http, HttpResponse } from "msw";',
    "",
    "export const generatedHandlers = [",
    ...real,
    "];",
    "",
  ].join("\n");
}

/**
 * The example rows of every list endpoint (`GET` whose example is `{ data: [...] }`), keyed by
 * path. Stateful mocks seed from these so their rows are the contract's own examples — with the
 * ids the examples use to point at each other — instead of shapes invented beside it.
 */
function buildExamples(contract: OpenApiDocument, lock: ContractLock): string {
  const entries: string[] = [];
  for (const [path, item] of Object.entries(contract.paths ?? {})) {
    const operation = item.get;
    if (!operation) continue;
    const success = successResponse(contract, operation);
    const example = success?.example as { data?: unknown } | null | undefined;
    if (!example || !Array.isArray(example.data)) continue;
    entries.push(`  ${JSON.stringify(path)}: ${JSON.stringify(example.data)},`);
  }
  return [
    banner("contract/openapi.json"),
    "",
    `/** List-endpoint example rows from contract/openapi.json (getpack-api ${lock.version}), keyed by path. */`,
    "export const LIST_EXAMPLES: Record<string, readonly unknown[]> = {",
    ...entries,
    "};",
    "",
  ].join("\n");
}

/** The problem-details example the contract publishes for a code (`components.examples`). */
interface ProblemExample {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  errors?: unknown[];
}

/**
 * Every operation's documented problem codes and the status each comes with, plus one example
 * body per code. `mocks/scenario.ts` answers `?mock=<operationId>:<code>` from these, so an error
 * state can be looked at in dev with the exact body the API documents for that operation.
 */
function buildProblems(contract: OpenApiDocument, lock: ContractLock): string {
  const examples: Record<string, ProblemExample> = {};
  const operations: string[] = [];

  for (const [path, item] of Object.entries(contract.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = item[method as HttpMethod];
      if (!operation?.operationId) continue;
      const problems: Record<string, number> = {};
      for (const [status, raw] of Object.entries(operation.responses ?? {})) {
        if (!/^[45]\d\d$/.test(status)) continue;
        const response = resolveResponse(contract, raw);
        for (const media of Object.values(response.content ?? {})) {
          for (const [code, example] of Object.entries(media.examples ?? {})) {
            problems[code] = Number(status);
            if (examples[code]) continue;
            const value = (
              example.$ref
                ? (resolveResponse(contract, { $ref: example.$ref }) as { value?: unknown }).value
                : example.value
            ) as (ProblemExample & { requestId?: string }) | undefined;
            // The example's request id is one fixed uuid; a mock answer gets its own.
            if (value)
              examples[code] = Object.fromEntries(
                Object.entries(value).filter(([key]) => key !== "requestId"),
              ) as unknown as ProblemExample;
          }
        }
      }
      operations.push(
        `  ${JSON.stringify(operation.operationId)}: ${JSON.stringify({ method: method.toUpperCase(), path, problems })},`,
      );
    }
  }

  const sortedExamples = Object.keys(examples)
    .sort()
    .map((code) => `  ${JSON.stringify(code)}: ${JSON.stringify(examples[code])},`);

  return [
    banner("contract/openapi.json"),
    "",
    `/** Documented problem codes per operation, from contract/openapi.json (getpack-api ${lock.version}). */`,
    "",
    "export interface OperationProblems {",
    "  method: string;",
    "  /** The contract's path template, e.g. `/v1/store/orders/{orderId}`. */",
    "  path: string;",
    "  /** Problem `code` → the HTTP status the operation documents it with. */",
    "  problems: Record<string, number>;",
    "}",
    "",
    "export interface ProblemExample {",
    "  type: string;",
    "  title: string;",
    "  status: number;",
    "  code: string;",
    "  detail: string;",
    "  errors?: { path: string; code: string; message: string }[];",
    "}",
    "",
    "export const OPERATION_PROBLEMS: Record<string, OperationProblems> = {",
    ...operations,
    "};",
    "",
    "/** One example body per code, as the contract publishes it (Thai `detail`), minus the request id. */",
    "export const PROBLEM_EXAMPLES: Record<string, ProblemExample> = {",
    ...sortedExamples,
    "};",
    "",
  ].join("\n");
}

/**
 * The problem codes each surface's operations document (`/v1/store`, `/v1/admin`, `/v1/partner`,
 * `/v1/auth`). A zone loads th/en copy only for the codes its own surface can return
 * (`src/i18n/messages/index.ts`), so the storefront does not carry the back office's.
 */
function buildProblemCodes(contract: OpenApiDocument, lock: ContractLock): string {
  const surfaces: Record<string, Set<string>> = {
    store: new Set(),
    admin: new Set(),
    partner: new Set(),
    auth: new Set(),
  };
  for (const [path, item] of Object.entries(contract.paths ?? {})) {
    const surface = /^\/v1\/(store|admin|partner|auth)\//.exec(path)?.[1];
    if (!surface) continue;
    for (const method of HTTP_METHODS) {
      for (const [status, raw] of Object.entries(item[method as HttpMethod]?.responses ?? {})) {
        if (!/^[45]\d\d$/.test(status)) continue;
        for (const media of Object.values(resolveResponse(contract, raw).content ?? {})) {
          for (const code of Object.keys(media.examples ?? {})) surfaces[surface]!.add(code);
        }
      }
    }
  }
  return [
    banner("contract/openapi.json"),
    "",
    `/** Problem codes each surface documents, from contract/openapi.json (getpack-api ${lock.version}). */`,
    "export const SURFACE_PROBLEM_CODES = {",
    ...Object.entries(surfaces).map(([surface, codes]) => `  ${surface}: ${JSON.stringify([...codes].sort())},`),
    "} as const satisfies Record<string, readonly string[]>;",
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

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    // The contract is several megabytes; the default 1 MB buffer cuts it off.
    maxBuffer: 256 * 1024 * 1024,
  });
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** The release asset URL for a tag, in the form the lock's `source` already uses. */
function releaseAsset(source: string, tag: string): string {
  return source.replace(/\/releases\/download\/[^/]+\/openapi\.json$/, `/releases/download/${tag}/openapi.json`);
}

/**
 * Reads the contract at a release tag: a downloaded asset when API_CONTRACT_SOURCE names one,
 * otherwise the tagged blob in the getpack-api checkout that holds `localSource`.
 */
function readTagged(lock: ContractLock, tag: string): { contents: string; commit?: string } {
  const asset = process.env.API_CONTRACT_SOURCE;
  if (asset) {
    try {
      return { contents: readFileSync(resolve(ROOT, asset), "utf8") };
    } catch {
      fail(`Cannot read the contract at ${asset} (API_CONTRACT_SOURCE).`);
    }
  }

  // Every git call runs in the directory that holds `localSource` and names the file as
  // `./<name>`, git's cwd-relative spelling, so the checkout's path never has to be compared
  // with ours (it can differ in case on macOS, where `getpack-api` is `Getpack-API` on disk).
  const file = resolve(ROOT, lock.localSource);
  const directory = dirname(file);
  let commit: string;
  try {
    git(directory, "rev-parse", "--git-dir");
  } catch {
    fail(
      `No getpack-api checkout at ${lock.localSource}.\n` +
        `Download ${releaseAsset(lock.source, tag)} and pass it as API_CONTRACT_SOURCE instead.`,
    );
  }
  try {
    commit = git(directory, "rev-list", "-n", "1", `refs/tags/${tag}`).trim();
  } catch {
    fail(`getpack-api has no tag ${tag}. Only a tagged release can be adopted.`);
  }
  return { contents: git(directory, "show", `${commit}:./${basename(file)}`), commit };
}

/** Copies the contract of a tagged release in and re-pins the lock to it. */
function adopt(lock: ContractLock, tag: string | undefined): ContractLock {
  if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
    fail("pnpm gen:api --adopt needs --tag vX.Y.Z: only a tagged getpack-api release can be pinned.");
  }

  const { contents, commit } = readTagged(lock, tag);
  const document = JSON.parse(contents) as OpenApiDocument;
  const version = document.info?.version;
  if (`v${version}` !== tag) {
    fail(`The contract at ${tag} says info.version ${version ?? "(none)"}; refusing to pin it as ${tag}.`);
  }

  const hash = sha256(contents);
  writeFileSync(VENDORED, contents);
  const next: ContractLock = {
    $comment: lock.$comment,
    version: version!,
    tag,
    ...(commit ? { commit } : {}),
    sha256: hash,
    source: releaseAsset(lock.source, tag),
    localSource: lock.localSource,
    vendored: lock.vendored,
  };
  writeFileSync(LOCK, `${JSON.stringify(next, null, 2)}\n`);
  process.stdout.write(`adopted contract ${lock.version} → ${version} at ${tag} (${hash.slice(0, 12)}…)\n`);
  return next;
}

/** The lock must name a release: a tag, its asset, and a vendored document of that version. */
function verifyLock(lock: ContractLock, vendored: string): void {
  const problems: string[] = [];
  if (!lock.tag) problems.push("it names no release tag (an untagged contract cannot be pinned)");
  else {
    if (lock.tag !== `v${lock.version}`) problems.push(`tag ${lock.tag} is not version ${lock.version}`);
    if (!lock.source.endsWith(`/releases/download/${lock.tag}/openapi.json`)) {
      problems.push(`source ${lock.source} is not the ${lock.tag} release asset`);
    }
  }
  const version = (JSON.parse(vendored) as OpenApiDocument).info?.version;
  if (version !== lock.version) problems.push(`contract/openapi.json is version ${version}, the lock ${lock.version}`);

  if (problems.length > 0) {
    fail(
      `contract.lock.json does not pin a tagged release:\n${problems.map((p) => `  - ${p}`).join("\n")}\n\n` +
        `Run pnpm gen:api --adopt --tag vX.Y.Z.`,
    );
  }
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  const shouldAdopt = process.argv.includes("--adopt");

  let lock = readJson<ContractLock>(LOCK);
  if (shouldAdopt) {
    const flag = process.argv.indexOf("--tag");
    lock = adopt(lock, flag >= 0 ? process.argv[flag + 1] : undefined);
  }

  const vendored = readFileSync(VENDORED, "utf8");
  const hash = sha256(vendored);
  if (hash !== lock.sha256) {
    process.stderr.write(
      `contract/openapi.json does not match the sha256 in contract.lock.json.\n` +
        `  pinned: ${lock.sha256}\n  actual: ${hash}\n\n` +
        `The contract is pinned deliberately (ADR-0006). To move to a newer one, run\n` +
        `  pnpm gen:api --adopt --tag vX.Y.Z\n` +
        `which rewrites both files together and turns the differences into type errors.\n`,
    );
    process.exit(1);
  }
  verifyLock(lock, vendored);

  const schema = await typesFor(VENDORED, `contract/openapi.json (getpack-api ${lock.version})`);
  const document = readJson<OpenApiDocument>(VENDORED);
  const handlers = buildHandlers(document, lock);
  const examples = buildExamples(document, lock);
  const problems = buildProblems(document, lock);
  const problemCodes = buildProblemCodes(document, lock);
  const requests = buildRequestsDocument();

  if (check) {
    const ok = [
      compare(OUT_SCHEMA, schema, "src/lib/api/schema.d.ts"),
      compare(OUT_HANDLERS, handlers, "mocks/generated/handlers.ts"),
      compare(OUT_EXAMPLES, examples, "mocks/generated/examples.ts"),
      compare(OUT_PROBLEMS, problems, "mocks/generated/problems.ts"),
      compare(OUT_PROBLEM_CODES, problemCodes, "src/lib/api/problem-codes.ts"),
      compare(OUT_REQUESTS, requests, "docs/contract-requests.openapi.json"),
    ].every(Boolean);

    if (!ok) process.exit(1);
    process.stdout.write(`the generated API surface matches contract ${lock.version}\n`);
    return;
  }

  write(OUT_SCHEMA, schema);
  write(OUT_HANDLERS, handlers);
  write(OUT_EXAMPLES, examples);
  write(OUT_PROBLEMS, problems);
  write(OUT_PROBLEM_CODES, problemCodes);
  write(OUT_REQUESTS, requests);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
