/**
 * Imports getpack-api's triage of our contract requests (U1 U-F0.1 step 2).
 *
 *   pnpm gen:triage        read the triage, write src/lib/api/requests/triage.ts and
 *                          rewrite the Status cell of every open row in docs/contract-requests.md
 *
 * getpack-api owns the contract (api-conventions §1), so it decides what happens to each request:
 * published as asked, published in another shape (with a mapping the frontend applies), built in
 * one of its U-B0 groups, or rejected. It writes that down once, in
 * `docs/contract-requests-triage.md`; this script turns the per-operation verdicts into data the
 * registry tests and the requests document can use, so a verdict is never copied by hand.
 *
 * The triage moves as getpack-api ships each group — re-run this after every `--adopt`. It reads
 * the triage at the tag `contract.lock.json` pins, from the sibling checkout, so it is not part of
 * CI; the tests in `registry.test.ts` hold the generated file, the markdown, the registry and the
 * contract to each other offline.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "src/lib/api/requests/triage.ts");
const REQUESTS_MD = resolve(ROOT, "docs/contract-requests.md");
const TRIAGE_PATH = "docs/contract-requests-triage.md";

type Group = "U-B0.1" | "U-B0.2" | "U-B0.3";
type OperationVerdict = "published" | "published_differently" | "implement" | "deferred" | "reject";
type RequestVerdict = OperationVerdict | "mixed";
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface OperationTriage {
  request: string;
  verdict: OperationVerdict;
  group: Group;
  operationId?: string;
  publishedAs?: string;
  gaps: number;
}

interface RequestTriage {
  verdict: RequestVerdict;
  group: Group;
  /** The getpack-api release that shipped the group's work on this request (`## U-B0.x shipped`). */
  shippedIn?: string;
}

/** A row of a `## U-B0.x shipped (`vX.Y.Z`, …)` table: what the group's release made of the request. */
interface Shipped {
  release: string;
  now: "published" | "published_differently" | "deferred" | "not_yet";
  /** The operationIds the row says the group added, `{store,admin}.x.y` spelled out. */
  operationIds: string[];
}

interface Contract {
  paths: Record<string, Partial<Record<Lowercase<Method>, { operationId?: string }>>>;
}

const OPERATION_LINE =
  /^- \*\*(GET|POST|PUT|PATCH|DELETE) (\/\S+)\*\* — (published differently|published|implement here|reject)(?: → `([^`]+)`(?: \(`(GET|POST|PUT|PATCH|DELETE) (\S+)[^`]*`\))?)?/;

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function operationVerdict(text: string): OperationVerdict {
  if (text === "published differently") return "published_differently";
  if (text === "implement here") return "implement";
  return text as OperationVerdict;
}

function requestVerdict(heading: string): RequestVerdict {
  if (heading.startsWith("mixed")) return "mixed";
  if (heading.startsWith("published differently")) return "published_differently";
  if (heading.startsWith("published")) return "published";
  if (heading.startsWith("implement here")) return "implement";
  if (heading.startsWith("reject")) return "reject";
  fail(`Unknown request verdict: ${heading}`);
}

function parse(markdown: string) {
  const details = markdown.split("\n## Details")[1];
  if (!details) fail("The triage has no Details section.");

  const operations: Record<string, OperationTriage> = {};
  const requests: Record<string, RequestTriage> = {};
  let group: Group | null = null;
  let current: { id: string; verdict: RequestVerdict } | null = null;
  let last: OperationTriage | null = null;

  for (const line of details.split("\n")) {
    const section = /^### (U-B0\.\d)/.exec(line);
    if (section) {
      group = section[1] as Group;
      continue;
    }
    const heading = /^#### `([^`]+)` — (.+)$/.exec(line);
    if (heading) {
      if (!group) fail(`Request ${heading[1]} is outside a U-B0 group.`);
      current = { id: heading[1]!, verdict: requestVerdict(heading[2]!) };
      requests[current.id] = { verdict: current.verdict, group };
      last = null;
      continue;
    }
    if (!current || !group) continue;

    const operation = OPERATION_LINE.exec(line);
    if (operation) {
      const [, method, path, verdict, operationId, publishedMethod, publishedPath] = operation;
      const key = `${method} ${path}`;
      if (operations[key]) fail(`${key} is triaged twice (${operations[key].request}, ${current.id}).`);
      last = {
        request: current.id,
        verdict: operationVerdict(verdict!),
        group,
        ...(operationId ? { operationId } : {}),
        ...(publishedMethod ? { publishedAs: `${publishedMethod} ${publishedPath}` } : {}),
        gaps: 0,
      };
      operations[key] = last;
      continue;
    }
    // Field-level bullets (`… (OtpChallengeDto.codeLength)`, "components on …") are not
    // operations; they end the previous operation's block so its gaps are not over-counted.
    if (line.startsWith("- **")) last = null;
    else if (last && /^\s+- \*\*gap \(U-B0\.\d\):\*\*/.test(line)) last.gaps += 1;
  }

  return { operations, requests };
}

