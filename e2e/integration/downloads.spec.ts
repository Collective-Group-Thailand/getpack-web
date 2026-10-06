import { expect, test } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { runId, signInCustomer } from "./support";

/**
 * U2.F2 on the real packio-api (`v0.41.0`): the free dieline of a published style variant at sizes
 * inside its range, through the style page's panel — a file, or the engine flag's honest 501.
 */
test("a free dieline from a style's page, on the real API", async ({ context, page }) => {
  test.slow();
  await signInCustomer(context, runId("dieline"));
  const list = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/styles`)).json();
  const styles = (list.data ?? list) as { code: string }[];
  test.skip(!styles.length, "the dev seed publishes no styles");
  let chosen: {
    code: string;
    sizeRanges: {
      materialClass: string;
      minLMm: number | null;
      minWMm: number | null;
      minHMm: number | null;
      maxHMm: number | null;
    }[];
  } | null = null;
  for (const s of styles) {
    const detail = await (await page.request.get(`${HOSTS.customer}/bff/v1/store/styles/${s.code}`)).json();
    if (detail.sizeRanges?.length && detail.variants?.length) {
      chosen = detail;
      break;
    }
  }
  test.skip(!chosen, "no published style with size ranges and variants");
  const range = chosen!.sizeRanges[0]!;
  await page.goto(`${HOSTS.customer}/styles/${chosen!.code.toLowerCase()}`);
  await page.locator("html[data-hydrated]").waitFor();
  await page.getByRole("button", { name: "ดาวน์โหลดแบบแผ่นคลี่ฟรี" }).click();
  const panel = page.getByRole("region", { name: "ดาวน์โหลดแบบแผ่นคลี่ฟรี" });
  await expect(panel).toBeVisible({ timeout: 30_000 });
  const mid = (min: number | null) => String(Math.round((min ?? 50) * 1.5));
  await panel.getByRole("textbox", { name: "ยาว (มม.)" }).fill(mid(range.minLMm));
  await panel.getByRole("textbox", { name: "กว้าง (มม.)" }).fill(mid(range.minWMm));
  if (range.maxHMm !== null) await panel.getByRole("textbox", { name: "สูง (มม.)" }).fill(mid(range.minHMm));
  const answer = page.waitForResponse(
    (r) => r.url().endsWith("/dielines/downloads") && r.request().method() === "POST",
  );
  await panel.getByRole("button", { name: "ดาวน์โหลด", exact: true }).click();
  const response = await answer;
  const body = await response.json();
  if (response.status() === 201) {
    expect(body.url).toMatch(/^https?:/);
    await expect(panel.getByText(/^ดาวน์โหลด .+ แล้ว$/)).toBeVisible();
    // T12's "file opens with named layers" (scorecard §2): D-302's layers, each a PDF layer (OCG)
    // with its own spot swatch — the PDF is the panel's default format.
    const pdf = (await (await page.request.get(body.url)).body()).toString("latin1");
    for (const name of ["/OCG", "CutContour", "Crease", "Bleed", "Safe"]) expect(pdf, name).toContain(name);
  } else {
    // Recorded, not hidden: the engine flag or a seed range the engine refuses.
    expect(
      ["drawing.engine_unavailable", "dielines.not_drawable", "dielines.size_out_of_range"],
      JSON.stringify(body),
    ).toContain(body.code);
    await expect(panel.getByText(body.detail)).toBeVisible();
  }
  console.log("dieline download:", response.status(), body.code ?? body.fileName);
});
