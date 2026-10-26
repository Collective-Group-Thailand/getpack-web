import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { loadAllMessages } from "@/i18n/messages";

import { ConfiguratorDock, type ConfiguratorDockProps } from "./ConfiguratorDock";
import type { PriceStep } from "./pricing";
import type { Configurator, ConfiguratorState } from "./state";

vi.mock("@/features/customer/cart/cart-events", () => ({ useJustAdded: () => false }));
vi.mock("@/i18n/navigation", async () => {
  const React = await import("react");
  return {
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href, ...rest }, children),
  };
});

/** What the API sent for 300 pieces; these strings are fixtures, the dock must show them as they are. */
const priced = {
  quantity: 300,
  instant: true,
  unitPrice: "17.26",
  productAmount: "5178.00",
  vatAmount: "338.58",
  grossAmount: "5178.00",
  shippingAmount: null,
  shippingPending: true,
  designFeeAmount: "0.00",
  structureDesignFeeAmount: "0.00",
  leadTimeDays: 5,
  earliestShipDate: "2026-11-03",
  earliestDeliveryDate: null,
  toleranceShortagePct: "5.00",
  toleranceOveragePct: "5.00",
} as unknown as PriceStep;

async function show(over: Partial<ConfiguratorDockProps> = {}, step: PriceStep = priced) {
  const messages = await loadAllMessages("th");
  const props: ConfiguratorDockProps = {
    configurator: { instant: true, quoteValidityDays: 15 } as unknown as Configurator,
    state: { quantity: 300, promoCode: "" } as unknown as ConfiguratorState,
    unit: "ชิ้น",
    gap: null,
    missing: [],
    steps: [step],
    specLabel: { th: "กล่องไปรษณีย์", en: "Mailer box" },
    loading: false,
    pending: false,
    failed: false,
    onRetry: () => {},
    onAction: () => {},
    busy: null,
    lastQuote: null,
    rfqHref: "/rfq/x",
    designHref: null,
    lineHref: null,
    ...over,
  };
  return render(
    <NextIntlClientProvider locale="th" messages={messages}>
      <ConfiguratorDock {...props} />
    </NextIntlClientProvider>,
  );
}

describe("the price summary", () => {
  it("shows the API's VAT amount as sent and labels the total as without shipping while no postcode is known", async () => {
    await show();
    const lines = screen.getByRole("complementary", { name: "ราคาของคุณ" });
    // 5178 × 7 / 107 is 338.75: the API's 338.58 is shown untouched, never re-derived here.
    expect(within(lines).getByText("VAT (รวมในยอดแล้ว)")).toBeInTheDocument();
    expect(within(lines).getByText("฿338.58")).toBeInTheDocument();
    expect(within(lines).getByText("ยอดรวม (ไม่รวมค่าส่ง)")).toBeInTheDocument();
    expect(within(lines).getByText(/ผลิต 5 วันทำการ/)).toBeInTheDocument();
    expect(within(lines).getByText(/ขาดได้ 5% เกินได้ 5%/)).toBeInTheDocument();
    expect(
      within(lines).getByText(/ใบเสนอราคาคงราคา 15 วัน · ร่างเก็บ 90 วัน · ลิงก์แชร์ใช้ได้ 15 วัน/),
    ).toBeInTheDocument();
  });

  it("links the shipping line to the shipping step, and offers the three ways to keep the price", async () => {
    const onGoToShipping = vi.fn();
    const onAction = vi.fn();
    await show({ onGoToShipping, onAction });
    const lines = screen.getByRole("complementary", { name: "ราคาของคุณ" });
    fireEvent.click(within(lines).getByRole("button", { name: "ระบุรหัสไปรษณีย์" }));
    expect(onGoToShipping).toHaveBeenCalledTimes(1);
    fireEvent.click(within(lines).getByRole("button", { name: "ใบเสนอราคา" }));
    fireEvent.click(within(lines).getByRole("button", { name: "แชร์ลิงก์" }));
    fireEvent.click(within(lines).getByRole("button", { name: "PDF" }));
    expect(onAction.mock.calls.map(([action]) => action)).toEqual(["save", "share", "pdf"]);
  });

  it("drops the no-shipping wording once shipping is priced, and hides a date the API did not send", async () => {
    await show({}, {
      ...priced,
      shippingPending: false,
      shippingAmount: "120.00",
      earliestShipDate: null,
      leadTimeDays: null,
    } as PriceStep);
    const lines = screen.getByRole("complementary", { name: "ราคาของคุณ" });
    expect(within(lines).getByText("ยอดรวม")).toBeInTheDocument();
    expect(within(lines).queryByText(/พร้อมจัดส่งเร็วสุด/)).toBeNull();
    expect(within(lines).queryByText(/ผลิต .* วันทำการ/)).toBeNull();
  });

  it("shows how many steps are done, and the discount field only when one is passed", async () => {
    await show({ completeness: { done: 3, total: 6 } });
    expect(screen.getByText("ครบ 3/6")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "ความครบถ้วนของการตั้งค่า" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.queryByPlaceholderText("โค้ดส่วนลด")).toBeNull();
  });
});