const SURFACES = ["store", "admin", "partner"] as const;

/** `{store,admin}.rum.recordWebVital` and `{surface}.notifications.markAllRead` → one operationId per surface. */
function expand(token: string): string[] {
  const braces = /^\{([^}]+)\}(.*)$/.exec(token);
  if (!braces) return [token];
  const surfaces = braces[1] === "surface" ? SURFACES : braces[1]!.split(",");
  return surfaces.map((surface) => `${surface}${braces[2]}`);
}

/**
 * The operationIds a shipped row names. A row lists siblings by their last part after the first
 * full id (`` `store.companyAssets.list`, `add`, `remove` ``), so a bare name takes the prefix of
 * the full id before it.
 */
function namedOperations(cell: string): string[] {
  const named: string[] = [];
  let prefix = "";
  for (const [, token] of cell.matchAll(/`([^`]+)`/g)) {
    for (const full of expand(token!)) {
      if (/^(store|admin|partner|auth)\.[a-zA-Z]+\.[a-zA-Z]+$/.test(full)) {
        named.push(full);
        prefix = full.slice(0, full.lastIndexOf(".") + 1);
      } else if (prefix && /^[a-z][a-zA-Z]+$/.test(full)) named.push(`${prefix}${full}`);
    }
  }
  return named;
}

/**
 * Built operations whose row names the published operation in prose, at another method or path
 * than the request asked for. Each must be one of the operationIds its own shipped row names
 * (checked below), so this table can only pick between what getpack-api wrote, never add to it.
 */
const NAMED_IN_PROSE: Readonly<Record<string, string>> = {
  // "`store.companies.changeMemberRoles` (PUT …/roles …)" — a role change is a PUT on its own resource.
  "PATCH /v1/store/me/company/members/{memberId}": "store.companies.changeMemberRoles",
  // "`admin.rfqs.replaceDraftQuotation` (If-Match)" — drafts live under /rfq-quotations.
  "PUT /v1/admin/rfqs/{rfqId}/quotes/{quoteId}": "admin.rfqs.replaceDraftQuotation",
  // "`admin.artwork.assignPrepress` (A-62)" — assignment is an artwork action on the order.
  "POST /v1/admin/prepress/{orderId}/actions/assign": "admin.artwork.assignPrepress",
  // "`SlipDto.fileId` (download through `admin.files.download`)" — no slip-specific route.
  "GET /v1/admin/slips/{slipId}/file": "admin.files.download",
};

function nowOf(cell: string): Shipped["now"] {
  const text = cell.replace(/\*/g, "").trim();
  if (text.startsWith("published differently")) return "published_differently";
  if (text.startsWith("published")) return "published";
  if (text.startsWith("deferred")) return "deferred";
  if (text.startsWith("not yet")) return "not_yet";
  fail(`Unknown shipped state: ${cell}`);
}

/**
 * The `## U-B0.x shipped` tables. Once a group ships, its rows there are the verdict: the *Details*
 * section keeps the mapping a screen applies, but still says "implement here" for what was built.
 */
function parseShipped(markdown: string): Record<string, Shipped> {
  const shipped: Record<string, Shipped> = {};
  for (const block of markdown.split("\n## ").slice(1)) {
    const release = /^U-B0\.\d shipped \(`(v\d+\.\d+\.\d+)`/.exec(block)?.[1];
    if (!release) continue;
    for (const line of block.split("\n")) {
      const row = /^\| `([^`]+)` \| ([^|]+) \| ([^|]*) \|/.exec(line);
      if (!row) continue;
      shipped[row[1]!] = {
        release,
        now: nowOf(row[2]!),
        operationIds: namedOperations(`${row[3]} ${line.split("|")[4] ?? ""}`),
      };
    }
  }
  return shipped;
}

/** Static path segments after `/v1/<surface>`, so token-scoped and factory-scoped paths compare. */
function segments(path: string): string[] {
  return path
    .split("/")
    .slice(3)
    .filter((segment) => segment && !segment.startsWith("{"));
}

/** How many trailing static segments two paths share — the published path of a request built elsewhere. */
function shared(a: string, b: string): number {
  const [x, y] = [segments(a).reverse(), segments(b).reverse()];
  let count = 0;
  while (count < x.length && count < y.length && x[count] === y[count]) count += 1;
  return count;
}

function locate(contract: Contract, operationId: string): { method: Method; path: string } | null {
  for (const [path, item] of Object.entries(contract.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (operation?.operationId === operationId) return { method: method.toUpperCase() as Method, path };
    }
  }
  return null;
}

/** `{surface}` / `{store,admin,partner}` in a cross-surface request's key. */
function surfaceTemplate(path: string): boolean {
  return /^\/v1\/\{[^}]+\}\//.test(path);
}

/**
 * Applies the shipped tables: a built operation becomes `published`, found at the same method and
 * path in the pinned contract, else among the operationIds its row names (same method, most
 * trailing path segments in common, one clear winner; a cross-surface key takes the surface its
 * already-published sibling uses, else the first one the key lists), else in `NAMED_IN_PROSE`.
 * Anything it cannot place stops the script — a guessed mapping would send a screen to the wrong
 * endpoint.
 */
function applyShipped(
  operations: Record<string, OperationTriage>,
  requests: Record<string, RequestTriage>,
  shipped: Record<string, Shipped>,
  contract: Contract,
): void {
  const unresolved: string[] = [];
  for (const [id, row] of Object.entries(shipped)) {
    const request = requests[id];
    if (!request) fail(`The shipped tables name ${id}, which the Details section does not have.`);
    if (row.now === "not_yet") continue;
    request.shippedIn = row.release;
    request.verdict = row.now;
    for (const [key, operation] of Object.entries(operations)) {
      if (operation.request !== id || operation.verdict !== "implement") continue;
      if (row.now === "deferred") {
        operation.verdict = "deferred";
        continue;
      }
      const [method, path] = key.split(" ") as [Method, string];
      const exact = contract.paths[path]?.[method.toLowerCase() as Lowercase<Method>]?.operationId;
      if (exact) {
        Object.assign(operation, { verdict: "published", operationId: exact, publishedAs: key });
        continue;
      }
      const prose = NAMED_IN_PROSE[key];
      if (prose) {
        const at = locate(contract, prose);
        if (!at || !row.operationIds.includes(prose)) {
          unresolved.push(`${key} (NAMED_IN_PROSE ${prose} is not in the contract or not named by ${id}'s row)`);
          continue;
        }
        Object.assign(operation, { verdict: "published", operationId: prose, publishedAs: `${at.method} ${at.path}` });
        continue;
      }
      let candidates = row.operationIds
        .map((operationId) => ({ operationId, at: locate(contract, operationId) }))
        .filter((candidate) => candidate.at?.method === method)
        .map((candidate) => ({ ...candidate, score: shared(path, candidate.at!.path) }))
        .filter((candidate) => candidate.score > 0)
        .sort((a, b) => b.score - a.score);
      if (surfaceTemplate(path)) {
        const sibling = Object.values(operations).find(
          (other) => other.request === id && other.operationId && other !== operation,
        )?.operationId;
        const listed = /^\/v1\/\{([^}]+)\}/.exec(path)![1]!;
        const order = sibling ? [sibling.split(".")[0]!] : listed === "surface" ? [...SURFACES] : listed.split(",");
        const preferred = candidates.filter((candidate) => order[0] === candidate.operationId.split(".")[0]);
        if (preferred.length) candidates = preferred;
      }
      const [best, next] = candidates;
      if (!best || (next && next.score === best.score)) {
        unresolved.push(
          `${key} (${id}: ${candidates.map((candidate) => candidate.operationId).join(", ") || "no candidate"})`,
        );
        continue;
      }
      Object.assign(operation, {
        verdict: "published",
        operationId: best.operationId,
        publishedAs: `${best.at!.method} ${best.at!.path}`,
      });
    }
  }
  if (unresolved.length) fail(`Shipped, but no published operation found for:\n  ${unresolved.join("\n  ")}`);
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

