import { HOSTS } from "../../playwright.config";
import { signInAsPartner } from "../helpers/session";
import { expect, test } from "./fixture";

test.use({ viewport: { width: 390, height: 844 } });

/** T11 "รับงานใหม่ แล้วอัปเดตว่าเริ่มพิมพ์พร้อมถ่ายรูป" — taps on a phone, from the partner home. */
test("T11 accept a new job and report printing started", async ({ page, journey }) => {
  const j = journey("T11");
  await signInAsPartner(page, "owner");
  await j.startHere();

  // The released job due soonest — the one the floor spec also takes to delivery.
  const list = await page.request.get(`${HOSTS.partner}/bff/v1/partner/production-jobs?view=to_accept`);
  const jobs = ((await list.json()) as { data: { jobNo: string; acceptDueAt: string }[] }).data;
  const job = [...jobs].sort((a, b) => a.acceptDueAt.localeCompare(b.acceptDueAt))[0]!;
  const toast = (text: string) => expect(page.getByText(text).first()).toBeVisible();

  await j.tap(
    "jobs waiting",
    () => page.getByRole("link", { name: /รอรับงาน/ }).click(),
    () => expect(page.getByRole("link", { name: new RegExp(job.jobNo) }).first()).toBeVisible(),
  );
  await j.tap(
    "the job",
    () =>
      page
        .getByRole("link", { name: new RegExp(job.jobNo) })
        .first()
        .click(),
    () => expect(page.getByRole("heading", { level: 1, name: job.jobNo })).toBeVisible(),
  );
  await j.tap(
    "accept",
    () => page.getByRole("button", { name: /^รับงาน/ }).click(),
    () => expect(page.getByRole("alertdialog")).toContainText(job.jobNo),
  );
  await j.tap(
    "confirm accept",
    () => page.getByRole("alertdialog").getByRole("button", { name: "รับงาน", exact: true }).click(),
    () => toast(`รับงาน ${job.jobNo} แล้ว`),
  );

  j.gap("steps run strictly in order: materials prep must be started and finished before printing can start");
  await j.tap(
    "start materials prep",
    () => page.getByRole("button", { name: /^เริ่มเตรียมวัตถุดิบ/ }).click(),
    () => toast("เริ่มเตรียมวัตถุดิบแล้ว"),
  );
  await j.tap(
    "finish materials prep",
    () => page.getByRole("button", { name: /^จบเตรียมวัตถุดิบ/ }).click(),
    () => toast("จบเตรียมวัตถุดิบแล้ว"),
  );
  j.gap("a photo can only be attached when a step finishes, not when it starts");
  await j.tap(
    "start printing",
    () => page.getByRole("button", { name: /^เริ่มพิมพ์/ }).click(),
    () => toast("เริ่มพิมพ์แล้ว"),
  );

  await j.done(() => expect(page.getByRole("button", { name: /^จบพิมพ์/ })).toBeVisible());
});
