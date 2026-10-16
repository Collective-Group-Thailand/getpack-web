// @vitest-environment node
import { ESLint } from "eslint";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The zone boundary in `eslint.config.mjs` is the thing standing between the storefront
 * bundle and back-office code (00-master-plan.md §3), so it is tested like code rather than
 * trusted like configuration — a `files` glob that silently stops matching would otherwise
 * look exactly like a codebase that never breaks the rule.
 *
 * The fixtures are source *strings* linted against a path, so no deliberately-broken file
 * has to live in the tree where someone might later "fix" it.
 */
const cwd = fileURLToPath(new URL("../../../", import.meta.url));

let eslint: ESLint;

beforeAll(async () => {
  eslint = new ESLint({ cwd });
  // The first lint builds the flat config and the TypeScript path resolver, which takes
  // several seconds; paying for it here keeps every assertion below inside the default
  // timeout instead of failing the first one that happens to run first.
  await messagesFor("src/app/admin/page.tsx", "export const x = 1;\n");
}, 60_000);

async function messagesFor(filePath: string, source: string) {
  const [result] = await eslint.lintText(source, { filePath: join(cwd, filePath), warnIgnored: false });
  return result?.messages ?? [];
}

/** Either half of the boundary: the alias rule or the path-resolving one. */
const BOUNDARY_RULES = ["no-restricted-imports", "import/no-restricted-paths"];

function boundaryErrors(messages: Awaited<ReturnType<typeof messagesFor>>) {
  return messages.filter((message) => message.ruleId && BOUNDARY_RULES.includes(message.ruleId));
}

// Linting through the real config is seconds, not milliseconds, and slower still while the
// other 18 suites are competing for workers — so this block does not use the default timeout.
describe("zone import boundaries", { timeout: 60_000 }, () => {
  it.each([
    ["src/app/[locale]/page.tsx", "@/features/admin/orders"],
    ["src/features/customer/cart/Cart.tsx", "@/features/admin/orders/OrderTable"],
    ["src/features/customer/cart/Cart.tsx", "@/features/partner/jobs"],
    ["src/app/admin/page.tsx", "@/features/customer/cart"],
    ["src/features/admin/orders/OrderTable.tsx", "@/features/partner/jobs"],
    ["src/features/partner/jobs/JobList.tsx", "@/features/admin/orders"],
  ])("refuses %s importing %s", async (filePath, specifier) => {
    const messages = await messagesFor(filePath, `import { Thing } from "${specifier}";\nexport const x = Thing;\n`);
    expect(boundaryErrors(messages).length).toBeGreaterThan(0);
    expect(boundaryErrors(messages).every((message) => message.severity === 2)).toBe(true);
  });

  /**
   * The alias rule matches import *strings*, so a sibling-relative path would slip past it.
   * `import/no-restricted-paths` resolves the specifier instead — which means the fixture has
   * to name a module that really exists, or there is nothing to resolve.
   */
  it("refuses a relative path that walks around the alias", async () => {
    const messages = await messagesFor(
      "src/features/admin/orders/OrderTable.tsx",
      'import { SiteHeader } from "../../customer/shell/SiteHeader";\nexport const x = SiteHeader;\n',
    );
    expect(boundaryErrors(messages).map((message) => message.ruleId)).toContain("import/no-restricted-paths");
  });

  it("covers the route files too, not only src/features", async () => {
    const messages = await messagesFor(
      "src/app/admin/orders/page.tsx",
      'import { SiteHeader } from "../../../features/customer/shell/SiteHeader";\nexport const x = SiteHeader;\n',
    );
    expect(boundaryErrors(messages).map((message) => message.ruleId)).toContain("import/no-restricted-paths");
  });

  it.each([
    "@/ui",
    "@/features/shared/zone",
    "@/features/designer/catalog",
    "@/domain/status/order",
    "@/i18n/routing",
    "@/lib/zones",
  ])("still allows the shared middle: %s", async (specifier) => {
    const messages = await messagesFor(
      "src/features/customer/cart/Cart.tsx",
      `import { Thing } from "${specifier}";\nexport const x = Thing;\n`,
    );
    expect(boundaryErrors(messages)).toEqual([]);
  });

  it("allows a zone to import its own features", async () => {
    const messages = await messagesFor(
      "src/app/admin/page.tsx",
      'import { OrderTable } from "@/features/admin/orders";\nexport const x = OrderTable;\n',
    );
    expect(boundaryErrors(messages)).toEqual([]);
  });

  it("keeps @getpack/dieline free of this app (ADR-0007)", async () => {
    const messages = await messagesFor(
      "packages/dieline/src/geometry.ts",
      'import { cn } from "@/ui/lib/cn";\nexport const x = cn;\n',
    );
    expect(boundaryErrors(messages)).toHaveLength(1);
  });
});
