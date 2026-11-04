import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import deals from "@/i18n/messages/th/customer/deals.json";
import type { ApplicableCodes } from "@/lib/api/requests/store-deals";

import { CouponPicker } from "./CouponPicker";

const DATA: ApplicableCodes = {
  applicable: [
    {
      code: "FREESHIP",
      promotionId: "00000000-0000-4000-8000-000000000002",
      headline: "ส่งฟรี",
      benefitSummary: "ส่งฟรีทั่วประเทศ",
      saving: "250.00",
      stackGroup: "shipping",
      conflictsWith: [],
      best: false,
    },
    {
      code: "LABEL8",
      promotionId: "00000000-0000-4000-8000-000000000003",
      headline: "ฉลาก",
      benefitSummary: "ลด 8% สติกเกอร์ฉลาก",
      saving: "340.00",
      stackGroup: "product",
      conflictsWith: ["BOX10"],
      best: false,
    },
    {
      code: "BOX10",
      promotionId: "00000000-0000-4000-8000-000000000001",
      headline: "กล่อง",
      benefitSummary: "ลด 10% กล่องลูกฟูก",
      saving: "1331.00",
      stackGroup: "product",
      conflictsWith: ["LABEL8"],
      best: true,
    },
    {
      code: "TAPE5",
      promotionId: "00000000-0000-4000-8000-000000000004",
      headline: "เทป",
      benefitSummary: "ลด 5% เทป",
      saving: "40.00",
      stackGroup: null,
      conflictsWith: [],
      best: false,
    },
  ],
  notYet: [
    { code: "MATTEFREE", headline: "เคลือบด้านฟรี", reason: "min_quantity", reasonText: "สั่งกล่องเพิ่มอีก 1,000 ใบ" },
  ],
  maxCodes: 3,
};

function renderPicker(held: string[], overrides: Partial<React.ComponentProps<typeof CouponPicker>> = {}) {
  const onApply = vi.fn();
  const onRemove = vi.fn();
  render(
    <NextIntlClientProvider locale="th" messages={{ deals }} timeZone="Asia/Bangkok">
      <CouponPicker data={DATA} held={held} onApply={onApply} onRemove={onRemove} {...overrides} />
    </NextIntlClientProvider>,
  );
  return { onApply, onRemove };
}

const boxes = () => screen.getAllByRole("checkbox");

describe("CouponPicker (loyalty P1.5)", () => {
  it("lists the best saving first, then by saving, each with the API's figure", () => {
    renderPicker([]);
    expect(boxes().map((box) => box.getAttribute("aria-label"))).toEqual([
      "ใช้คูปอง BOX10",
      "ใช้คูปอง LABEL8",
      "ใช้คูปอง FREESHIP",
      "ใช้คูปอง TAPE5",
    ]);
    expect(screen.getByText("คุ้มที่สุด")).toBeInTheDocument();
    expect(screen.getByText("−฿1,331.00")).toBeInTheDocument();
  });

  it("ticks the codes the cart holds and says how many of the maximum are chosen", () => {
    renderPicker(["BOX10", "FREESHIP"]);
    expect(boxes()[0]).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("เลือกแล้ว 2 จาก 3 ใบ")).toBeInTheDocument();
  });

  it("disables a code that cannot stack with a held one, and says which", () => {
    renderPicker(["BOX10"]);
    const label8 = screen.getByRole("checkbox", { name: "ใช้คูปอง LABEL8" });
    expect(label8).toBeDisabled();
    expect(screen.getByText("ใช้ร่วมกับ BOX10 ไม่ได้")).toBeInTheDocument();
  });

  it("stops at 3 codes (D-452): the rest are disabled with the reason", () => {
    renderPicker(["BOX10", "FREESHIP", "MANUAL1"]);
    expect(screen.getByRole("checkbox", { name: "ใช้คูปอง TAPE5" })).toBeDisabled();
    expect(screen.getAllByText("ครบ 3 ใบแล้ว").length).toBeGreaterThan(0);
  });

  it("applies on tick and removes on untick", async () => {
    const user = userEvent.setup();
    const { onApply, onRemove } = renderPicker(["BOX10"]);
    await user.click(screen.getByRole("checkbox", { name: "ใช้คูปอง FREESHIP" }));
    expect(onApply).toHaveBeenCalledWith("FREESHIP");
    await user.click(screen.getByRole("checkbox", { name: "เลิกใช้คูปอง BOX10" }));
    expect(onRemove).toHaveBeenCalledWith("BOX10");
  });

  it("lists what is not usable yet with its reason as text, with no control", () => {
    renderPicker([]);
    const notYet = screen.getByText("สั่งกล่องเพิ่มอีก 1,000 ใบ").closest("li")!;
    expect(within(notYet).getByText("MATTEFREE")).toBeInTheDocument();
    expect(within(notYet).queryByRole("checkbox")).toBeNull();
  });
});
