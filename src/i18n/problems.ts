import { SURFACE_PROBLEM_CODES } from "@/lib/api/problem-codes";
import { BFF_PROBLEM_CODES } from "@/lib/bff/codes";
import type { Zone } from "@/lib/zones";

/**
 * The problem codes a zone can receive: its own surface's (`src/lib/api/problem-codes.ts`,
 * generated from the contract), sign-in's, and the BFF's own. The `problems` namespace is cut
 * down to these per zone, because messages travel with every page and the storefront has no
 * use for the back office's ledger errors.
 */
const SURFACE: Record<Zone, keyof typeof SURFACE_PROBLEM_CODES> = {
  customer: "store",
  admin: "admin",
  partner: "partner",
};

export function problemCodesFor(zone: Zone): ReadonlySet<string> {
  return new Set<string>([
    ...SURFACE_PROBLEM_CODES[SURFACE[zone]],
    ...SURFACE_PROBLEM_CODES.auth,
    ...BFF_PROBLEM_CODES,
  ]);
}

type Tree = { [key: string]: string | Tree };

/** The copy for `codes` only, keeping the nesting next-intl reads `auth.otp_invalid` through. */
export function pickProblems(messages: Tree, codes: ReadonlySet<string>): Tree {
  const picked: Tree = {};
  for (const code of codes) {
    const parts = code.split(".");
    let source: string | Tree | undefined = messages;
    for (const part of parts) source = typeof source === "object" ? source[part] : undefined;
    if (typeof source !== "string") continue;
    let target = picked;
    for (const part of parts.slice(0, -1)) target = (target[part] ??= {}) as Tree;
    target[parts.at(-1)!] = source;
  }
  return picked;
}
