/**
 * Imports getpack-api's role grants for the admin and partner mocks (U1 U-F0.3 / U-F0.4, triage
 * `admin.permissions` and `partner.permissions`).
 *
 *   pnpm gen:rbac          read getpack-api's docs/rbac.md at the pinned tag, write mocks/generated/rbac.ts
 *
 * getpack-api's `docs/rbac.md` is generated from its role and permission catalogues and checked
 * against them by its own test, so it is the one place that says which permissions each D-140
 * staff role and D-140 factory role holds. The mock personas take their permissions from here rather
 * than from names the frontend proposed in F2 / F5: backend names win (triage, `admin.permissions`,
 * `partner.permissions`), and a screen that gates on a permission the real role lacks shows it in
 * the mock too.
 *
 * Like `gen:triage` it reads the sibling checkout at the tag `contract.lock.json` pins (`RBAC_SOURCE`
 * reads a file instead), so it is not part of CI; the permissions tests hold the generated file, the
 * personas and the contract's `x-required-permissions` to each other.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "mocks/generated/rbac.ts");
const RBAC_PATH = "docs/rbac.md";

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** A role table: a header row of role keys, then one row per permission with ● / ◆ per role. */
function parse(
  markdown: string,
  heading: string,
): { roles: string[]; grants: Record<string, string[]>; sensitive: string[] } {
  const section = markdown.split(`\n## ${heading}`)[1]?.split("\n## ")[0];
  if (!section) fail(`docs/rbac.md has no '${heading}' section.`);

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

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** `docs/rbac.md` at the release the lock pins, and the commit it was last changed in. */
function readRbac(): { markdown: string; commit: string; tag: string } {
  const lock = JSON.parse(readFileSync(resolve(ROOT, "contract.lock.json"), "utf8")) as {
    tag: string;
    localSource: string;
  };
  const override = process.env.RBAC_SOURCE;
  if (override) {
    try {
      return { markdown: readFileSync(resolve(ROOT, override), "utf8"), commit: "file", tag: lock.tag };
    } catch {
      fail(`Cannot read ${override} (RBAC_SOURCE).`);
    }
  }
  const checkout = resolve(ROOT, dirname(dirname(lock.localSource)));
  try {
    return {
      markdown: git(checkout, "show", `${lock.tag}:${RBAC_PATH}`),
      commit: git(checkout, "log", "-1", "--format=%h", lock.tag, "--", RBAC_PATH),
      tag: lock.tag,
    };
  } catch {
    fail(`Cannot read ${RBAC_PATH} at ${lock.tag} in ${checkout}. Set RBAC_SOURCE to a copy of it.`);
  }
}

function render(
  { commit, tag }: { commit: string; tag: string },
  { roles, grants, sensitive }: ReturnType<typeof parse>,
  factory: ReturnType<typeof parse>,
): string {
  const all = [...new Set(roles.flatMap((role) => grants[role]!))].sort();
  const factoryAll = [...new Set(factory.roles.flatMap((role) => factory.grants[role]!))].sort();
  const list = (keys: readonly string[]) => keys.map((key) => `    "${key}",`).join("\n");
  return `/**
 * GENERATED FILE — do not edit.
 * Source: getpack-api docs/rbac.md at ${tag} (staff and factory tables) · Regenerate: pnpm gen:rbac
 *
 * The permissions each D-140 staff role and factory role holds in getpack-api, verbatim. The mock
 * personas are built from these (\`mocks/personas.ts\`, \`mocks/partner/personas.ts\`).
 */

export const RBAC_SOURCE = { commit: "${commit}", tag: "${tag}" } as const;

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

/** Factory scope (D-140 factory roles): what a partner user may do at the factory they act for. */
export const FACTORY_PERMISSIONS = [
${list(factoryAll).replace(/^ {4}/gm, "  ")}
] as const;

export type FactoryPermission = (typeof FACTORY_PERMISSIONS)[number];

export const FACTORY_ROLE_GRANTS: Readonly<Record<string, readonly FactoryPermission[]>> = {
${factory.roles.map((role) => `  ${role}: [\n${list([...factory.grants[role]!].sort())}\n  ],`).join("\n")}
};
`;
}

function main(): void {
  const source = readRbac();
  const staff = parse(source.markdown, "getpack staff");
  const factory = parse(source.markdown, "Partner factory");
  writeFileSync(OUT, render(source, staff, factory));
  const count = (table: ReturnType<typeof parse>) =>
    `${table.roles.length} roles, ${new Set(Object.values(table.grants).flat()).size} permissions`;
  process.stdout.write(`wrote ${OUT.slice(ROOT.length + 1)} (staff ${count(staff)}; factory ${count(factory)})\n`);
}

main();