interface Lock {
  tag: string;
  localSource: string;
}

/**
 * The triage at the release the lock pins, so verdicts and the vendored contract always describe
 * the same getpack-api: its working tree moves on past the tag. `TRIAGE_SOURCE` reads a file instead.
 */
function readTriage(lock: Lock): { markdown: string; commit: string } {
  const override = process.env.TRIAGE_SOURCE;
  if (override) {
    try {
      return { markdown: readFileSync(resolve(ROOT, override), "utf8"), commit: "file" };
    } catch {
      fail(`Cannot read the triage at ${override}.`);
    }
  }
  const checkout = resolve(ROOT, dirname(dirname(lock.localSource)));
  try {
    return {
      markdown: git(checkout, "show", `${lock.tag}:${TRIAGE_PATH}`),
      commit: git(checkout, "log", "-1", "--format=%h", lock.tag, "--", TRIAGE_PATH),
    };
  } catch {
    fail(`Cannot read ${TRIAGE_PATH} at ${lock.tag} in ${checkout}. Set TRIAGE_SOURCE to a copy of it.`);
  }
}

function render(
  markdown: string,
  commit: string,
  contract: string,
  operations: Record<string, OperationTriage>,
  requests: Record<string, RequestTriage>,
): string {
  const against = /`(getpack-web@[0-9a-f]+)`/.exec(markdown)?.[1] ?? "unknown";
  const sorted = <T>(record: Record<string, T>) =>
    Object.keys(record)
      .sort()
      .map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(record[key])},`);

  return [
    "/**",
    " * GENERATED FILE — do not edit.",
    " * Source: getpack-api docs/contract-requests-triage.md · Regenerate: pnpm gen:triage",
    " *",
    ' * getpack-api\'s verdict on every contract request, per frontend operation (`"<METHOD> <path>"`,',
    " * the registry's spelling) and per request id. `published_differently` means the operation",
    " * exists and the screen applies the triage's mapping when it migrates; `gaps` counts what",
    " * getpack-api adds to it, additively, in `group`. `implement` is built there in `group`;",
    " * `deferred` waits on a decision. `shippedIn` names the release that shipped the group's work.",
    " */",
    "",
    'export type TriageGroup = "U-B0.1" | "U-B0.2" | "U-B0.3";',
    'export type OperationVerdict = "published" | "published_differently" | "implement" | "deferred" | "reject";',
    'export type RequestVerdict = OperationVerdict | "mixed";',
    "",
    "export interface OperationTriage {",
    "  request: string;",
    "  verdict: OperationVerdict;",
    "  group: TriageGroup;",
    "  operationId?: string;",
    "  publishedAs?: string;",
    "  gaps: number;",
    "}",
    "",
    "export interface RequestTriage {",
    "  verdict: RequestVerdict;",
    "  group: TriageGroup;",
    "  shippedIn?: string;",
    "}",
    "",
    `export const TRIAGE_SOURCE = ${JSON.stringify({ commit, triagedAgainst: against, contract })} as const;`,
    "",
    "export const OPERATION_TRIAGE: Readonly<Record<string, OperationTriage>> = {",
    ...sorted(operations),
    "};",
    "",
    "export const REQUEST_TRIAGE: Readonly<Record<string, RequestTriage>> = {",
    ...sorted(requests),
    "};",
    "",
  ].join("\n");
}

/** Canonical status prefixes; `registry.test.ts` checks each open row starts with its own. */
const AWAITING_TRIAGE = "Open — awaiting getpack-api triage";

function code(values: Iterable<string>): string {
  return [...new Set(values)].map((value) => `\`${value}\``).join(", ");
}

