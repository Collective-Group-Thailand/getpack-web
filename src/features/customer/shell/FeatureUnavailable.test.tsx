import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import storefront from "@/i18n/messages/th/customer/storefront.json";

import { liffNavItems } from "../liff/LiffNav";
import { FeatureUnavailable } from "./FeatureUnavailable";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/liff",
}));

const renderTh = (node: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="th" messages={{ storefront }} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );

describe("FeatureUnavailable (loyalty P4)", () => {
  it("says calmly that the part is not open, and offers the points page and the products", () => {
    renderTh(<FeatureUnavailable signedIn />);
    expect(screen.getByRole("heading", { level: 1, name: "ส่วนนี้ยังไม่เปิดให้บริการ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ไปหน้าแต้มของฉัน" })).toHaveAttribute("href", "/account/points");
    expect(screen.getByRole("link", { name: "เลือกสินค้า" })).toHaveAttribute("href", "/products");
    // Never the reason: no rollout, budget or "closed because".
    expect(document.body.textContent).not.toMatch(/rollout|งบ|budget|ปิดชั่วคราว/i);
  });

  it("offers only the products to a guest, and the LIFF points page inside LINE", () => {
    const { unmount } = renderTh(<FeatureUnavailable signedIn={false} />);
    expect(screen.queryByRole("link", { name: "ไปหน้าแต้มของฉัน" })).toBeNull();
    unmount();
    renderTh(<FeatureUnavailable signedIn liff pointsHref="/liff/points" />);
    expect(screen.getByRole("link", { name: "ไปหน้าแต้มของฉัน" })).toHaveAttribute("href", "/liff/points");
  });

  it("drops the LIFF points tab while pointsLiff is closed", () => {
    expect(liffNavItems(true).map((item) => item.key)).toEqual(["home", "orders", "points", "chat"]);
    expect(liffNavItems(false).map((item) => item.key)).toEqual(["home", "orders", "chat"]);
  });
});
