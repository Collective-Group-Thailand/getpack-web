import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import deals from "@/i18n/messages/th/customer/deals.json";

import { fixtureDeal } from "../../../../mocks/store/deals-fixtures";

import { HOME_DEALS, HomeDeals, homeDeals } from "./HomeDeals";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api/requests/browser", () => ({ browserRequests: () => ({ call: vi.fn() }) }));

const NOW = Date.parse("2026-11-04T10:30:00+07:00");
const five = ["box10-corrugated", "free-shipping-5000", "label8-5000", "welcome-300", "reorder-points-x2"].map((slug) =>
  fixtureDeal(slug),
);

describe("the home page's deal strip (PLAN §3.5.3)", () => {
  it("is not rendered at all without a public deal", async () => {
    expect(homeDeals(null)).toEqual([]);
    expect(homeDeals([])).toEqual([]);
    await expect(HomeDeals({ deals: [], signedIn: false, now: NOW, typeNames: {} })).resolves.toBeNull();
  });

  it("shows three tickets in the API's order and links to every deal", async () => {
    expect(homeDeals(five).map((deal) => deal.slug)).toEqual(five.slice(0, HOME_DEALS).map((deal) => deal.slug));
    const strip = await HomeDeals({ deals: homeDeals(five), signedIn: true, now: NOW, typeNames: {} });
    render(
      <NextIntlClientProvider locale="th" messages={{ deals }} timeZone="Asia/Bangkok">
        {strip}
      </NextIntlClientProvider>,
    );
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "deals.home.all" })).toHaveAttribute("href", "/deals");
  });
});
