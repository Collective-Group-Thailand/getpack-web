import { expect, test } from "@playwright/test";

import { HOSTS } from "../playwright.config";
import { MOCK_DESIGNER_PHONE, signInAsCustomer } from "./helpers/customer";

/**
 * U4.3 performance (studio-spec §1, §6): a design with 150 objects, the 3D view orbited by drag on
 * a mid-range device profile — the CPU throttled 4× through the DevTools protocol — while the
 * frames the page paints are counted. The model is one draw call per surface with the sheet as
 * its texture atlas, so the object count must not slow the orbit (U4.3 measured 59.6 fps). The floor is
 * `ORBIT_FPS_FLOOR`: the CI machine renders WebGL in software (SwiftShader), so it is a ratchet
 * on that machine, not the 60 fps of a real GPU (PROGRESS U4.3).
 */

const ORBIT_FPS_FLOOR = Number(process.env.STUDIO_ORBIT_FPS_FLOOR ?? 45);
const OBJECTS = 150;

test("orbiting a 150-object design in 3D under a 4× CPU throttle", async ({ page, context }) => {
  test.slow();
  await signInAsCustomer(page, "/account", MOCK_DESIGNER_PHONE);
  const headers = { "x-getpack-csrf": "1", origin: HOSTS.customer, "content-type": "application/json" };
  const catalog = await (
    await page.request.get(`${HOSTS.customer}/bff/v1/store/designer/catalog?product=tuck-end-box`)
  ).json();
  const elements = Array.from({ length: OBJECTS }, (_, i) => {
    const base = {
      id: `p${i}`,
      x: 20 + (i % 15) * 12,
      y: 60 + Math.floor(i / 15) * 14,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
    };
    return i % 2
      ? {
          ...base,
          type: "rect",
          width: 8,
          height: 8,
          fill: "#1f6f78",
          stroke: "#000000",
          strokeWidth: 0,
          cornerRadius: 0,
        }
      : {
          ...base,
          type: "text",
          text: `P${i}`,
          fontSize: 4,
          fontFamily: "Sarabun",
          fontStyle: "normal",
          fill: "#c0392b",
          align: "left",
          width: 12,
        };
  });
  const created = await page.request.post(`${HOSTS.customer}/bff/v1/store/designs`, {
    headers,
    data: {
      title: "150 objects",
      catalogProductId: catalog.product.id,
      schemaVersion: 2,
      document: {
        spec: {
          specVersion: 2,
          styleId: "tuck-end",
          values: { length: 70, width: 40, height: 150 },
          material: { caliperMm: 0.45, kind: "paperboard" },
          materialId: null,
        },
        content: { elements, pattern: { kind: "none", color: "#000000", background: "#ffffff", size: 12 } },
      },
    },
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();

  await page.goto(`${HOSTS.customer}/studio/${id}?step=design`);
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
  // C8: the view bar's "3D" (was the "3 มิติ" radio).
  await page.getByRole("toolbar", { name: "มุมมอง" }).getByRole("button", { name: "3D", exact: true }).click();
  const model = page.getByRole("img", { name: /^ภาพสามมิติ/ });
  await expect(model).toBeVisible();
  await expect(page.locator('section[aria-label="กล่อง 3 มิติ"] canvas')).toBeVisible();
  await page.waitForTimeout(1500);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const box = (await model.boundingBox())!;
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number; __counting: boolean };
    w.__frames = 0;
    w.__counting = true;
    const tick = () => {
      if (!w.__counting) return;
      w.__frames += 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const started = Date.now();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(
      box.x + box.width * (0.3 + 0.4 * Math.sin(i / 6)),
      box.y + box.height * (0.5 + 0.1 * Math.cos(i / 5)),
    );
  }
  await page.mouse.up();
  const seconds = (Date.now() - started) / 1000;
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number; __counting: boolean };
    w.__counting = false;
    return w.__frames;
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const fps = frames / seconds;
  test.info().annotations.push({ type: "orbit fps (4× CPU throttle, 150 objects)", description: fps.toFixed(1) });
  console.info(`studio orbit: ${fps.toFixed(1)} fps over ${seconds.toFixed(2)} s`);
  expect(fps).toBeGreaterThanOrEqual(ORBIT_FPS_FLOOR);
});
