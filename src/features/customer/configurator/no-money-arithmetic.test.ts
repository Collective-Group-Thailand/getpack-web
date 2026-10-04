// @vitest-environment node
import { RuleTester, type Rule } from "eslint";
import { describe, it } from "vitest";

import rule from "../../../../eslint-rules/no-money-arithmetic.mjs";

/**
 * The guard behind U2.F1 §7 ("no client-side price or strength maths"): the configurator formats
 * the API's figures and never computes with them. The cases are plain JavaScript, so ESLint's own
 * parser reads them; RuleTester runs them as vitest cases.
 */
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

new RuleTester().run("packio/no-money-arithmetic", rule as unknown as Rule.RuleModule, {
  valid: [
    "format.thb(step.unitPrice)",
    "const label = `฿${step.grossAmount}`",
    "const text = '฿' + step.unitPrice",
    "const same = step.unitPrice === other.unitPrice",
    "const percent = (file.sent / file.total) * 100",
    "const count = state.quantities.length + 1",
  ],
  invalid: [
    { code: "const a = Number(step.unitPrice) * 2", errors: [{ messageId: "arithmetic" }, { messageId: "numbering" }] },
    { code: "const b = option.bct.low + 1", errors: [{ messageId: "arithmetic" }] },
    { code: "const c = parseFloat(quote.grossAmount)", errors: [{ messageId: "numbering" }] },
    { code: "let d = 0; d += line.netAmount", errors: [{ messageId: "arithmetic" }] },
    { code: "const e = +lever.bestSavingPct", errors: [{ messageId: "numbering" }] },
  ],
});
