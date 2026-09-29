/**
 * Imports packio-api's triage of our contract requests (U1 U-F0.1 step 2).
 *
 *   pnpm gen:triage        read the triage, write src/lib/api/requests/triage.ts and
 *                          rewrite the Status cell of every open row in docs/contract-requests.md
 *
 * packio-api owns the contract (api-conventions §1), so it decides what happens to each request:
 * published as asked, published in another shape (with a mapping the frontend applies), built in
 * one of its U-B0 groups, or rejected. It writes that down once, in
 * `docs/contract-requests-triage.md`; this script turns the per-operation verdicts into data the
 * registry tests and the requests document can use, so a verdict is never copied by hand.
 *
 * The triage moves as packio-api ships each group — re-run this after every one. Like `--adopt`
 * it reads the sibling checkout, so it is not part of CI; the tests in `registry.test.ts` hold
 * the generated file, the markdown, the registry and the contract to each other offline.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(ROOT, process.env.TRIAGE_SOURCE ?? "../packio-api/docs/contract-requests-triage.md");
const OUT = resolve(ROOT, "src/lib/api/requests/triage.ts");
const REQUESTS_MD = resolve(ROOT, "docs/contract-requests.md");

type Group = "U-B0.1" | "U-B0.2" | "U-B0.3";
type OperationVerdict = "published" | "published_differently" | "implement" | "reject";
type RequestVerdict = OperationVerdict | "mixed";

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

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** The commit the triage was last changed in, so the generated file says which one it holds. */
function sourceCommit(): string {
  try {
    return git(dirname(SOURCE), "log", "-1", "--format=%h", "--", basename(SOURCE));
  } catch {
    return "unknown";
  }
}

function render(
  markdown: string,
  operations: Record<string, OperationTriage>,
  requests: Record<string, RequestTriage>,
): string {
  const against = /`(packio-web@[0-9a-f]+)`/.exec(markdown)?.[1] ?? "unknown";
  const contract = /at \*\*`(v\d+\.\d+\.\d+)`\*\*/.exec(markdown)?.[1] ?? "unknown";
  const sorted = <T>(record: Record<string, T>) =>
    Object.keys(record)
      .sort()
      .map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(record[key])},`);

  return [
    "/**",
    " * GENERATED FILE — do not edit.",
    " * Source: packio-api docs/contract-requests-triage.md · Regenerate: pnpm gen:triage",
    " *",
    ' * packio-api\'s verdict on every contract request, per frontend operation (`"<METHOD> <path>"`,',
    " * the registry's spelling) and per request id. `published_differently` means the operation",
    " * exists and the screen applies the triage's mapping when it migrates; `gaps` counts what",
    " * packio-api adds to it, additively, in `group`. `implement` is built there in `group`.",
    " */",
    "",
    'export type TriageGroup = "U-B0.1" | "U-B0.2" | "U-B0.3";',
    'export type OperationVerdict = "published" | "published_differently" | "implement" | "reject";',
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
    "}",
    "",
    `export const TRIAGE_SOURCE = ${JSON.stringify({ commit: sourceCommit(), triagedAgainst: against, contract })} as const;`,
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
const AWAITING_TRIAGE = "Open — awaiting packio-api triage";

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
  const gapNote = gaps > 0 ? `; ${gaps} additive gap${gaps === 1 ? "" : "s"} in packio-api ${request.group}` : "";
  const ids = (list: typeof own) => code(list.map(([, operation]) => operation.operationId ?? "?"));

  switch (request.verdict) {
    case "published":
      return `Published as ${ids(published)}`;
    case "published_differently":
      return `Published differently (see mapping) — as ${ids([...published, ...different]) || "the operations named in the triage"}${gapNote}`;
    case "implement":
      return `Open — packio-api ${request.group}`;
    case "reject":
      return "Rejected (see packio-api triage)";
    case "mixed": {
      const parts = [
        published.length ? `published as ${ids(published)}` : "",
        different.length ? `published differently (see mapping) as ${ids(different)}${gapNote}` : "",
        open.length ? `open — packio-api ${request.group}: ${code(open.map(([key]) => key))}` : "",
      ].filter(Boolean);
      return `Mixed — ${parts.join("; ")}`;
    }
  }
}

/** The web-side note an older cell carried ("mocked", "UI assumes 6 …"), kept after the verdict. */
function webNote(cell: string): string {
  const kept = / · web: (.*)$/.exec(cell);
  if (kept) return kept[1]!;
  if (/^(Published|Mixed|Rejected|Open — packio-api|Open — awaiting packio-api)/.test(cell)) return "";
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
  let markdown: string;
  try {
    markdown = readFileSync(SOURCE, "utf8");
  } catch {
    fail(`Cannot read the triage at ${SOURCE}. Set TRIAGE_SOURCE to packio-api's docs/contract-requests-triage.md.`);
  }

  const { operations, requests } = parse(markdown);
  writeFileSync(OUT, render(markdown, operations, requests));
  process.stdout.write(
    `wrote ${OUT.slice(ROOT.length + 1)} (${Object.keys(requests).length} requests, ${Object.keys(operations).length} operations)\n`,
  );

  const rewritten = rewriteStatuses(readFileSync(REQUESTS_MD, "utf8"), operations, requests);
  writeFileSync(REQUESTS_MD, rewritten.markdown);
  process.stdout.write(`rewrote ${rewritten.rows} statuses in docs/contract-requests.md\n`);
}

main();
