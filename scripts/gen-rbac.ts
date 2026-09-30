/**
 * Imports packio-api's staff role grants for the admin mock (U1 U-F0.3, triage `admin.permissions`).
 *
 *   pnpm gen:rbac          read packio-api's docs/rbac.md, write mocks/generated/rbac.ts
 *
 * packio-api's `docs/rbac.md` is generated from its role and permission catalogues and checked
 * against them by its own test, so it is the one place that says which permissions each D-140
 * staff role holds. The mock personas take their permissions from here rather than from names
 * the frontend proposed in F2: backend names win (triage, `admin.permissions`), and a screen that
 * gates on a permission the real role lacks shows it in the mock too.
 *
 * Like `gen:triage` it reads the sibling checkout, so it is not part of CI; `personas.test.ts`
 * holds the generated file, the personas and the contract's `x-required-permissions` to each other.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(ROOT, process.env.RBAC_SOURCE ?? "../packio-api/docs/rbac.md");
const OUT = resolve(ROOT, "mocks/generated/rbac.ts");

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** The staff table: a header row of role keys, then one row per permission with ● / ◆ per role. */
function parse(markdown: string): { roles: string[]; grants: Record<string, string[]>; sensitive: string[] } {
  const section = markdown.split("\n## Packio staff")[1]?.split("\n## ")[0];
  if (!section) fail("docs/rbac.md has no 'Packio staff' section.");

  // The first table only: the section goes on with others (role names, notes).
  const all = section.split("\n");
  const start = all.findIndex((line) => line.startsWith("|"));
  const end = all.findIndex((line, index) => index > start && !line.startsWith("|"));
  const lines = all.slice(start, end === -1 ? undefined : end);
  const header = lines[0]!.split("|").slice(2, -1);
  const roles = header.map((cell) => /`([a-z_]+)`/.exec(cell)?.[1] ?? fail(`Unreadable role column: ${cell}`));
  const grants: Record<string, string[]> = Object.fromEntries(roles.map((role) => [role, []]));
  const sensitive: string[] = [];

  for (const line of lines.slice(2)) {
    const cells = line.split("|").slice(1, -1);
    const key = /^\s*`([a-z_]+(?:\.[a-z_]+)+)`/.exec(cells[0]!)?.[1];
    if (!key) fail(`Unreadable permission row: ${line}`);
    cells.slice(1).forEach((cell, index) => {
      const mark = cell.trim();
      if (mark === "") return;
      if (mark !== "●" && mark !== "◆") fail(`Unknown mark '${mark}' for ${key}`);
      grants[roles[index]!]!.push(key);
      if (mark === "◆" && !sensitive.includes(key)) sensitive.push(key);
    });
  }
  return { roles, grants, sensitive };
}

function sourceCommit(): string {
  try {
    return execFileSync("git", ["-C", dirname(SOURCE), "log", "-1", "--format=%h", "--", basename(SOURCE)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function render({ roles, grants, sensitive }: ReturnType<typeof parse>): string {
  const all = [...new Set(roles.flatMap((role) => grants[role]!))].sort();
  const list = (keys: readonly string[]) => keys.map((key) => `    "${key}",`).join("\n");
  return `/**
 * GENERATED FILE — do not edit.
 * Source: packio-api docs/rbac.md (staff table) · Regenerate: pnpm gen:rbac
 *
 * The permissions each D-140 staff role holds in packio-api, verbatim. The mock personas are built
 * from these (\`mocks/personas.ts\`).
 */

export const RBAC_SOURCE = { commit: "${sourceCommit()}" } as const;

export const STAFF_PERMISSIONS = [
${list(all).replace(/^ {4}/gm, "  ")}
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

/** Cost and margin data (D-141), marked ◆ in the source. */
export const SENSITIVE_PERMISSIONS: readonly StaffPermission[] = [
${list([...sensitive].sort()).replace(/^ {4}/gm, "  ")}
];

export const STAFF_ROLE_GRANTS: Readonly<Record<string, readonly StaffPermission[]>> = {
${roles.map((role) => `  ${role}: [\n${list([...grants[role]!].sort())}\n  ],`).join("\n")}
};
`;
}

function main(): void {
  let markdown: string;
  try {
    markdown = readFileSync(SOURCE, "utf8");
  } catch {
    fail(`Cannot read ${SOURCE}. Set RBAC_SOURCE to packio-api's docs/rbac.md.`);
  }
  const parsed = parse(markdown);
  writeFileSync(OUT, render(parsed));
  process.stdout.write(
    `wrote ${OUT.slice(ROOT.length + 1)} (${parsed.roles.length} roles, ${new Set(Object.values(parsed.grants).flat()).size} permissions)\n`,
  );
}

main();
