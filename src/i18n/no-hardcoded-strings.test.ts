// @vitest-environment node
import { ESLint } from "eslint";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * design-system.md §8: every UI string comes from `src/i18n`. The rule that enforces it is
 * tested like code rather than trusted like configuration — the same reasoning as
 * `src/lib/zones/eslint-boundaries.test.ts`, and the same fixture-string technique, so no
 * deliberately-broken file lives in the tree where someone might later "fix" it.
 *
 * Worth having twice over: this rule is easy to weaken by accident. A `files` glob that stops
 * matching, or an `allowedStrings` entry that swallows a word, looks exactly like a codebase
 * that never hard-codes copy.
 */
const cwd = fileURLToPath(new URL("../../", import.meta.url));

let eslint: ESLint;

beforeAll(async () => {
  eslint = new ESLint({ cwd });
  await messagesFor("src/features/customer/x/X.tsx", "export const x = 1;\n");
}, 60_000);

async function messagesFor(filePath: string, source: string) {
  const [result] = await eslint.lintText(source, { filePath: join(cwd, filePath), warnIgnored: false });
  return result?.messages ?? [];
}

const COPY_RULES = ["react/jsx-no-literals", "no-restricted-syntax"];

function copyErrors(messages: Awaited<ReturnType<typeof messagesFor>>) {
  return messages.filter((message) => message.ruleId && COPY_RULES.includes(message.ruleId));
}

const component = (body: string) => `export function X() {\n  return ${body};\n}\n`;

describe("hard-coded UI strings", { timeout: 60_000 }, () => {
  it.each([
    ["src/app/[locale]/page.tsx", "<p>เริ่มออกแบบ</p>"],
    ["src/app/admin/page.tsx", "<p>Orders</p>"],
    ["src/features/customer/cart/Cart.tsx", "<button>Checkout</button>"],
    ["src/features/admin/orders/OrderTable.tsx", "<span>No orders</span>"],
    // src/ui is included on purpose: a primitive with copy baked in is unusable in the other
    // locale, in Storybook and in an export.
    ["src/ui/components/Thing.tsx", "<p>Loading</p>"],
  ])("refuses rendered text in %s", async (filePath, body) => {
    expect(copyErrors(await messagesFor(filePath, component(body))).length).toBeGreaterThan(0);
  });

  it.each([
    ["aria-label", '<button aria-label="Close" />'],
    ["alt", '<img alt="A folding box" />'],
    ["placeholder", '<input placeholder="Search orders" />'],
    ["title", '<abbr title="Corrugated board" />'],
  ])("refuses a literal %s, which a screen reader reads aloud", async (_name, body) => {
    const messages = await messagesFor("src/features/customer/cart/Cart.tsx", component(body));
    expect(copyErrors(messages).length).toBeGreaterThan(0);
  });

  it.each([
    ["a translated string", "<p>{t('cart.title')}</p>"],
    ["punctuation between translated parts", "<p>{a} · {b}</p>"],
    // The standard way to mark an image decorative. It is the absence of copy, not
    // untranslated copy, and the visible name sits beside it.
    ["a decorative image", '<img alt="" src={url} />'],
    // Keycaps print what is on the key; "Ctrl" is "Ctrl" in Thai.
    ["a keycap constant", "<Kbd>{KEYCAP.ctrl}</Kbd>"],
    ["a technical attribute", '<input type="email" name="email" autoComplete="username" />'],
  ])("allows %s", async (_name, body) => {
    const messages = await messagesFor("src/features/customer/cart/Cart.tsx", component(body));
    expect(copyErrors(messages).map((m) => `${m.ruleId}: ${m.message}`)).toEqual([]);
  });

  it("leaves stories and tests alone", async () => {
    // A story is documentation and a test is a fixture; both need literal text to be readable.
    for (const filePath of ["src/ui/components/Button.stories.tsx", "src/ui/components/Button.test.tsx"]) {
      expect(copyErrors(await messagesFor(filePath, component("<p>Click me</p>")))).toEqual([]);
    }
  });
});
