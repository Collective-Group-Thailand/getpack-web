// @vitest-environment node
import { ESLint } from "eslint";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * U4.1 acceptance: the studio never computes money (studio-spec §1 "no price surprises"; CLAUDE.md).
 * The guard is `getpack/no-money-arithmetic`; this proves its `files` glob covers the studio — a
 * fixture linted at a studio path through the real config, so a glob that stopped matching fails here.
 */
const cwd = fileURLToPath(new URL("../../../../", import.meta.url));

describe("the studio and money", () => {
  it("is linted by getpack/no-money-arithmetic", async () => {
    const eslint = new ESLint({ cwd });
    const [result] = await eslint.lintText(
      "export const delta = (step: { unitPrice: string }, before: string) => Number(step.unitPrice) - Number(before);\n",
      { filePath: join(cwd, "src/features/customer/studio/fixture.ts"), warnIgnored: false },
    );
    const ids = (result?.messages ?? []).map((message) => message.ruleId);
    expect(ids).toContain("getpack/no-money-arithmetic");
  }, 60_000);
});
