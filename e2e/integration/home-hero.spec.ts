import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { expectHeroParity } from "../helpers/hero";

/**
 * D-310 on the real packio-api (v0.43.1): the home hero's price for each shape the presets offer is
 * the price `/configure` shows for the same choices — the lid shape is a telescope box (PK-CT-02)
 * whose body and lid are both priced. Read-only and anonymous, so it needs none of the setup's
 * accounts (`--no-deps`). The tuck shape is checked when its folding product is priced online.
 */
for (const shape of ["mailer", "lid", "tuck"] as const) {
  test(`the hero and /configure price the ${shape} shape alike`, async ({ page }) => {
    test.slow();
    await page.goto(HOSTS.customer);
    await page.locator("html[data-hydrated]").waitFor();
    const checked = await expectHeroParity(page, shape);
    if (shape === "tuck") test.skip(!checked, "the presets do not offer the tuck shape (its product is not instant)");
    else expect(checked, `the presets offer the ${shape} shape`).toBe(true);
  });
}
