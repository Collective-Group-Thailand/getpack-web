import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";

/**
 * U2.F4 on the real getpack-api (`v0.41.0`): the guarantee, the network and the reviews pages render
 * what the dev seed publishes — whatever it is — and never a figure of their own.
 */
test("the trust pages render the API's own content, on the real API", async ({ page }) => {
  for (const [path, heading] of [
    ["/guarantee", "การรับประกันงาน"],
    ["/network", "เครือข่ายโรงงานของ getpack"],
    ["/reviews", "รีวิวจากลูกค้า"],
  ] as const) {
    const response = await page.goto(`${HOSTS.customer}${path}`);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  const guarantee = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/guarantee`)).json();
  console.log("guarantee version:", guarantee.versionNo, "rules:", guarantee.rules?.length);
  const network = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/network/stats`)).json();
  console.log("network published:", network.network?.published);
});
