import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { loadAllMessages } from "@/i18n/messages";

import { ConfiguratorDock } from "./ConfiguratorDock";
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

/** Size F at 100 pcs: the calculation answers `instant: false` (mocked here; UAT is not touched). */
const nonInstant = {
  quantity: 100,
  instant: false,
  reason: "not_priceable",
} as unknown as PriceStep;

describe("the dock for a quantity with no instant price", () => {
  it("turns the main price area and the primary action into a quotation request carrying the calculation", async () => {
    const messages = await loadAllMessages("th");
    const rfqHref = "/rfq/packaging?from=mailer-box&calc=0192f3a0-7c1e-7d2a-9b1f-0000000c1001";
    render(
      <NextIntlClientProvider locale="th" messages={messages}>
        <ConfiguratorDock
          configurator={{ instant: true, quoteValidityDays: 15 } as unknown as Configurator}
          state={{ quantity: 100, promoCode: "" } as unknown as ConfiguratorState}
          unit="ชิ้น"
          gap={null}
          onSelectQuantity={() => {}}
          missing={[]}
          steps={[nonInstant]}
          specLabel={{ th: "กล่องไปรษณีย์ · 300 × 200 × 100 มม.", en: "Mailer box · 300 × 200 × 100 mm" }}
          loading={false}
          pending={false}
          failed={false}
          onRetry={() => {}}
          onAction={() => {}}
          busy={null}
          lastQuote={null}
          rfqHref={rfqHref}
          designHref={null}
          lineHref={null}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getAllByText("ขอใบเสนอราคา 100 ชิ้น").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/คำนวณราคาอัตโนมัติไม่ได้/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/300 × 200 × 100/).length).toBeGreaterThan(0);
    const cta = screen.getAllByRole("link", { name: "ขอใบเสนอราคา" });
    expect(cta.length).toBeGreaterThan(0);
    for (const link of cta) expect(link).toHaveAttribute("href", rfqHref);
    expect(screen.queryByRole("button", { name: /ใส่ตะกร้า|เพิ่มลงตะกร้า/ })).toBeNull();
  });
});
