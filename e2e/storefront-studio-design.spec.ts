import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { findFace, faceBounds, getStyle, type MaterialSpec, type ParamValues } from "@packio/dieline";

import { HOSTS } from "../playwright.config";
import { MOCK_DESIGNER_PHONE, signInAsCustomer } from "./helpers/customer";
import { addHeading } from "./helpers/designer";

/**
 * U4.3, ③ Design core in Packio 3D Studio against the mock API: the split view (3D beside the flat
 * sheet), a face picked in 3D (the lid on top — "ฝา (บน)", the prompt's "ฝาบน") turning to the camera and taking the next text — which lands on the
 * matching flat panel within 0.5 mm (read back from the saved document and the engine) — picking
 * by clicking the model, and printing on the inside after its cost is shown. As the mock's
 * `designer` persona, so nothing here shares state with the other suites.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const STUDIO = /\/studio\/([0-9a-f-]{36})\?/;
const BOX = "/studio/new?product=tuck-end-box&style=tuck-end&l=70&w=40&h=150&step=design";

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_AA)
    .exclude("canvas")
    .exclude("[data-sonner-toaster]")
    .analyze();
  expect(
    violations,
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n"),
  ).toEqual([]);
}

async function openStudio(page: Page) {
  await signInAsCustomer(page, BOX, MOCK_DESIGNER_PHONE);
  const setup = page.getByRole("dialog", { name: "ตั้งค่ากล่อง" });
  await setup.getByRole("button", { name: "เริ่มออกแบบ" }).click();
  await expect(page).toHaveURL(STUDIO, { timeout: 15_000 });
  return STUDIO.exec(page.url())![1]!;
}

interface SavedDocument {
  document: {
    spec: { styleId: string; values: ParamValues; material: MaterialSpec };
    content: {
      elements: {
        type: string;
        text?: string;
        fontSize?: number;
        x: number;
        y: number;
        clipFaceId?: string;
        side?: string;
      }[];
    };
  };
}

test.describe.configure({ mode: "serial" });

test("text placed on ฝาบน picked in 3D lands on the matching flat panel within 0.5 mm", async ({ page }) => {
  const id = await openStudio(page);

  // Split view by default on a wide screen: the model beside the sheet.
  const model = page.getByRole("region", { name: "กล่อง 3 มิติ" });
  await expect(model.getByRole("img", { name: /^ภาพสามมิติ/ })).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();

  await model.getByRole("group", { name: "เลือกด้านที่จะออกแบบ" }).getByRole("button", { name: "ฝา (บน)" }).click();
  await expect(page.getByRole("status").filter({ hasText: "กำลังแก้: ฝา (บน)" }).first()).toBeVisible();
  await addHeading(page);
  await expect(page.getByRole("status").filter({ hasText: "บันทึกอัตโนมัติ" })).toBeVisible({ timeout: 15_000 });

  const response = await page.request.get(`${HOSTS.customer}/bff/v1/store/designs/${id}`);
  const saved = (await response.json()) as SavedDocument;
  const { spec, content } = saved.document;
  const text = content.elements.find((el) => el.type === "text")!;
  expect(text.clipFaceId).toBe("lid-top");
  const face = findFace(getStyle(spec.styleId).build(spec.values, spec.material), "lid-top")!;
  const b = faceBounds(face);
  // A new text is centred on the focused face (`newText`: the anchor sits half its width and 0.6 of
  // its size before the centre), so its anchor tells where on the sheet the pick put it.
  const length = (text.text ?? "").length;
  const size = text.fontSize!;
  expect(Math.abs(text.x - (b.x + b.width / 2 - length * size * 0.3))).toBeLessThanOrEqual(0.5);
  expect(Math.abs(text.y - (b.y + b.height / 2 - size * 0.6))).toBeLessThanOrEqual(0.5);
  await expectNoViolations(page);
});

test("clicking the model picks the face under the pointer", async ({ page }) => {
  await openStudio(page);
  const model = page.getByRole("region", { name: "กล่อง 3 มิติ" });
  const picture = model.getByRole("img", { name: /^ภาพสามมิติ/ });
  await expect(picture).toBeVisible();
  await model.getByRole("group", { name: "เลือกด้านที่จะออกแบบ" }).getByRole("button", { name: "ฝา (บน)" }).click();
  await expect(page.getByRole("status").filter({ hasText: "กำลังแก้: ฝา (บน)" }).first()).toBeVisible();

  // Back to the starting angle, then a click in the middle of the model hits a side panel.
  await model.getByRole("button", { name: "มุมมองเริ่มต้น" }).click();
  const box = (await picture.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const editing = page
    .getByRole("status")
    .filter({ hasText: /^กำลังแก้: / })
    .first();
  await expect(editing).toBeVisible();
  await expect(editing).not.toHaveText("กำลังแก้: ฝา (บน)");
});

test("the inside is printed after its cost is shown, and its artwork lives on the inside", async ({ page }) => {
  await openStudio(page);
  const sides = page.getByRole("toolbar", { name: "มุมมอง" });
  await sides.getByRole("radio", { name: "ด้านใน" }).click();
  const ask = page.getByRole("alertdialog", { name: "พิมพ์ด้านในด้วยไหม?" });
  await expect(ask).toBeVisible();
  await expectNoViolations(page);
  await ask.getByRole("button", { name: "พิมพ์ด้านในด้วย" }).click();
  await expect(sides.getByRole("radio", { name: "ด้านใน" })).toBeChecked();

  await addHeading(page);
  const rail = page.getByRole("navigation", { name: "เครื่องมือออกแบบ" });
  await rail.getByRole("button", { name: "ชั้น", exact: true }).click();
  const tree = page.getByRole("tree", { name: "ชั้นขององค์ประกอบ บนสุดก่อน" });
  await expect(tree.getByRole("treeitem", { name: "ด้านใน (1)" })).toBeVisible();

  // Back outside: the inside's text is not on the outside's sheet.
  await sides.getByRole("radio", { name: "ด้านนอก" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(tree.getByRole("treeitem", { name: "ด้านใน (1)" })).toBeVisible();
});