function statusFor(id: string, operations: Record<string, OperationTriage>, request?: RequestTriage): string {
  if (!request) return AWAITING_TRIAGE;
  const own = Object.entries(operations).filter(([, operation]) => operation.request === id);
  const published = own.filter(([, operation]) => operation.verdict === "published");
  const different = own.filter(([, operation]) => operation.verdict === "published_differently");
  const open = own.filter(([, operation]) => operation.verdict === "implement");
  const gaps = own.reduce((sum, [, operation]) => sum + operation.gaps, 0);
  const gapNote =
    gaps === 0
      ? ""
      : request.shippedIn
        ? `; ${gaps} additive gap${gaps === 1 ? "" : "s"} shipped in ${request.shippedIn}`
        : `; ${gaps} additive gap${gaps === 1 ? "" : "s"} in getpack-api ${request.group}`;
  const shippedNote = request.shippedIn && !gapNote ? `; shipped in ${request.shippedIn}` : "";
  const ids = (list: typeof own) => code(list.map(([, operation]) => operation.operationId ?? "?"));

  switch (request.verdict) {
    case "published":
      return `Published as ${ids([...published, ...different])}${gapNote}${shippedNote}`;
    case "published_differently":
      return `Published differently (see mapping) — as ${ids([...published, ...different]) || "the operations named in the triage"}${gapNote}${shippedNote}`;
    case "implement":
      return `Open — getpack-api ${request.group}`;
    case "deferred":
      return `Deferred by decision (see getpack-api triage, ${request.shippedIn})`;
    case "reject":
      return "Rejected (see getpack-api triage)";
    case "mixed": {
      const parts = [
        published.length ? `published as ${ids(published)}` : "",
        different.length ? `published differently (see mapping) as ${ids(different)}${gapNote}` : "",
        open.length ? `open — getpack-api ${request.group}: ${code(open.map(([key]) => key))}` : "",
      ].filter(Boolean);
      return `Mixed — ${parts.join("; ")}`;
    }
  }
}

/** The web-side note an older cell carried ("mocked", "UI assumes 6 …"), kept after the verdict. */
function webNote(cell: string): string {
  const kept = / · web: (.*)$/.exec(cell);
  if (kept) return kept[1]!;
  if (/^(Published|Mixed|Rejected|Deferred|Open — getpack-api|Open — awaiting getpack-api)/.test(cell)) return "";
  return cell.replace(/^Open(?: — |, )?/, "").trim();
}

function rewriteStatuses(
  markdown: string,
  operations: Record<string, OperationTriage>,
  requests: Record<string, RequestTriage>,
): { markdown: string; rows: number } {
  const [open, ...rest] = markdown.split("\n## Resolved");
  let rows = 0;
  const lines = open!.split("\n").map((line) => {
    const row = /^\| ([a-z][\w.-]+) \| \d{4}-\d{2}-\d{2} \|/.exec(line);
    if (!row) return line;
    const cut = line.lastIndexOf(" | ");
    const cell = line.slice(cut + 3).replace(/ \|$/, "");
    const note = webNote(cell);
    rows += 1;
    const status = statusFor(row[1]!, operations, requests[row[1]!]);
    return `${line.slice(0, cut)} | ${status}${note ? ` · web: ${note}` : ""} |`;
  });
  return { markdown: [lines.join("\n"), ...rest].join("\n## Resolved"), rows };
}

function main(): void {
  const lock = JSON.parse(readFileSync(resolve(ROOT, "contract.lock.json"), "utf8")) as Lock;
  const contract = JSON.parse(readFileSync(resolve(ROOT, "contract/openapi.json"), "utf8")) as Contract;
  const { markdown, commit } = readTriage(lock);

  const { operations, requests } = parse(markdown);
  applyShipped(operations, requests, parseShipped(markdown), contract);
  writeFileSync(OUT, render(markdown, commit, lock.tag, operations, requests));
  process.stdout.write(
    `wrote ${OUT.slice(ROOT.length + 1)} (${Object.keys(requests).length} requests, ${Object.keys(operations).length} operations)\n`,
  );

  const rewritten = rewriteStatuses(readFileSync(REQUESTS_MD, "utf8"), operations, requests);
  writeFileSync(REQUESTS_MD, rewritten.markdown);
  process.stdout.write(`rewrote ${rewritten.rows} statuses in docs/contract-requests.md\n`);
}

main();
